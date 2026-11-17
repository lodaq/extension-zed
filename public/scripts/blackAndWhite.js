(() => {
  if (!globalThis.__zedBlackAndWhiteState) {
    const css = "html{filter:grayscale(1)!important}";
    const style = document.getElementById("zed-black-and-white")
      || [...document.querySelectorAll("style")].find(node => node.textContent === css)
      || document.createElement("style");
    style.id = "zed-black-and-white";
    style.textContent = css;
    const state = {
      revision: 0,
      apply(enabled) {
        if (enabled === true) document.documentElement.append(style);
        else style.remove();
      },
    };
    globalThis.__zedBlackAndWhiteState = state;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.blackAndWhite) return;
      state.revision++;
      state.apply(changes.blackAndWhite.newValue);
    });
  }
  const state = globalThis.__zedBlackAndWhiteState;
  const revision = state.revision;
  return chrome.storage.local.get("blackAndWhite").then((settings) => {
    if (state.revision === revision) state.apply(settings.blackAndWhite);
  }).catch(console.error);
})();
