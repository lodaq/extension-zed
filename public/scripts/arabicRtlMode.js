(function () {
  const CLEANUP_KEY = "__zedArabicRtlCleanup";
  const ATTR = "data-arabic-rtl-fixed";

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

  function scanElement(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el.hasAttribute(ATTR)) return;
    if (hasDirAttribute(el)) return;

    const text = el.innerText || el.textContent || "";
    const firstLetter = getFirstLetter(text);
    if (firstLetter && isArabic(firstLetter)) {
      el.setAttribute("dir", "rtl");
      el.style.setProperty("text-align", "right", "important");
      el.setAttribute(ATTR, "1");
    }
  }

  function scanSubtree(root) {
    if (root instanceof HTMLElement) {
      scanElement(root);
    }
    if (root.querySelectorAll) {
      root.querySelectorAll(TAGS.join(",")).forEach(scanElement);
    }
  }

  function disable() {
    if (window[CLEANUP_KEY] && typeof window[CLEANUP_KEY] === "function") {
      window[CLEANUP_KEY]();
    }
  }

  function enable() {
    disable();

    scanSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scanSubtree(node);
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window[CLEANUP_KEY] = function () {
      document.querySelectorAll(`[${ATTR}]`).forEach((el) => {
        el.removeAttribute("dir");
        el.style.removeProperty("text-align");
        el.removeAttribute(ATTR);
      });
      observer.disconnect();
      delete window[CLEANUP_KEY];
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "rtl-enable") {
      enable();
    } else if (message.action === "rtl-disable") {
      disable();
    }
  });

  chrome.storage.local.get(["arabicRtlMode"]).then((r) => {
    const on = String(r?.arabicRtlMode).toLowerCase() === "on";
    if (on) {
      enable();
    }
  });
})();
