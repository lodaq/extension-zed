(function () {
  const STATE = "__zedPageColors";
  const scope = typeof window === "undefined" ? globalThis : window;
  if (scope[STATE]) return scope[STATE].refresh();

  const STYLE_ID = "zed-page-colors";
  const ATTRIBUTE = "data-zed-page-colors";
  const SITE_KEY = `pageColors:${scope.origin && scope.origin !== "null" ? scope.origin : location.origin}`;
  const FIELDS = ["background", "text", "surface", "accent", "accentText", "border"];
  const MEDIA = "svg, img, video, canvas, picture, iframe, object, embed, math";
  const styles = new Map();
  const preserved = new WeakMap();
  let colors = {};
  let rules = [];
  let customRules = new Map();
  let timer;
  let revision = 0;
  const dirty = new Set();
  const color = (value) => typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : "";
  const hasColors = (settings) => FIELDS.some((name) => color(settings && settings[name]));
  function colorChannels(value) {
    const components = value.replace(/^[^(]*\(/, "").replace(/^[a-z][\w-]*\s+/i, "");
    return (components.match(/[-\d.]+/g) || []).map(Number);
  }
  const isNeutralColor = (value) => {
    const rgb = colorChannels(value).slice(0, 3);
    if (/^oklch\(/.test(value)) return rgb[1] < 0.04;
    if (/^oklab\(/.test(value)) return Math.hypot(rgb[1], rgb[2]) < 0.04;
    if (/^lch\(/.test(value)) return rgb[1] < 12;
    if (/^lab\(/.test(value)) return Math.hypot(rgb[1], rgb[2]) < 12;
    if (/^color\(/.test(value)) return Math.max(...rgb) - Math.min(...rgb) < 0.16;
    return rgb.length === 3 && Math.max(...rgb) - Math.min(...rgb) < 40;
  };
  function colorAlpha(value) {
    const components = colorChannels(value);
    return components[3] ?? (components.length === 3 ? 1 : 0);
  }
  const marked = (token) => `[${ATTRIBUTE}~="${token}"]`;

  function customRule(declaration) {
    if (!customRules.has(declaration)) customRules.set(declaration, `custom-${customRules.size}`);
    return customRules.get(declaration);
  }

  function observe() {
    if (!observer) return;
    for (const root of styles.keys()) observer.observe(root, {
      subtree: true, childList: true, attributes: true, characterData: true,
      attributeFilter: ["class", "style", "bgcolor", "color", "fill"],
    });
  }

  function stylesheet(root) {
    let style = styles.get(root);
    if (!style || !style.isConnected) {
      style = root.getElementById(STYLE_ID) || document.createElement("style");
      style.id = STYLE_ID;
      if (!style.parentNode) (root === document ? document.head || document.documentElement : root)?.appendChild(style);
      styles.set(root, style);
    }
    style.media = "not all";
    return style;
  }

  function classifyElement(element, inheritedKeep) {
    const original = getComputedStyle(element);
    const background = original.backgroundColor;
    const image = original.backgroundImage !== "none";
    const mask = (original.maskImage && original.maskImage !== "none") ||
      (original.webkitMaskImage && original.webkitMaskImage !== "none");
    const svgIcon = element.matches("svg") && (element.matches('[fill="currentColor"], [stroke="currentColor"]') ||
      element.querySelector('[fill="currentColor"], [stroke="currentColor"]'));
    const keep = inheritedKeep || (element.matches(MEDIA) && !svgIcon) || image ||
      original.backgroundClip === "text" || (colorAlpha(background) > 0 && !isNeutralColor(background) && !mask);
    preserved.set(element, keep);
    const tokens = [];
    if (keep) {
      // Freeze inherited text too: a preserved colored panel can inherit the page's old foreground.
      const declaration = `color: ${original.color} !important; -webkit-text-fill-color: ${original.webkitTextFillColor || original.color} !important;`;
      tokens.push(customRule(declaration));
    } else {
      if (mask) tokens.push("icon");
      else if (element.matches("html, body")) tokens.push("background");
      else if (colorAlpha(background) > 0) {
        const target = colors.surface || colors.background;
        if (target && colorAlpha(background) < 1) {
          const opacity = Math.round(colorAlpha(background) * 255).toString(16).padStart(2, "0");
          tokens.push(customRule(`background-color: ${target}${opacity} !important;`));
        } else tokens.push("surface");
      }
      const link = element.closest("a");
      tokens.push(link ? "link" : "text");
      if (colors.text && !link && !isNeutralColor(original.color)) {
        tokens.push(customRule(`color: color-mix(in srgb, ${original.color} 40%, ${colors.text}) !important; -webkit-text-fill-color: currentColor !important;`));
      }
      if (isNeutralColor(original.borderTopColor)) tokens.push("border");
    }
    return { keep, tokens: tokens.join(" ") };
  }

  function scan(start) {
    if (!start) return;
    const parent = start.parentElement || start.getRootNode().host;
    const queue = [[start, preserved.get(parent) || false]];
    const changes = [];
    for (let index = 0; index < queue.length; index++) {
      const [element, inheritedKeep] = queue[index];
      if (element.id === STYLE_ID || element.matches("script, style, link, meta, title, head")) continue;
      const { keep, tokens } = classifyElement(element, inheritedKeep);
      changes.push([element, tokens]);
      if (element.shadowRoot) {
        stylesheet(element.shadowRoot);
        for (const child of element.shadowRoot.children) queue.push([child, keep]);
      }
      if (!element.matches(MEDIA)) {
        for (const child of element.children) queue.push([child, keep]);
      }
    }
    // Read site styles before writing markers, to avoid a layout pass for each element.
    for (const [element, tokens] of changes) element.setAttribute(ATTRIBUTE, tokens);
  }

  function flush(full = false) {
    clearTimeout(timer);
    timer = undefined;
    observer?.disconnect();
    for (const [root, style] of styles) {
      if (root.host && !root.host.isConnected) {
        style.remove();
        styles.delete(root);
      } else style.media = "not all";
    }
    try {
      if (full) {
        customRules = new Map();
        scan(document.documentElement);
      } else {
        for (const element of dirty) {
          if (!element.isConnected) continue;
          let parent = element.parentElement;
          while (parent && !dirty.has(parent)) parent = parent.parentElement;
          if (!parent) scan(element);
        }
      }
      dirty.clear();
      const css = [...rules, ...Array.from(customRules, ([declaration, token]) => `${marked(token)} { ${declaration} }`)].join("\n");
      for (const style of styles.values()) {
        style.textContent = css;
        style.media = "all";
      }
    } finally {
      observe();
    }
  }

  const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver((mutations) => {
    let full = false;
    for (const mutation of mutations) {
      const element = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
      if (!element || element.id === STYLE_ID) continue;
      if (element.closest("style") || element.matches("link[rel=stylesheet]")) full = true;
      else if (mutation.type === "attributes") dirty.add(element);
      else {
        if ([...mutation.removedNodes].some(node => node.nodeType === 1 && node.matches("style, link[rel=stylesheet]"))) full = true;
        if (mutation.removedNodes.length) dirty.add(element);
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1 && node.id !== STYLE_ID) {
            if (node.matches("style, link[rel=stylesheet]")) full = true;
            else dirty.add(node);
          }
        }
      }
    }
    if (full) dirty.add(document.documentElement);
    if (dirty.size && !timer) {
      timer = setTimeout(() => flush(dirty.has(document.documentElement)), 50);
    }
  });

  function buildThemeRules({ background, text, surface, accent, accentText, border }) {
    const rules = [];
    if (background) {
      const rgb = [1, 3, 5].map(index => parseInt(background.slice(index, index + 2), 16) / 255);
      const light = rgb.reduce((sum, channel, index) => sum + [0.2126, 0.7152, 0.0722][index] * channel, 0) >= 0.5;
      rules.push(`:root, :host { color-scheme: ${light ? "light" : "dark"} !important; }`);
      rules.push(`${marked("background")} { background-color: ${background} !important; }`);
      rules.push(`${marked("surface")} { background-color: ${surface || background} !important; }`);
    } else if (surface) rules.push(`${marked("surface")} { background-color: ${surface} !important; }`);
    if (text) {
      rules.push(`${marked("text")}, ${marked("link")} { color: ${text} !important; -webkit-text-fill-color: currentColor !important; caret-color: ${text} !important; }`);
      rules.push(`${marked("icon")} { background-color: ${text} !important; }`);
    }
    if (border) rules.push(`${marked("border")} { border-color: ${border} !important; }`);
    if (accent) {
      rules.push(`:root, :host { accent-color: ${accent} !important; }`);
      rules.push(`${marked("link")} { color: ${accent} !important; -webkit-text-fill-color: currentColor !important; }`);
      rules.push(`:focus-visible { outline-color: ${accent} !important; }`);
      rules.push(`::selection { background-color: ${accent} !important; color: ${accentText || text || background} !important; -webkit-text-fill-color: currentColor !important; }`);
    }
    return rules;
  }

  function render(settings) {
    colors = settings;
    observer?.disconnect();
    clearTimeout(timer);
    timer = undefined;
    dirty.clear();
    if (!hasColors(colors)) {
      for (const [root, style] of styles) {
        style.remove();
        for (const element of root.querySelectorAll(`[${ATTRIBUTE}]`)) element.removeAttribute(ATTRIBUTE);
      }
      document.getElementById(STYLE_ID)?.remove();
      styles.clear();
      return;
    }

    rules = buildThemeRules(colors);
    stylesheet(document).textContent = rules.join("\n");
    flush(true);
  }

  async function refresh() {
    const current = ++revision;
    const result = await chrome.storage.local.get([SITE_KEY, "pageColorsGlobal", "pageColorsAllSites"]);
    if (current !== revision) return;
    const settings = result.pageColorsAllSites === true && hasColors(result.pageColorsGlobal) ? result.pageColorsGlobal : result[SITE_KEY];
    const nextColors = Object.fromEntries(FIELDS.map(name => [name, color(settings && settings[name])]));
    if (FIELDS.every(name => nextColors[name] === colors[name]) &&
      Array.from(styles.values()).every(style => style.isConnected && style.media === "all")) return;
    render(nextColors);
  }

  scope[STATE] = { refresh };
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area === "local" && (changes[SITE_KEY] || changes.pageColorsGlobal || changes.pageColorsAllSites)) {
      void refresh().catch(() => {});
    }
  });
  document.addEventListener?.("DOMContentLoaded", () => { if (hasColors(colors)) render(colors); }, { once: true });
  document.addEventListener?.("load", (event) => {
    if (hasColors(colors) && event.target.matches?.("link[rel=stylesheet]")) flush(true);
  }, true);
  return refresh();
})();
