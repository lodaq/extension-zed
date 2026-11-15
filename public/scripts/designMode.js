(function () {
  const key = "__zedDesignModeInst";
  if (typeof window[key]?.cleanup === "function") window[key].cleanup();
  delete window[key];

  function apply(on) {
    const setMode = (enabled) => {
      try { document.designMode = enabled ? "on" : "off"; } catch { /* The page may disallow editing. */ }
    };
    setMode(on);
    if (!on) return;
    const ensure = () => { try { if (document.designMode !== "on") setMode(true); } catch { /* Editing may be blocked. */ } };
    const events = [[window, "focus", false], [document, "visibilitychange", false], [document, "pointerdown", true]];
    for (const [target, event, capture] of events) target.addEventListener(event, ensure, capture);
    window[key] = { cleanup() {
      for (const [target, event, capture] of events) target.removeEventListener(event, ensure, capture);
      setMode(false);
    } };
  }

  if (typeof window.__zedDesignModeFlag === "boolean") {
    const on = window.__zedDesignModeFlag;
    delete window.__zedDesignModeFlag;
    apply(on);
  } else if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return chrome.storage.local.get("designMode").then(result => apply(String(result?.designMode).toLowerCase() === "on"));
  } else apply(false);
})();
