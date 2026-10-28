// Applies or removes a Zed-owned style based on the persisted toggle.
(function () {
  const ID = "zed-youtube-progress-bar";
  chrome.storage.local.get(["youtubeHideProgress"]).then(({ youtubeHideProgress }) => {
    document.getElementById(ID)?.remove();
    if (!youtubeHideProgress) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = ".ytp-progress-bar-container, .ytp-time-display, .ytp-chapter-container { display: none !important; }";
    (document.head || document.documentElement).appendChild(style);
  });
})();
