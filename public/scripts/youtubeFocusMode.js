(function () {
  if (!location.hostname.endsWith("youtube.com")) return;

  const anchor =
    document.querySelector("ytd-watch-flexy ytd-player#ytd-player") ||
    document.querySelector("ytd-watch-flexy ytd-player") ||
    document.querySelector("ytd-player#ytd-player") ||
    document.querySelector("ytd-watch-flexy #player-full-bleed-container") ||
    document.querySelector("#player-full-bleed-container") ||
    document.querySelector("ytd-player") ||
    (document.querySelector("video.html5-main-video") &&
      document.querySelector("video.html5-main-video").closest("#movie_player"));

  if (!anchor) return;

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
  `;
  document.head.appendChild(base);

  const ANCHOR_PROPS = [
    "position",
    "inset",
    "z-index",
    "background",
    "width",
    "height",
    "max-width",
    "margin",
    "box-sizing",
  ];

  function applyAnchorChrome() {
    anchor.style.setProperty("position", "fixed", "important");
    anchor.style.setProperty("inset", "0", "important");
    anchor.style.setProperty("z-index", "2147483646", "important");
    anchor.style.setProperty("background", "#000", "important");
    anchor.style.setProperty("width", "100vw", "important");
    anchor.style.setProperty("height", "100vh", "important");
    anchor.style.setProperty("max-width", "none", "important");
    anchor.style.setProperty("margin", "0", "important");
    anchor.style.setProperty("box-sizing", "border-box", "important");
    anchor.removeAttribute("data-zed-focus-fs-suspended");
  }

  function clearAnchorChrome() {
    ANCHOR_PROPS.forEach((p) => anchor.style.removeProperty(p));
    anchor.setAttribute("data-zed-focus-fs-suspended", "1");
  }

  function focusAnchorStillActive() {
    return document.querySelector("[data-zed-focus-anchor]") === anchor;
  }

  function onFullscreenChange() {
    if (!focusAnchorStillActive()) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs) {
      document.documentElement.classList.remove("extension-zed-yt-focus-lock");
      clearAnchorChrome();
    } else {
      document.documentElement.classList.add("extension-zed-yt-focus-lock");
      applyAnchorChrome();
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    }
  }

  document.addEventListener("fullscreenchange", onFullscreenChange, { signal });
  document.addEventListener("webkitfullscreenchange", onFullscreenChange, { signal });

  applyAnchorChrome();

  let el = anchor;
  while (el && el !== document.documentElement) {
    const parent = el.parentElement;
    if (!parent) break;
    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i];
      if (child !== el) {
        if (!child.hasAttribute("data-zed-focus-hidden")) {
          child.setAttribute("data-zed-focus-hidden", "1");
          child.style.setProperty("display", "none", "important");
        }
      }
    }
    el = parent;
  }

  if (document.fullscreenElement || document.webkitFullscreenElement) {
    document.documentElement.classList.remove("extension-zed-yt-focus-lock");
    clearAnchorChrome();
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
