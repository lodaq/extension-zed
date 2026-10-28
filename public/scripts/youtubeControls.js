// Applies or removes the complete bottom control strip on YouTube players.
(function () {
  const ID = "zed-youtube-controls";
  chrome.storage.local.get(["youtubeHideControls"]).then(({ youtubeHideControls }) => {
    document.getElementById(ID)?.remove();
    if (!youtubeHideControls) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = ".ytp-chrome-bottom { display: none !important; }";
    (document.head || document.documentElement).appendChild(style);
  });
})();
