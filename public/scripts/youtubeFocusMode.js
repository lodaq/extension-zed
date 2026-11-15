(function () {
  if (location.hostname !== "youtube.com" && !location.hostname.endsWith(".youtube.com")) {
    throw new Error("Focus mode requires a YouTube page");
  }

  const enabled = window.__zedYoutubeFocusEnabled;
  delete window.__zedYoutubeFocusEnabled;

  if (!enabled) {
    window.__extensionZedYtFocusAbortController?.abort();
    window.__extensionZedYtFocusAbortController = undefined;
    document.documentElement.classList.remove("extension-zed-yt-focus-lock");
    document.getElementById("extension-zed-yt-focus-base")?.remove();
    document.querySelectorAll("[data-zed-focus-hidden]").forEach((node) => {
      node.removeAttribute("data-zed-focus-hidden");
    });
    const anchor = document.querySelector("[data-zed-focus-anchor]");
    if (anchor) {
      anchor.removeAttribute("data-zed-focus-anchor");
      anchor.removeAttribute("data-zed-focus-fs-suspended");
    }
    window.dispatchEvent(new Event("resize"));
    return;
  }

  const anchor = [
    "ytd-watch-flexy ytd-player#ytd-player", "ytd-watch-flexy ytd-player", "ytd-player#ytd-player",
    "ytd-watch-flexy #player-full-bleed-container", "#player-full-bleed-container", "ytd-player",
  ].reduce((found, selector) => found || document.querySelector(selector), null)
    || document.querySelector("video.html5-main-video")?.closest("#movie_player");

  if (!anchor) throw new Error("No YouTube player was found on this page");

  window.__extensionZedYtFocusAbortController?.abort();
  const ac = new AbortController();
  window.__extensionZedYtFocusAbortController = ac;
  const { signal } = ac;

  document.getElementById("extension-zed-yt-focus-base")?.remove();

  anchor.setAttribute("data-zed-focus-anchor", "1");
  document.documentElement.classList.add("extension-zed-yt-focus-lock");

  const base = document.createElement("style");
  base.id = "extension-zed-yt-focus-base";
  base.textContent = `
    html.extension-zed-yt-focus-lock,
    html.extension-zed-yt-focus-lock body {
      overflow: hidden !important;
      margin: 0 !important;
      background: #000 !important;
      max-width: 100% !important;
    }
    body::-webkit-scrollbar { display: none; }
    body { scrollbar-width: none; }
    [data-zed-focus-hidden="1"] {
      display: none !important;
    }
    [data-zed-focus-anchor="1"]:not([data-zed-focus-fs-suspended="1"]) {
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      background: #000 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    }
  `;
  (document.head || document.documentElement).appendChild(base);

  function onFullscreenChange() {
    if (document.querySelector("[data-zed-focus-anchor]") !== anchor) return;
    const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    document.documentElement.classList[fullscreen ? "remove" : "add"]("extension-zed-yt-focus-lock");
    if (fullscreen) anchor.setAttribute("data-zed-focus-fs-suspended", "1");
    else {
      anchor.removeAttribute("data-zed-focus-fs-suspended");
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }
  }

  document.addEventListener("fullscreenchange", onFullscreenChange, { signal });
  document.addEventListener("webkitfullscreenchange", onFullscreenChange, { signal });

  anchor.removeAttribute("data-zed-focus-fs-suspended");

  let el = anchor;
  while (el && el !== document.documentElement) {
    const parent = el.parentElement;
    if (!parent) break;
    for (const child of parent.children) {
      if (child !== el && !child.hasAttribute("data-zed-focus-hidden")) child.setAttribute("data-zed-focus-hidden", "1");
    }
    el = parent;
  }

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    document.documentElement.classList.remove("extension-zed-yt-focus-lock");
    anchor.setAttribute("data-zed-focus-fs-suspended", "1");
  }

  function extensionZedKickYoutubeVideo() {
    window.dispatchEvent(new Event("resize"));
    const v = document.querySelector("video.html5-main-video");
    if (!v) return;
    if (!v.paused) {
      v.pause();
      setTimeout(() => {
        void v.play().catch(() => {});
        window.dispatchEvent(new Event("resize"));
      }, 0);
    } else {
      const t = v.currentTime;
      if (!Number.isNaN(t)) {
        v.currentTime = t + 0.0001;
        v.currentTime = t;
      }
      window.dispatchEvent(new Event("resize"));
    }
  }

  requestAnimationFrame(() => {
    extensionZedKickYoutubeVideo();
    setTimeout(extensionZedKickYoutubeVideo, 120);
  });
})();
