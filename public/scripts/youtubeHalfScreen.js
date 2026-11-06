(function () {
  const ID = "zed-youtube-half-screen";
  document.getElementById(ID)?.remove();

  return chrome.storage.local.get({ youtubeHalfScreen: false }).then((settings) => {
    if (!settings.youtubeHalfScreen) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = `
      ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
        max-width: 100% !important;
        min-width: 0 !important;
      }
      ytd-watch-flexy[flexy] #player-container-outer.ytd-watch-flexy {
        max-width: 100% !important;
      }
      #secondary.ytd-watch-flexy {
        width: 100% !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  });
})();
