(function () {
  const ID = "zed-youtube-progress-bar";
  return chrome.storage.local.get(["youtubeHideProgress"]).then(({ youtubeHideProgress }) => {
    document.getElementById(ID)?.remove();
    if (youtubeHideProgress !== true) return;
    const style = document.createElement("style");
    style.id = ID;
    // Resilient multi-variant selector list covering desktop, mobile web, theater, and player experiments
    style.textContent = `
      .ytp-progress-bar-container,
      .ytp-progress-bar,
      #progress-bar,
      ytd-player .ytp-progress-bar-container,
      .ytp-chapter-container {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  });
})();
