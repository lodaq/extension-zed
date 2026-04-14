// Hides the main progress bar and time display on youtube.com/watch (DOM may change).
(function () {
  var KEY = "__extensionZedYoutubeProgressBar";
  if (window[KEY]) return;
  window[KEY] = true;

  const hide = () => {
    document
      .querySelectorAll(
        ".ytp-progress-bar-container, .ytp-time-display, .ytp-chapter-container"
      )
      .forEach((el) => {
        el.style.setProperty("display", "none", "important");
      });
  };

  hide();
  const obs = new MutationObserver(hide);
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
