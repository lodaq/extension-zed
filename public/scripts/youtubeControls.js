(function () {
  const ID = "zed-youtube-controls";
  return chrome.storage.local.get(["youtubeHideControls"]).then(({ youtubeHideControls }) => {
    document.getElementById(ID)?.remove();
    if (youtubeHideControls !== true) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = ".ytp-chrome-bottom { display: none !important; }";
    (document.head || document.documentElement).appendChild(style);
  });
})();
