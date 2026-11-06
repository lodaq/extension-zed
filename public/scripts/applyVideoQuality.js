(function () {
  "use strict";

  const DEFAULT_SETTINGS = { quality: "hd1080", fallback: "lower" };

  const QUALITY_HEIGHT = {
    highres: 4320,
    hd2160: 2160,
    hd1440: 1440,
    hd1080: 1080,
    hd720: 720,
    large: 480,
    medium: 360,
    small: 240,
    tiny: 144,
  };

  const MENU_SCOPE_SELECTOR = '[role="menu"], [role="listbox"], [role="dialog"]';
  const MENU_ITEM_SELECTOR =
    '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [tabindex], [aria-haspopup]';
  // Broad text-matched fallback across the whole document is expensive, so only
  // use role-based elements there.
  const MENU_ITEM_STRICT_SELECTOR =
    '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [aria-haspopup]';
  const SETTINGS_SELECTOR = [
    '[data-testid="videoSettings"]',
    '[data-testid="player-settings"]',
    '[data-testid*="video-settings" i]',
    '[data-testid*="player-settings" i]',
    '[data-testid*="settings" i]',
    '[data-a-target="player-settings-button"]',
    '[data-a-target*="settings" i]',
    '[aria-label*="settings" i]',
    '[aria-label*="setting" i]',
    '[aria-label="quality" i]',
    '[title*="settings" i]',
    '[title*="setting" i]',
    'button[aria-haspopup="menu"]',
    '[role="button"][aria-haspopup="menu"]',
  ].join(",");

  const state = { settings: null, installed: false };
  const appliedStates = new WeakMap();
  const applying = new WeakSet();
  let navigationTimer = null;

  // ---------------------------------------------------------------- utilities

  function normalizeSettings(input) {
    if (!input || typeof input !== "object") return null;
    const quality = typeof input.quality === "string" ? input.quality : DEFAULT_SETTINGS.quality;
    const fallback = input.fallback === "higher" ? "higher" : "lower";
    return { quality, fallback };
  }

  function parseQualityHeight(value) {
    if (value === null || value === undefined) return 0;
    const text = String(value).replace(/\s+/g, " ").trim().toLowerCase();
    if (!text) return 0;
    if (Object.prototype.hasOwnProperty.call(QUALITY_HEIGHT, text)) return QUALITY_HEIGHT[text];

    const progressive = text.match(/(\d{3,4})\s*p(?:\s*\d{1,3})?/i);
    if (progressive) return parseInt(progressive[1], 10);

    const shorthand = text.match(/(\d(?:\.\d)?)\s*k\b/);
    if (shorthand) {
      const value = parseFloat(shorthand[1]);
      if (value >= 8) return 4320;
      if (value >= 4) return 2160;
      if (value >= 2) return 1440;
      if (value >= 1) return 1080;
    }

    if (/\b(ultra\s*hd|uhd)\b/.test(text)) return 2160;
    if (/\b(full\s*hd|fhd)\b/.test(text)) return 1080;
    if (/\bhd\b/.test(text)) return 720;
    if (/\bsd\b/.test(text)) return 360;
    return 0;
  }

  function resolveLevel(target, available, fallback) {
    if (!available || !available.length) return target === "auto" ? "auto" : target;
    if (target === "auto") return "auto";
    if (available.indexOf(target) >= 0) return target;

    const targetHeight = QUALITY_HEIGHT[target] || parseQualityHeight(target);
    if (!targetHeight) return available[0] || target;

    const valid = [];
    for (const level of available) {
      const height = QUALITY_HEIGHT[level] || parseQualityHeight(level);
      if (height > 0) valid.push({ id: level, height });
    }
    if (!valid.length) return available[0] || target;
    valid.sort(function (a, b) { return a.height - b.height; });

    if (fallback === "higher") {
      const higher = valid.find(function (item) { return item.height > targetHeight; });
      return (higher || valid[valid.length - 1]).id;
    }
    const lower = valid.slice().reverse().find(function (item) { return item.height < targetHeight; });
    return (lower || valid[0]).id;
  }

  function pickHeight(heights, target, fallback) {
    const unique = Array.from(new Set(heights.filter(function (h) { return h > 0; }))).sort(function (a, b) {
      return a - b;
    });
    if (!unique.length) return 0;

    const targetHeight = QUALITY_HEIGHT[target] || parseQualityHeight(target);
    if (!targetHeight) return 0;
    if (unique.indexOf(targetHeight) >= 0) return targetHeight;

    if (fallback === "higher") {
      const higher = unique.find(function (h) { return h > targetHeight; });
      return higher !== undefined ? higher : unique[unique.length - 1];
    }
    const lower = unique.slice().reverse().find(function (h) { return h < targetHeight; });
    return lower !== undefined ? lower : unique[0];
  }

  function now() {
    return Date.now();
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function waitFor(predicate, timeout, interval) {
    const started = now();
    return new Promise(function (resolve) {
      (function poll() {
        let value = null;
        try { value = predicate(); } catch (error) { value = null; }
        if (value) { resolve(value); return; }
        if (now() - started >= timeout) { resolve(null); return; }
        setTimeout(poll, interval);
      })();
    });
  }

  function textOf(element) {
    if (!element) return "";
    const text = element.textContent || "";
    return String(text).replace(/\s+/g, " ").trim();
  }

  function attributeOf(element, name) {
    try {
      return element && typeof element.getAttribute === "function" ? element.getAttribute(name) || "" : "";
    } catch (error) {
      return "";
    }
  }

  function isVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") return false;
    try {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(element) : null;
      if (style) {
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
        if (Number(style.opacity) === 0) return false;
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function isOnScreen(element) {
    if (!isVisible(element)) return false;
    try {
      const rect = element.getBoundingClientRect();
      const width = typeof window !== "undefined" ? window.innerWidth || 0 : 0;
      const height = typeof window !== "undefined" ? window.innerHeight || 0 : 0;
      return rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
    } catch (error) {
      return false;
    }
  }

  function overlapsVideo(element, video) {
    if (!video || typeof video.getBoundingClientRect !== "function") return true;
    try {
      const videoRect = video.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const padding = 40;
      return rect.left <= videoRect.right + padding && rect.right >= videoRect.left - padding &&
        rect.top <= videoRect.bottom + padding && rect.bottom >= videoRect.top - padding;
    } catch (error) {
      return true;
    }
  }

  function listVideos() {
    if (typeof document.querySelectorAll !== "function") return [];
    try {
      return Array.prototype.slice.call(document.querySelectorAll("video"));
    } catch (error) {
      return [];
    }
  }

  function signatureOf(video) {
    if (!video) return "";
    return [video.currentSrc || video.src || "", video.duration || 0, video.poster || ""].join("|");
  }

  function wasApplied(video, settings, force) {
    const previous = appliedStates.get(video);
    if (!previous) return false;
    if (previous.signature !== signatureOf(video)) return false;
    if (previous.quality !== settings.quality || previous.fallback !== settings.fallback) return false;
    if (force && now() - previous.at > 1500) return false;
    return true;
  }

  function markApplied(video, settings) {
    appliedStates.set(video, {
      signature: signatureOf(video),
      quality: settings.quality,
      fallback: settings.fallback,
      at: now(),
    });
  }

  function getHost() {
    try {
      if (typeof location !== "undefined" && location && typeof location.hostname === "string") {
        return location.hostname;
      }
    } catch (error) {}
    try {
      if (typeof window !== "undefined" && window.location && typeof window.location.hostname === "string") {
        return window.location.hostname;
      }
    } catch (error) {}
    return "";
  }

  function isYouTube() {
    const host = getHost();
    if (/(^|\.)youtube\.com$/.test(host) || /(^|\.)youtube-nocookie\.com$/.test(host)) return true;
    try {
      return typeof document.getElementById === "function" && !!document.getElementById("movie_player");
    } catch (error) {
      return false;
    }
  }

  const KNOWN_MENU_HOSTS = [
    "youtube.com", "youtube-nocookie.com", "facebook.com", "fb.watch", "x.com", "twitter.com",
    "twitch.tv", "dailymotion.com", "vimeo.com", "reddit.com", "instagram.com", "tiktok.com",
    "linkedin.com", "bilibili.com", "rumble.com", "odysee.com", "streamable.com", "9gag.com",
    "imgur.com", "pinterest.com", "snapchat.com", "tumblr.com", "vk.com", "ok.ru",
  ];

  function isKnownMenuSite() {
    const host = getHost();
    if (!host) return false;
    return KNOWN_MENU_HOSTS.some(function (domain) {
      return host === domain || host.slice(-(domain.length + 1)) === "." + domain;
    });
  }

  // ------------------------------------------------------------------ YouTube

  function youtubePlayer() {
    try {
      if (typeof document.getElementById === "function") {
        const player = document.getElementById("movie_player");
        if (player) return player;
      }
      if (typeof document.querySelector === "function") return document.querySelector(".html5-video-player");
    } catch (error) {}
    return null;
  }

  function rememberYouTubeQuality(quality) {
    try {
      if (quality === "auto") {
        localStorage.removeItem("yt-player-quality");
      } else {
        const timestamp = now();
        localStorage.setItem("yt-player-quality", JSON.stringify({
          data: quality,
          creation: timestamp,
          expiration: timestamp + 30 * 24 * 60 * 60 * 1000,
        }));
      }
    } catch (error) {}
  }

  function applyYouTubePage(settings) {
    if (!settings) return null;
    const target = settings.quality;

    if (target === "auto") {
      rememberYouTubeQuality("auto");
      const player = youtubePlayer();
      if (player) {
        try {
          if (typeof player.setPlaybackQualityRange === "function") {
            player.setPlaybackQualityRange("default", "default");
          }
        } catch (error) {}
        try {
          if (typeof player.setPlaybackQuality === "function") player.setPlaybackQuality("default");
        } catch (error) {}
      }
      return "auto";
    }

    rememberYouTubeQuality(target);

    const player = youtubePlayer();
    if (!player || typeof player.getAvailableQualityLevels !== "function") return null;

    let available = [];
    try {
      available = player.getAvailableQualityLevels() || [];
    } catch (error) {
      available = [];
    }
    if (!available.length) return "pending";

    const chosen = resolveLevel(target, available, settings.fallback);
    try {
      if (typeof player.setPlaybackQualityRange === "function") {
        player.setPlaybackQualityRange(chosen, chosen);
      }
    } catch (error) {}
    try {
      if (typeof player.setPlaybackQuality === "function") player.setPlaybackQuality(chosen);
    } catch (error) {}
    return chosen;
  }

  // ------------------------------------------------------- Generic menu sites

  function looksLikeSettingsControl(element) {
    if (!element) return false;
    const label = [
      attributeOf(element, "aria-label"),
      attributeOf(element, "title"),
      attributeOf(element, "data-testid"),
      attributeOf(element, "data-a-target"),
      textOf(element),
    ].filter(Boolean).join(" ");
    if (!label) return false;
    if (/\d{3,4}\s*p\b/i.test(label)) return false;
    if (/^auto(\s*\(|\s*$)/i.test(label)) return false;
    return /setting|gear|preference|options|quality/i.test(label);
  }

  function findPlayerRoot(video) {
    if (!video) return typeof document !== "undefined" ? document.body : null;
    let node = video.parentElement;
    for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
      try {
        if (typeof node.querySelector === "function" && node.querySelector(SETTINGS_SELECTOR)) return node;
      } catch (error) {}
      const testId = attributeOf(node, "data-testid");
      if (/video.?player|player.?container/i.test(testId)) return node;
    }
    return video.parentElement || (typeof document !== "undefined" ? document.body : null);
  }

  function findSettingsButton(video, root) {
    const scopes = [];
    if (root && typeof root.querySelectorAll === "function") scopes.push(root);
    if (typeof document.querySelectorAll === "function" && scopes.indexOf(document) < 0) scopes.push(document);

    for (const scope of scopes) {
      let candidates = [];
      try {
        candidates = Array.prototype.slice.call(scope.querySelectorAll(SETTINGS_SELECTOR));
      } catch (error) {
        candidates = [];
      }
      const match = candidates.find(function (element) {
        return isVisible(element) && overlapsVideo(element, video) && looksLikeSettingsControl(element);
      });
      if (match) return match;
    }

    if (typeof document.querySelectorAll !== "function") return null;
    let labelled = [];
    try {
      labelled = Array.prototype.slice.call(document.querySelectorAll("[aria-label], [title]"));
    } catch (error) {
      labelled = [];
    }
    return labelled.find(function (element) {
      return isVisible(element) && overlapsVideo(element, video) && looksLikeSettingsControl(element);
    }) || null;
  }

  function revealControls(video) {
    if (!video || typeof MouseEvent === "undefined") return;
    const targets = [video];
    if (video.parentElement) targets.push(video.parentElement);

    let x = 0;
    let y = 0;
    try {
      const rect = video.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } catch (error) {}

    for (const target of targets) {
      for (const type of ["pointermove", "mousemove", "mouseover"]) {
        try {
          target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
        } catch (error) {}
      }
    }
  }

  function clickElement(element) {
    if (!element) return false;
    try {
      if (typeof element.click === "function") {
        element.click();
        return true;
      }
    } catch (error) {}
    try {
      if (typeof MouseEvent === "undefined") return false;
      const rect = element.getBoundingClientRect();
      element.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: typeof window !== "undefined" ? window : null,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }));
      return true;
    } catch (error) {
      return false;
    }
  }

  function pointerSequence(element) {
    if (!element || typeof MouseEvent === "undefined") return false;
    try {
      const rect = element.getBoundingClientRect();
      const options = {
        bubbles: true,
        cancelable: true,
        view: typeof window !== "undefined" ? window : null,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        button: 0,
      };
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
        try { element.dispatchEvent(new MouseEvent(type, options)); } catch (error) {}
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function hoverElement(element) {
    if (!element || typeof MouseEvent === "undefined") return false;
    try {
      const rect = element.getBoundingClientRect();
      const options = {
        bubbles: true,
        cancelable: true,
        view: typeof window !== "undefined" ? window : null,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      };
      for (const type of ["pointerover", "pointermove", "mouseover", "mousemove"]) {
        try { element.dispatchEvent(new MouseEvent(type, options)); } catch (error) {}
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function isAutoLabel(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (!value) return false;
    // Facebook says "Automatic", YouTube says "Auto", others use "Auto (recommended)".
    return /^auto(matic)?\b/i.test(value);
  }

  function isQualityRow(text) {
    // Facebook combines the row label with its current value and may render the
    // label/value in adjacent spans ("Quality" + "Automatic 1080p" -> "QualityAutomatic 1080p").
    // That whole row is the submenu trigger, not a selectable quality option.
    return /^quality/i.test(text) ||
      /video\s*quality/i.test(text) ||
      /\bquality\s*[:\-–—]/i.test(text);
  }

  function collectMenuEntries(video, allowLoose) {
    const entries = [];
    const seen = [];

    function add(element) {
      if (!element || seen.indexOf(element) >= 0) return;
      if (!isVisible(element)) return;
      const text = textOf(element);
      if (!text || text.length > 120) return;
      const isQuality = isQualityRow(text);
      const isAuto = !isQuality && isAutoLabel(text);
      const height = isQuality ? 0 : parseQualityHeight(text);
      if (!height && !isAuto && !isQuality) return;
      seen.push(element);
      entries.push({ element, text, height, isAuto, isQuality });
    }

    let scopes = [];
    if (typeof document.querySelectorAll === "function") {
      try {
        scopes = Array.prototype.slice.call(document.querySelectorAll(MENU_SCOPE_SELECTOR)).filter(isVisible);
      } catch (error) {
        scopes = [];
      }
    }

    for (const scope of scopes) {
      try {
        scope.querySelectorAll(MENU_ITEM_SELECTOR).forEach(add);
      } catch (error) {}
    }

    if (!entries.length && typeof document.querySelectorAll === "function") {
      try {
        document.querySelectorAll(MENU_ITEM_STRICT_SELECTOR).forEach(add);
      } catch (error) {}
    }

    if (!entries.length && typeof document.querySelectorAll === "function") {
      try {
        document.querySelectorAll('button, a, [role="button"]').forEach(add);
      } catch (error) {}
    }

    // Facebook does not always expose roles/tabindex on player menu rows, so
    // once a menu is known to be open fall back to matching visible text.
    if (allowLoose && video) {
      for (const entry of collectLooseEntries(video)) {
        if (seen.indexOf(entry.element) >= 0) continue;
        seen.push(entry.element);
        entries.push(entry);
      }
    }

    return dropNestedQualityValues(entries);
  }

  // "Quality Automatic 1080p" contains a value that looks like a separate Auto
  // option. Drop anything nested inside a Quality row so it cannot be selected.
  function dropNestedQualityValues(entries) {
    const qualityElements = entries
      .filter(function (entry) { return entry.isQuality; })
      .map(function (entry) { return entry.element; });
    if (!qualityElements.length) return entries;

    return entries.filter(function (entry) {
      if (entry.isQuality) return true;
      return !qualityElements.some(function (qualityElement) {
        if (qualityElement === entry.element) return false;
        return typeof qualityElement.contains === "function" && qualityElement.contains(entry.element);
      });
    });
  }

  function collectLooseEntries(video) {
    const entries = [];
    const seen = [];
    const root = document.body || document.documentElement;
    if (!root || typeof document.createTreeWalker !== "function") return entries;

    let walker;
    try {
      walker = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, null);
    } catch (error) {
      return entries;
    }

    let node;
    let visited = 0;
    while (visited < 20000 && (node = walker.nextNode())) {
      visited += 1;
      const raw = node.nodeValue;
      if (!raw || raw.length > 80) continue;
      const trimmed = raw.replace(/\s+/g, " ").trim();
      if (!trimmed) continue;
      if (!isQualityRow(trimmed) && !isAutoLabel(trimmed) && !parseQualityHeight(trimmed)) continue;

      const element = rowFromTextNode(node);
      if (!element || seen.indexOf(element) >= 0) continue;
      if (!isVisible(element) || !overlapsVideo(element, video)) continue;

      const text = textOf(element);
      if (!text || text.length > 120) continue;
      const isQuality = isQualityRow(text);
      const isAuto = !isQuality && isAutoLabel(text);
      const height = isQuality ? 0 : parseQualityHeight(text);
      if (!height && !isAuto && !isQuality) continue;

      seen.push(element);
      entries.push({ element, text, height, isAuto, isQuality });
    }

    return dropNestedQualityValues(entries);
  }

  function rowFromTextNode(node) {
    // The text itself is usually inside the row or inside a label span that
    // bubbles its click to the row, so the immediate element is the right click
    // target. Never climb to a container whose text includes other rows.
    let element = node && node.parentElement;
    for (let depth = 0; element && depth < 3; depth += 1, element = element.parentElement) {
      let text = "";
      try { text = textOf(element); } catch (error) { text = ""; }
      if (!text) continue;
      if (text.length <= 120) return element;
      break;
    }
    return null;
  }

  function menuOptions(entries) {
    return entries.filter(function (entry) {
      return !entry.isQuality && (entry.isAuto || entry.height > 0);
    });
  }

  function chooseMenuOption(entries, settings) {
    const options = menuOptions(entries);
    if (!options.length) return null;

    if (settings.quality === "auto") {
      return options.find(function (entry) { return entry.isAuto; }) || null;
    }

    const specific = options.filter(function (entry) { return !entry.isAuto && entry.height > 0; });
    if (!specific.length) return null;

    const height = pickHeight(specific.map(function (entry) { return entry.height; }), settings.quality, settings.fallback);
    if (!height) return null;

    return specific.find(function (entry) { return entry.height === height; }) || null;
  }

  function closeMenu() {
    if (typeof KeyboardEvent === "undefined") return;
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      }));
    } catch (error) {}
  }

  async function applyViaMenu(video, settings) {
    const known = isKnownMenuSite();
    let entries = collectMenuEntries();

    async function openQualitySubmenu() {
      let qualityItem = entries.find(function (entry) { return entry.isQuality; });
      if (!qualityItem) {
        const loose = collectLooseEntries(video);
        qualityItem = loose.find(function (entry) { return entry.isQuality; });
        if (qualityItem) entries = loose;
      }
      if (!qualityItem) return false;

      const findOptions = function () {
        const found = collectMenuEntries(video, true);
        return menuOptions(found).length ? found : null;
      };

      clickElement(qualityItem.element);
      let submenu = await waitFor(findOptions, known ? 2200 : 1000, 120);
      if (!submenu && pointerSequence(qualityItem.element)) {
        submenu = await waitFor(findOptions, known ? 1500 : 800, 120);
      }
      if (!submenu && hoverElement(qualityItem.element)) {
        submenu = await waitFor(findOptions, 1000, 120);
      }
      entries = submenu || collectMenuEntries(video, true);
      return menuOptions(entries).length > 0;
    }

    let options = menuOptions(entries);
    if (!options.length) await openQualitySubmenu();
    options = menuOptions(entries);

    if (!options.length) {
      const root = findPlayerRoot(video);
      let button = null;
      const deadline = now() + (known ? 3500 : 1200);

      while (now() < deadline) {
        revealControls(video);
        button = findSettingsButton(video, root);
        if (button) break;
        await sleep(200);
      }
      if (!button) return null;
      if (!clickElement(button)) return null;

      const opened = function () {
        const found = collectMenuEntries(video, true);
        const foundOptions = menuOptions(found);
        return foundOptions.length || found.some(function (entry) { return entry.isQuality; }) ? found : null;
      };

      entries = await waitFor(opened, known ? 2200 : 1000, 120) || collectMenuEntries(video, true);

      if (!entries.length && pointerSequence(button)) {
        entries = await waitFor(opened, known ? 1500 : 800, 120) || collectMenuEntries(video, true);
      }

      options = menuOptions(entries);
      if (!options.length) await openQualitySubmenu();
      options = menuOptions(entries);
    }

    if (!options.length) {
      closeMenu();
      return null;
    }

    const chosen = chooseMenuOption(entries, settings);
    if (!chosen) {
      closeMenu();
      return null;
    }

    const alreadySelected = chosen.element.checked === true ||
      attributeOf(chosen.element, "aria-checked") === "true" ||
      attributeOf(chosen.element, "aria-selected") === "true" ||
      attributeOf(chosen.element, "aria-pressed") === "true";

    if (!alreadySelected) {
      if (!clickElement(chosen.element)) {
        closeMenu();
        return null;
      }
      await sleep(160);
      // Some players ignore a synthetic click on a menu row; retry with a
      // full pointer sequence if the menu is still showing options.
      const stillOpen = collectMenuEntries(video, true).some(function (entry) {
        return entry.height > 0 || entry.isAuto;
      });
      if (stillOpen && pointerSequence(chosen.element)) await sleep(160);
    }

    if (collectMenuEntries(video, true).some(function (entry) { return entry.height > 0 || entry.isAuto; })) closeMenu();

    if (settings.quality === "auto") return "auto";
    return chosen.height ? chosen.height + "p" : chosen.text;
  }

  // ------------------------------------------------------------ apply pipeline

  function applyVideo(video, settings, force) {
    if (!video || video.tagName !== "VIDEO") return Promise.resolve(null);
    if (!settings || settings.quality === "auto") return Promise.resolve(null);

    if (isYouTube()) {
      if (wasApplied(video, settings, force)) return Promise.resolve(null);
      const result = applyYouTubePage(settings);
      if (result === "pending") return Promise.resolve(null);
      if (result) {
        markApplied(video, settings);
        return Promise.resolve(result);
      }
    }

    if (wasApplied(video, settings, force)) return Promise.resolve(null);
    if (applying.has(video)) return Promise.resolve(null);

    applying.add(video);
    return applyViaMenu(video, settings)
      .then(function (result) {
        if (result) markApplied(video, settings);
        return result;
      })
      .catch(function () { return null; })
      .then(function (result) {
        applying.delete(video);
        return result;
      });
  }

  function visibleArea(video) {
    try {
      const rect = video.getBoundingClientRect();
      const width = typeof window !== "undefined" ? window.innerWidth || 0 : 0;
      const height = typeof window !== "undefined" ? window.innerHeight || 0 : 0;
      const visibleWidth = Math.max(0, Math.min(rect.right, width) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0));
      return visibleWidth * visibleHeight;
    } catch (error) {
      return 0;
    }
  }

  function activeVideos() {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return [];
    const videos = listVideos().filter(isOnScreen);
    if (videos.length <= 1) return videos;
    videos.sort(function (a, b) { return visibleArea(b) - visibleArea(a); });
    return videos.slice(0, 1);
  }

  function applyAll(force) {
    const settings = state.settings;
    if (!settings) return Promise.resolve(null);

    if (isYouTube()) {
      const youtubeResult = applyYouTubePage(settings);
      if (youtubeResult === "pending") return Promise.resolve(null);
      if (youtubeResult) return Promise.resolve(youtubeResult);
    }

    if (settings.quality === "auto") return Promise.resolve(null);

    const videos = activeVideos();
    if (!videos.length) return Promise.resolve(null);

    return Promise.all(videos.map(function (video) {
      return applyVideo(video, settings, force === true);
    })).then(function (results) {
      for (const result of results) if (result) return result;
      return null;
    });
  }

  function apply(settings) {
    if (settings) setSettings(settings, { apply: false });
    if (!state.settings) setSettings(DEFAULT_SETTINGS, { apply: false });
    scheduleRetries();
    return applyAll(true);
  }

  function setSettings(input, options) {
    const next = normalizeSettings(input);
    if (!next) return null;

    const previous = state.settings;
    state.settings = next;
    try { window.__zedVideoQualitySettings = next; } catch (error) {}

    const changed = !previous || previous.quality !== next.quality || previous.fallback !== next.fallback;
    if (changed && (!options || options.apply !== false)) {
      scheduleRetries();
      void applyAll(true);
    }
    return next;
  }

  // A video can already be playing before this content script attaches, so the
  // media events we rely on may have fired. Retry a few times on sites that
  // expose a quality menu, but stop as soon as the quality is applied.
  let retriesScheduled = false;

  function scheduleRetries() {
    if (retriesScheduled) return;
    if (!isKnownMenuSite() && !isYouTube()) return;
    retriesScheduled = true;
    [1500, 4000, 9000].forEach(function (delay) {
      setTimeout(function () {
        if (!state.settings || state.settings.quality === "auto") return;
        void applyAll(false);
      }, delay);
    });
  }

  // --------------------------------------------------------------- wire events

  let lastNavigationSignature = "";

  function navigationSignature() {
    try {
      return String(location.href || "");
    } catch (error) {
      return "";
    }
  }

  function onNavigation() {
    if (!state.settings) return;
    if (navigationTimer) clearTimeout(navigationTimer);
    const signature = navigationSignature();
    navigationTimer = setTimeout(function () {
      navigationTimer = null;
      if (signature && signature === lastNavigationSignature) return;
      lastNavigationSignature = signature;
      void applyAll(true);
    }, 350);
  }

  function onMediaEvent(event) {
    const target = event && event.target;
    if (!target || target.tagName !== "VIDEO") return;
    if (event.type === "emptied" || event.type === "loadstart") appliedStates.delete(target);
    if (!state.settings || state.settings.quality === "auto") return;
    if (!isOnScreen(target)) return;
    void applyVideo(target, state.settings, false);
  }

  function onSettingsMessage(event) {
    let detail = event && event.detail;
    if (typeof detail === "string") {
      try { detail = JSON.parse(detail); } catch (error) { return; }
    }
    if (detail) setSettings(detail);
  }

  // Facebook Reels and the feed swap the active video while scrolling without
  // always firing a load event, so re-check after scroll settles.
  let scrollTimer = null;

  function onScroll() {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      scrollTimer = null;
      if (!state.settings || state.settings.quality === "auto") return;
      void applyAll(false);
    }, 600);
  }

  function patchHistory() {
    try {
      if (typeof history === "undefined" || !history || history.__zedVideoQualityPatched) return;
      history.__zedVideoQualityPatched = true;
      ["pushState", "replaceState"].forEach(function (name) {
        const original = history[name];
        if (typeof original !== "function") return;
        history[name] = function () {
          const result = original.apply(this, arguments);
          setTimeout(onNavigation, 0);
          return result;
        };
      });
    } catch (error) {}
  }

  function readSettingsAttribute() {
    try {
      const root = document.documentElement;
      if (!root || typeof root.getAttribute !== "function") return null;
      const raw = root.getAttribute("data-zed-video-quality");
      if (!raw) return null;
      return normalizeSettings(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function observeAttribute() {
    try {
      if (typeof MutationObserver === "undefined") return;
      const root = document.documentElement;
      if (!root) return;
      const observer = new MutationObserver(function () {
        const next = readSettingsAttribute();
        if (next) setSettings(next);
      });
      observer.observe(root, { attributes: true, attributeFilter: ["data-zed-video-quality"] });
    } catch (error) {}
  }

  function install() {
    if (state.installed) return;
    state.installed = true;

    try {
      if (typeof document.addEventListener === "function") {
        ["play", "playing", "loadedmetadata", "loadstart", "durationchange", "emptied", "canplay"].forEach(function (type) {
          document.addEventListener(type, onMediaEvent, true);
        });
        document.addEventListener("yt-navigate-finish", onNavigation, true);
        document.addEventListener("yt-page-data-updated", onNavigation, true);
        document.addEventListener("zed-video-quality-changed", onSettingsMessage, false);
        document.addEventListener("popstate", onNavigation, true);
        document.addEventListener("hashchange", onNavigation, true);
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible" && state.settings) void applyAll(false);
        }, false);
        document.addEventListener("scroll", onScroll, true);
      }
    } catch (error) {}

    try {
      if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("popstate", onNavigation, true);
        window.addEventListener("hashchange", onNavigation, true);
        window.addEventListener("scroll", onScroll, true);
      }
    } catch (error) {}

    patchHistory();
    observeAttribute();
  }

  // -------------------------------------------------------------------- bootstrap

  if (window.__zedVideoQualityEngine) {
    const manual = normalizeSettings(window.__zedVideoQualitySettings);
    return window.__zedVideoQualityEngine.apply(manual || undefined);
  }

  install();

  try {
    window.__zedVideoQualityEngine = {
      apply: apply,
      applyAll: applyAll,
      setSettings: setSettings,
      getSettings: function () { return state.settings; },
      version: 2,
    };
  } catch (error) {}

  const initial = normalizeSettings(window.__zedVideoQualitySettings) || readSettingsAttribute();
  if (initial) return apply(initial);

  return Promise.resolve(null);
})();
