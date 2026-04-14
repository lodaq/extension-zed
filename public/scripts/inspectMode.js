(function () {
  const CLEANUP_KEY = "__zedInspectModeCleanup";

  const prev = window[CLEANUP_KEY];
  if (typeof prev === "function") {
    prev();
    delete window[CLEANUP_KEY];
  }

  chrome.storage.local.get(["inspectMode"]).then((r) => {
    const on = String(r?.inspectMode).toLowerCase() === "on";
    if (!on) return;

    let highlighted = null;

    function clearHighlight() {
      if (highlighted) {
        highlighted.style.removeProperty("outline");
        highlighted.style.removeProperty("outline-offset");
        highlighted = null;
      }
    }

    function onMove(e) {
      const t = e.target;
      if (!t || t.nodeType !== Node.ELEMENT_NODE) return;
      if (t === highlighted) return;
      clearHighlight();
      highlighted = t;
      t.style.setProperty("outline", "2px solid rgb(239 68 68)", "important");
      t.style.setProperty("outline-offset", "2px", "important");
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        void chrome.storage.local.set({ inspectMode: "off" });
      }
    }

    function cleanup() {
      clearHighlight();
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("keydown", onKey, true);
      chrome.storage.onChanged.removeListener(onStorage);
    }

    function onStorage(changes, area) {
      if (area !== "local" || !changes.inspectMode) return;
      const v = changes.inspectMode.newValue;
      if (String(v).toLowerCase() !== "on") {
        cleanup();
        delete window[CLEANUP_KEY];
      }
    }

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("keydown", onKey, true);
    chrome.storage.onChanged.addListener(onStorage);

    window[CLEANUP_KEY] = cleanup;
  });
})();
