(function () {
  "use strict";

  const QUALITY_HEIGHT = {
    highres: 4320, hd2160: 2160, hd1440: 1440, hd1080: 1080,
    hd720: 720, large: 480, medium: 360, small: 240, tiny: 144,
  };
  const SETTINGS_ATTRIBUTE = "data-zed-video-quality";
  const SPEED_ATTRIBUTE = "data-zed-playback-speed";
  const isFacebook = /(^|\.)facebook\.com$/i.test(window.location && window.location.hostname || "");
  const isMeta = isFacebook || /(^|\.)instagram\.com$/i.test(window.location && window.location.hostname || "");
  const isTikTok = /(^|\.)tiktok\.com$/i.test(window.location && window.location.hostname || "");
  const metaControllers = new WeakMap();
  let speed = null;
  let settings = null;
  let applied = new WeakMap();
  let retryTimers = [];
  const roots = new Set([document]);
  let observer;

  function discover(root) {
    function add(element) {
      const shadow = element.shadowRoot;
      if (!shadow || roots.has(shadow)) return;
      roots.add(shadow);
      if (observer) observer.observe(shadow, { childList: true, subtree: true });
      for (const type of MEDIA_EVENTS) shadow.addEventListener(type, onMedia, true);
      discover(shadow);
    }
    add(root);
    if (typeof root.querySelectorAll === "function") for (const element of root.querySelectorAll("*")) add(element);
  }

  function queryAll(selector) {
    const elements = [];
    for (const root of roots) {
      if (root.host && root.host.isConnected === false) { roots.delete(root); continue; }
      if (typeof root.querySelectorAll === "function") elements.push(...root.querySelectorAll(selector));
    }
    return elements;
  }

  function normalize(input) {
    if (!input || typeof input !== "object") return null;
    if (input.quality !== "auto" && !Object.prototype.hasOwnProperty.call(QUALITY_HEIGHT, input.quality)) return null;
    return { quality: input.quality, fallback: input.fallback === "higher" ? "higher" : "lower" };
  }

  function readSettings() {
    try {
      return normalize(JSON.parse(document.documentElement.getAttribute(SETTINGS_ATTRIBUTE)));
    } catch (error) { return null; }
  }

  function chooseHeight(levels) {
    const heights = Array.from(new Set(levels.map(function (level) { return level.height; })
      .filter(function (height) { return Number.isFinite(height) && height > 0; }))).sort(function (a, b) { return a - b; });
    const target = QUALITY_HEIGHT[settings.quality];
    if (!heights.length || !target) return 0;
    if (heights.includes(target)) return target;
    if (settings.fallback === "higher") return heights.find(function (height) { return height > target; }) || heights[heights.length - 1];
    return heights.slice().reverse().find(function (height) { return height < target; }) || heights[0];
  }

  function update(player, source, levels, select, force) {
    const auto = settings.quality === "auto";
    const height = auto ? 0 : chooseHeight(levels);
    if (!auto && !height) return null;
    const key = JSON.stringify([settings, source, levels.map(function (level) { return [level.id, level.height]; })]);
    const previous = applied.get(player);
    if (!force && previous && previous.key === key) return previous.result;
    const result = select(height, auto);
    applied.set(player, { key, result });
    return result;
  }

  function applyYouTube(player, force) {
    if (typeof player.getAvailableQualityLevels !== "function") return null;
    if (typeof player.setPlaybackQualityRange !== "function" && typeof player.setPlaybackQuality !== "function") return null;
    const levels = (player.getAvailableQualityLevels() || []).map(function (id) { return { id, height: QUALITY_HEIGHT[id] }; });
    const source = typeof player.getVideoData === "function" ? player.getVideoData().video_id : "";
    return update(player, source, levels, function (height, auto) {
      const chosen = auto ? "default" : levels.find(function (level) { return level.height === height; }).id;
      if (typeof player.setPlaybackQualityRange === "function") player.setPlaybackQualityRange(chosen, chosen);
      if (typeof player.setPlaybackQuality === "function") player.setPlaybackQuality(chosen);
      try {
        if (auto) localStorage.removeItem("yt-player-quality");
        else {
          const timestamp = Date.now();
          localStorage.setItem("yt-player-quality", JSON.stringify({
            data: settings.quality, creation: timestamp, expiration: timestamp + 30 * 24 * 60 * 60 * 1000,
          }));
        }
      } catch (error) {}
      return auto ? "auto" : chosen;
    }, force);
  }

  function applyHls(video, force) {
    // shortcut: use only video.hls; extend discovery when a site exposes another stable instance API.
    const hls = video.hls;
    if (!hls || hls.media !== video || !Array.isArray(hls.levels)) return null;
    return update(hls, video.currentSrc, hls.levels, function (height, auto) {
      // loadLevel keeps the buffered video and playback position intact.
      hls.loadLevel = auto ? -1 : hls.levels.findIndex(function (level) { return level.height === height; });
      return auto ? "auto" : height + "p";
    }, force);
  }

  function applyShaka(video, force) {
    const overlay = video.ui || (video.parentElement && video.parentElement.ui);
    if (!overlay || typeof overlay.getControls !== "function") return null;
    const player = overlay.getControls().getPlayer();
    if (!player || typeof player.getVariantTracks !== "function" || typeof player.configure !== "function" || typeof player.selectVariantTrack !== "function") return null;
    let tracks = player.getVariantTracks();
    const active = tracks.find(function (track) { return track.active; });
    if (active) tracks = tracks.filter(function (track) { return track.language === active.language && track.audioId === active.audioId; });
    return update(player, video.currentSrc, tracks, function (height, auto) {
      if (auto) player.configure({ abr: { enabled: true } });
      else {
        player.configure({ abr: { enabled: false } });
        player.selectVariantTrack(tracks.find(function (track) { return track.height === height; }), false);
      }
      return auto ? "auto" : height + "p";
    }, force);
  }

  function applyVideoJs(player, force) {
    if (!player || typeof player.qualityLevels !== "function") return null;
    const levels = Array.from(player.qualityLevels());
    const source = typeof player.currentSrc === "function" ? player.currentSrc() : "";
    return update(player, source, levels, function (height, auto) {
      // Enable the selected representations before disabling the others.
      for (const level of levels) if (auto || level.height === height) level.enabled = true;
      for (const level of levels) if (!auto && level.height > 0 && level.height !== height) level.enabled = false;
      return auto ? "auto" : height + "p";
    }, force);
  }

  function metaController(video) {
    function match(value) {
      if (value && typeof value.selectVideoQuality === "function" && typeof value.getCurrentState === "function" &&
          typeof value.internal_getVideoElement === "function" && value.internal_getVideoElement() === video) return value;
      return null;
    }
    const cached = match(metaControllers.get(video));
    if (cached) return cached;
    const key = Object.getOwnPropertyNames(video).find(function (key) { return key.startsWith("__reactFiber$"); });
    let fiber = key && video[key];
    if (!fiber) {
      let root = null;
      for (let element = video; element && !root; element = element.parentElement) {
        const rootKey = Object.getOwnPropertyNames(element).find(function (key) { return key.startsWith("__reactContainer$"); });
        if (rootKey) {
          const container = element[rootKey];
          root = container.stateNode && container.stateNode.current || container;
        }
      }
      // Some Meta builds keep host fibers only in the root tree; bound the fallback scan.
      const pending = root ? [root] : [];
      const seen = new Set();
      for (let visited = 0; pending.length && visited < 20000; visited++) {
        const candidate = pending.pop();
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        if (candidate.stateNode === video) { fiber = candidate; break; }
        if (candidate.sibling) pending.push(candidate.sibling);
        if (candidate.child) pending.push(candidate.child);
      }
    }
    // shortcut: Meta exposes this controller through React refs; revisit if its player internals change.
    for (let depth = 0; fiber && depth < 40; fiber = fiber.return, depth++) {
      let controller = match(fiber.memoizedProps && fiber.memoizedProps.value);
      for (let hook = fiber.memoizedState, count = 0; !controller && hook && count < 100; hook = hook.next, count++) {
        const state = hook.memoizedState;
        controller = match(state) || match(state && state.implementationController) ||
          match(state && state.current && state.current.value && state.current.value.implementationController);
      }
      for (let context = fiber.dependencies && fiber.dependencies.firstContext, count = 0;
           !controller && context && count < 20; context = context.next, count++) controller = match(context.memoizedValue);
      if (controller) { metaControllers.set(video, controller); return controller; }
    }
    return null;
  }

  function applyMeta(video, force) {
    const controller = metaController(video);
    if (!controller || typeof controller.isFrozen === "function" && controller.isFrozen()) return null;
    const state = controller.getCurrentState();
    if (speed !== null && typeof controller.setPlaybackRate === "function" && state.targetPlaybackRate !== speed) controller.setPlaybackRate(speed);
    if (!Array.isArray(state.availableVideoQualities)) return null;
    const levels = state.availableVideoQualities.map(function (id) {
      const match = typeof id === "string" && id.match(/^(\d{3,4})p(?:\d+)?$/);
      return { id, height: match ? Number(match[1]) : id === "SD" ? 360 : id === "HD" ? 720 : 0 };
    });
    return update(controller, [state.videoFBID, state.playerInstanceKey], levels, function (height, auto) {
      const chosen = auto ? "auto" : levels.find(function (level) { return level.height === height; }).id;
      if (state.selectedVideoQuality !== chosen) controller.selectVideoQuality(chosen);
      return chosen;
    }, force);
  }

  function applyTikTok(video, force) {
    let fiber = null;
    for (let element = video; element && !fiber; element = element.parentElement) {
      const key = Object.getOwnPropertyNames(element).find(function (key) { return key.startsWith("__reactFiber$"); });
      if (key) fiber = element[key];
    }
    // shortcut: TikTok keeps its native player in React refs; revisit if its player internals change.
    let player = null;
    for (let depth = 0; fiber && !player && depth < 40; fiber = fiber.return, depth++) {
      for (let hook = fiber.memoizedState, count = 0; hook && count < 100; hook = hook.next, count++) {
        const candidate = hook.memoizedState && hook.memoizedState.current;
        if (candidate && candidate.element === video && typeof candidate.changeVideo === "function" &&
            candidate.config && candidate.config.strategyConfig && candidate.resolutionInfo &&
            Array.isArray(candidate.resolutionInfo.resolutionList)) { player = candidate; break; }
      }
    }
    if (!player) return null;
    const levels = player.resolutionInfo.resolutionList.map(function (level) {
      const match = typeof level.resolution === "string" && level.resolution.match(/^(\d{3,4})P$/i);
      return { id: level.resolution, height: match ? Number(match[1]) : 0 };
    });
    return update(player, player.vid, levels, function (height, auto) {
      const chosen = auto ? "auto" : levels.find(function (level) { return level.height === height; }).id;
      const config = player.config;
      if (!config.strategyConfig.bitrateAdapter || config.strategyConfig.bitrateAdapter.userSelectResolution !== chosen) {
        // changeResolution only updates a label in TikTok's new player; reload through its native API.
        player.changeVideo({ ...config,
          playerConfig: { ...config.playerConfig, startTime: video.currentTime, autoplay: !video.paused,
            volume: video.volume, muted: video.muted, playbackRate: video.playbackRate },
          strategyConfig: { ...config.strategyConfig,
            bitrateAdapter: { ...config.strategyConfig.bitrateAdapter, userSelectResolution: chosen } },
        }, player.state, true);
      }
      return auto ? "auto" : height + "p";
    }, force);
  }

  function setSpeed(value) {
    const next = Number(value);
    speed = Number.isFinite(next) && next >= 0.1 && next <= 10 ? Math.round(next * 10) / 10 : null;
    if (isFacebook) void applyAll(false);
  }

  function applyAll(force) {
    if (!settings) return Promise.resolve(null);
    let result = null;
    function attempt(action, active) {
      // A disposed or unsupported player must not stop other videos in the frame.
      try {
        const selected = action();
        if (selected && (!result || active)) result = selected;
      } catch (error) {}
    }
    const youtubePlayers = new Set(queryAll(".html5-video-player"));
    if (typeof document.getElementById === "function") {
      const player = document.getElementById("movie_player");
      if (player) youtubePlayers.add(player);
    }
    for (const player of youtubePlayers) attempt(function () { return applyYouTube(player, force); });
    const videos = queryAll("video");
    if (isTikTok) {
      const active = videos.find(function (video) { return video.paused === false; }) || videos.find(function (video) {
        if (typeof video.getBoundingClientRect !== "function") return true;
        const rect = video.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      });
      if (active) attempt(function () { return applyTikTok(active, force); }, true);
    }
    for (const video of videos) {
      if (isMeta) attempt(function () { return applyMeta(video, force); }, video.paused === false);
      attempt(function () { return applyHls(video, force); });
      attempt(function () { return applyShaka(video, force); });
    }
    attempt(function () {
      if (window.videojs && typeof window.videojs.getPlayers === "function") {
        for (const player of Object.values(window.videojs.getPlayers())) attempt(function () { return applyVideoJs(player, force); });
      }
    });
    return Promise.resolve(result);
  }

  function scheduleRetries() {
    for (const timer of retryTimers) clearTimeout(timer);
    retryTimers = [500, 1500, 4000].map(function (delay) {
      return setTimeout(function () { void applyAll(false); }, delay);
    });
  }

  function setSettings(input, options) {
    const next = normalize(input);
    if (!next) return;
    const changed = !settings || next.quality !== settings.quality || next.fallback !== settings.fallback;
    settings = next;
    window.__zedVideoQualitySettings = next;
    if (changed && (!options || options.apply !== false)) {
      void applyAll(false);
      scheduleRetries();
    }
  }

  function apply(input) {
    setSettings(input || settings || { quality: "hd1080", fallback: "lower" }, { apply: false });
    scheduleRetries();
    discover(document);
    return applyAll(true);
  }

  if (window.__zedVideoQualityEngine) {
    if (window.__zedVideoQualityEngine.version !== 7) {
      window.__zedVideoQualityEngine.setSettings({ quality: "auto", fallback: "lower" }, { apply: false });
      throw new Error("Refresh this tab to replace the old video quality handler.");
    }
    return window.__zedVideoQualityEngine.apply(normalize(window.__zedVideoQualitySettings) || undefined);
  }
  window.__zedVideoQualityEngine = { apply, applyAll, setSettings, getSettings: function () { return settings; }, version: 7 };

  function onMedia(event) {
    if (!event.target || event.target.tagName !== "VIDEO") return;
    if (event.type === "loadstart" || event.type === "emptied") {
      applied = new WeakMap();
      return;
    }
    void applyAll(false);
  }

  const MEDIA_EVENTS = ["loadedmetadata", "canplay", "play", "playing", "loadstart", "emptied"];
  if (typeof document.addEventListener === "function") {
    for (const type of MEDIA_EVENTS) document.addEventListener(type, onMedia, true);
    document.addEventListener("zed-video-quality-changed", function (event) {
      try { setSettings(typeof event.detail === "string" ? JSON.parse(event.detail) : event.detail); } catch (error) {}
    });
    document.addEventListener("zed-playback-speed-changed", function (event) { setSpeed(event.detail); });
    document.addEventListener("yt-navigate-finish", function () { void applyAll(false); scheduleRetries(); });
  }
  if (typeof MutationObserver !== "undefined" && document.documentElement) {
    observer = new MutationObserver(function (records) {
      if (records.some(function (record) { return record.type === "attributes" && record.target === document.documentElement; })) {
        setSettings(readSettings());
        if (isFacebook) setSpeed(document.documentElement.getAttribute(SPEED_ATTRIBUTE));
      }
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1) discover(node);
      if (records.some(function (record) { return record.addedNodes.length > 0; })) void applyAll(false);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [SETTINGS_ATTRIBUTE, SPEED_ATTRIBUTE] });
  }
  discover(document);
  if (isFacebook && document.documentElement) setSpeed(document.documentElement.getAttribute(SPEED_ATTRIBUTE));

  const initial = normalize(window.__zedVideoQualitySettings) || readSettings();
  if (initial) return apply(initial);
  return Promise.resolve(null);
})();
