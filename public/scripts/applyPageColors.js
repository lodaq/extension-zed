/* The active origin owns its setting; this is the only style Zed adds to a page. */
(function () {
  const STYLE_ID = "zed-page-colors";
  const key = `pageColors:${location.origin}`;
  chrome.storage.local.get([key]).then((result) => {
    const settings = result[key] || {};
    const background = typeof settings.background === "string" ? settings.background : "";
    const text = typeof settings.text === "string" ? settings.text : "";
    const style = document.getElementById(STYLE_ID);
    if (!background && !text) return style?.remove();
    const next = style || document.createElement("style");
    next.id = STYLE_ID;
    next.textContent = [
      background && `html, body, body * { background-color: ${background} !important; background-image: none !important; }`,
      text && `html, body, body * { color: ${text} !important; }`,
    ].filter(Boolean).join("\n");
    if (!style) (document.head || document.documentElement).appendChild(next);
  });
})();
