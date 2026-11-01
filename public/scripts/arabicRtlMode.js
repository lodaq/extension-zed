(function () {
  const CLEANUP_KEY = "__zedArabicRtlCleanup";
  const ATTR = "data-arabic-rtl-fixed";
  const APPLY_KEY = "__zedArabicRtlApply";
  if (typeof window[APPLY_KEY] === "function") {
    return chrome.storage.local.get(["arabicRtlMode"]).then((r) => window[APPLY_KEY](r.arabicRtlMode === "on"));
  }
  const previousStyles = new WeakMap();

  const TAGS = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "li", "td", "th", "blockquote", "label",
    "span", "div", "a", "button", "input", "textarea",
    "article", "section", "figcaption"
  ];

  const ARABIC_RANGES = [
    [0x0600, 0x06FF],
    [0x0750, 0x077F],
    [0x08A0, 0x08FF],
    [0xFB50, 0xFDFF],
    [0xFE70, 0xFEFF],
  ];

  function isArabic(char) {
    if (!char) return false;
    const code = char.codePointAt(0);
    return ARABIC_RANGES.some(([start, end]) => code >= start && code <= end);
  }

  function getFirstLetter(text) {
    const m = text.trim().match(/\p{L}/u);
    return m ? m[0] : null;
  }

  function hasDirAttribute(el) {
    return el.hasAttribute("dir");
  }

  function needsRtl(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute(ATTR)) return false;
    if (hasDirAttribute(el)) return false;

    const text = el.innerText || el.textContent || "";
    const firstLetter = getFirstLetter(text);
    return firstLetter && isArabic(firstLetter);
  }

  function scanSubtrees(roots) {
    const elements = new Set();
    roots.forEach((root) => {
      if (root instanceof HTMLElement) elements.add(root);
      root.querySelectorAll?.(TAGS.join(",")).forEach((el) => elements.add(el));
    });
    // innerText can force layout: finish all reads before changing any styles.
    const matches = Array.from(elements).filter(needsRtl);
    matches.forEach((el) => {
      previousStyles.set(el, [el.style.getPropertyValue("text-align"), el.style.getPropertyPriority("text-align")]);
      el.setAttribute("dir", "rtl");
      el.style.setProperty("text-align", "right", "important");
      el.setAttribute(ATTR, "1");
    });
  }

  function disable() {
    if (window[CLEANUP_KEY] && typeof window[CLEANUP_KEY] === "function") {
      window[CLEANUP_KEY]();
    }
  }

  function enable() {
    disable();

    scanSubtrees([document.body]);

    const observer = new MutationObserver((mutations) => {
      const roots = [];
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            roots.push(node);
          }
        });
      });
      scanSubtrees(roots);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window[CLEANUP_KEY] = function () {
      document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
        el.removeAttribute("dir");
        const previous = previousStyles.get(el);
        if (previous?.[0]) el.style.setProperty("text-align", previous[0], previous[1]);
        else el.style.removeProperty("text-align");
        previousStyles.delete(el);
        el.removeAttribute(ATTR);
      });
      observer.disconnect();
      delete window[CLEANUP_KEY];
    };
  }

  window[APPLY_KEY] = (on) => on ? enable() : disable();
  return chrome.storage.local.get(["arabicRtlMode"]).then((r) => window[APPLY_KEY](r.arabicRtlMode === "on"));
})();
