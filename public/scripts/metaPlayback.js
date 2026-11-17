(function () {
  "use strict";
  if (window.__zedMetaControllerFor || !/(^|\.)(facebook|instagram)\.com$/i.test(window.location && window.location.hostname || "")) return;
  const metaControllers = new WeakMap();
  const shadowRoots = new WeakSet();
  let speed = null;
  function metaController(video) {
    function match(value) {
      if (value && (typeof value.setPlaybackRate === "function" || typeof value.selectVideoQuality === "function") && typeof value.getCurrentState === "function" &&
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
  window.__zedMetaControllerFor = metaController;
  function apply(video) {
    if (speed === null) return;
    try {
      const controller = metaController(video);
      if (!controller || typeof controller.setPlaybackRate !== "function") return;
      if (typeof controller.isFrozen === "function" && controller.isFrozen()) return;
      const state = controller.getCurrentState();
      if (state && state.targetPlaybackRate !== speed) controller.setPlaybackRate(speed);
    } catch (error) {}
  }
  function applyAll(root = document) {
    for (const video of root.querySelectorAll("video")) apply(video);
    for (const node of root.querySelectorAll("*")) {
      if (node.shadowRoot) {
        if (!shadowRoots.has(node.shadowRoot)) {
          shadowRoots.add(node.shadowRoot);
          observer?.observe(node.shadowRoot, { childList: true, subtree: true });
          for (const type of MEDIA_EVENTS) node.shadowRoot.addEventListener(type, onMedia, true);
        }
        applyAll(node.shadowRoot);
      }
    }
  }
  function setSpeed(value) {
    const next = Number(value);
    speed = Number.isFinite(next) && next >= 0.1 && next <= 10 ? Math.round(next * 10) / 10 : null;
    applyAll();
  }
  document.addEventListener("zed-playback-speed-changed", event => setSpeed(event.detail));
  function onMedia(event) {
    if (event.target && event.target.tagName === "VIDEO") apply(event.target);
  }
  const MEDIA_EVENTS = ["loadedmetadata", "canplay", "play", "playing"];
  for (const type of MEDIA_EVENTS) document.addEventListener(type, onMedia, true);
  const observer = typeof MutationObserver !== "undefined" ? new MutationObserver(records => {
    if (records.some(record => record.type === "attributes")) setSpeed(document.documentElement.getAttribute("data-zed-playback-speed"));
    else if (records.some(record => record.addedNodes.length)) applyAll();
  }) : null;
  if (document.documentElement) {
    observer?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-zed-playback-speed"] });
    setSpeed(document.documentElement.getAttribute("data-zed-playback-speed"));
  }
})();
