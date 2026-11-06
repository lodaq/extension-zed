(function () {
  const ID = "zed-youtube-duration";
  document.getElementById(ID)?.remove();

  return chrome.storage.local.get({ youtubeHideDuration: false }).then((settings) => {
    if (!settings.youtubeHideDuration) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = `
      .ytp-time-display,
      .ytp-time-duration,
      .ytp-time-current,
      .ytp-time-separator,
      .ytp-chapter-container {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  });
})();
