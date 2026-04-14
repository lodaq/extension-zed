(function () {
  if (!location.hostname.endsWith("youtube.com")) return;

  window.__extensionZedYtFocusAbortController?.abort();
  window.__extensionZedYtFocusAbortController = undefined;
  document.documentElement.classList.remove("extension-zed-yt-focus-lock");

  document.getElementById("extension-zed-yt-focus-base")?.remove();

  document.querySelectorAll("[data-zed-focus-hidden]").forEach((node) => {
    node.removeAttribute("data-zed-focus-hidden");
    node.style.removeProperty("display");
  });

  const anchor = document.querySelector("[data-zed-focus-anchor]");
  if (anchor) {
    [
      "position",
      "inset",
      "z-index",
      "background",
      "width",
      "height",
      "max-width",
      "margin",
      "box-sizing",
    ].forEach((p) => anchor.style.removeProperty(p));
    anchor.removeAttribute("data-zed-focus-anchor");
    anchor.removeAttribute("data-zed-focus-fs-suspended");
  }

  const video = document.querySelector("video.html5-main-video");
  if (video) {
    ["max-width", "max-height", "width", "height", "object-fit"].forEach((p) =>
      video.style.removeProperty(p)
    );
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
