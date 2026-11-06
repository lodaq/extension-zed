(function () {
  "use strict";

  const STORAGE_KEYS = ["videoQuality", "videoQualityFallback"];
  const QUALITY_IDS = ["auto", "highres", "hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];

  function publish(settings) {
    let value;
    try {
      const quality = QUALITY_IDS.indexOf(settings.videoQuality) >= 0 ? settings.videoQuality : "hd1080";
      value = JSON.stringify({
        quality,
        fallback: settings.videoQualityFallback === "higher" ? "higher" : "lower",
      });
    } catch (error) {
      return;
    }

    try {
      const root = document.documentElement;
      if (root && typeof root.setAttribute === "function") {
        root.setAttribute("data-zed-video-quality", value);
      }
    } catch (error) {}

    try {
      document.dispatchEvent(new CustomEvent("zed-video-quality-changed", { detail: value }));
    } catch (error) {}
  }

  function load() {
    try {
      chrome.storage.local.get(STORAGE_KEYS, publish);
    } catch (error) {}
  }

  load();

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;
      if (changes.videoQuality || changes.videoQualityFallback) load();
    });
  } catch (error) {}
})();
