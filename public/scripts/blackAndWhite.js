(() => {
  const style = document.createElement("style");
  style.textContent = "html{filter:grayscale(1)!important}";
  const apply = (enabled) => {
    if (enabled === true) document.documentElement.append(style);
    else style.remove();
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.blackAndWhite) apply(changes.blackAndWhite.newValue);
  });
  chrome.storage.local.get("blackAndWhite").then((settings) => apply(settings.blackAndWhite));
})();
