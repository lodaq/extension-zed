(function () {
  const KEY = "__zedDesignModeInst";

  const prev = window[KEY];
  if (prev && typeof prev.cleanup === "function") {
    prev.cleanup();
    delete window[KEY];
  }

  function apply(on) {
    try {
      document.designMode = on ? "on" : "off";
    } catch (_) {}

    if (!on) return;

    function ensure() {
      try {
        if (document.designMode !== "on") document.designMode = "on";
      } catch (_) {}
    }

    const onFocus = () => ensure();
    function onPointerDown() {
      ensure();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    document.addEventListener("pointerdown", onPointerDown, true);

    window[KEY] = {
      cleanup() {
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onFocus);
        document.removeEventListener("pointerdown", onPointerDown, true);
        try {
          document.designMode = "off";
        } catch (_) {}
      },
    };
  }

  /* MAIN world has no chrome.storage — background sets __zedDesignModeFlag before this file runs. */
  if (typeof window.__zedDesignModeFlag === "boolean") {
    const on = window.__zedDesignModeFlag;
    try {
      delete window.__zedDesignModeFlag;
    } catch (_) {}
    apply(on);
    return;
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["designMode"]).then((result) => {
      apply(String(result?.designMode).toLowerCase() === "on");
    });
    return;
  }

  apply(false);
})();
