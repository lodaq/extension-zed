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

    const overlay = document.createElement("div");
    overlay.setAttribute("data-zed-inspect-overlay", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none;" +
      "font-family:ui-monospace,SFMono-Regular,Consolas,monospace;";
    const shadow = overlay.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .box { position: fixed; border: 2px solid rgb(239 68 68); background: rgb(239 68 68 / 8%); box-sizing: border-box; }
        .panel { position: fixed; width: 300px; max-height: min(420px, calc(100vh - 20px)); overflow: auto; padding: 10px; border: 1px solid rgb(239 68 68); border-radius: 6px; background: rgb(17 24 39 / 96%); color: rgb(243 244 246); box-shadow: 0 8px 24px rgb(0 0 0 / 35%); font: 12px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
        .title { margin-bottom: 7px; color: rgb(252 165 165); font-weight: 700; }
        .section { margin-top: 8px; padding-top: 7px; border-top: 1px solid rgb(156 163 175 / 30%); color: rgb(209 213 219); }
        .row { display: grid; grid-template-columns: 92px 1fr; gap: 8px; overflow-wrap: anywhere; }
        .key { color: rgb(156 163 175); }
        .value { color: rgb(243 244 246); }
      </style>
      <div class="box" hidden></div>
      <div class="panel" hidden></div>
    `;
    document.documentElement.appendChild(overlay);
    const box = shadow.querySelector(".box");
    const panel = shadow.querySelector(".panel");

    function formatPixels(value) {
      return `${Number.parseFloat(value).toFixed(1)}px`;
    }

    function addRow(parent, key, value) {
      const row = document.createElement("div");
      row.className = "row";
      const keyNode = document.createElement("span");
      keyNode.className = "key";
      keyNode.textContent = key;
      const valueNode = document.createElement("span");
      valueNode.className = "value";
      valueNode.textContent = value;
      row.append(keyNode, valueNode);
      parent.appendChild(row);
    }

    function updateDetails(element, event) {
      const rect = element.getBoundingClientRect();
      const styles = getComputedStyle(element);
      box.hidden = false;
      box.style.left = `${rect.left}px`;
      box.style.top = `${rect.top}px`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;

      panel.replaceChildren();
      const title = document.createElement("div");
      title.className = "title";
      title.textContent = `<${element.tagName.toLowerCase()}>`;
      if (element.id) title.textContent += ` #${element.id}`;
      if (element.classList.length) title.textContent += ` .${Array.from(element.classList).slice(0, 3).join(".")}`;
      panel.appendChild(title);
      addRow(panel, "position", `${formatPixels(rect.left)}, ${formatPixels(rect.top)}`);
      addRow(panel, "size", `${formatPixels(rect.width)} x ${formatPixels(rect.height)}`);

      const boxSection = document.createElement("div");
      boxSection.className = "section";
      boxSection.textContent = "Box model";
      addRow(boxSection, "margin", `${styles.marginTop} ${styles.marginRight} ${styles.marginBottom} ${styles.marginLeft}`);
      addRow(boxSection, "padding", `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`);
      addRow(boxSection, "border", `${styles.borderTopWidth} ${styles.borderRightWidth} ${styles.borderBottomWidth} ${styles.borderLeftWidth}`);
      addRow(boxSection, "box-sizing", styles.boxSizing);
      panel.appendChild(boxSection);

      const visualSection = document.createElement("div");
      visualSection.className = "section";
      visualSection.textContent = "Visual";
      addRow(visualSection, "color", styles.color);
      addRow(visualSection, "background", styles.backgroundColor);
      addRow(visualSection, "opacity", styles.opacity);
      addRow(visualSection, "border-color", styles.borderTopColor);
      panel.appendChild(visualSection);

      const layoutSection = document.createElement("div");
      layoutSection.className = "section";
      layoutSection.textContent = "Layout & type";
      addRow(layoutSection, "display", styles.display);
      addRow(layoutSection, "position", styles.position);
      addRow(layoutSection, "font", `${styles.fontSize} ${styles.fontFamily}`);
      addRow(layoutSection, "line-height", styles.lineHeight);
      addRow(layoutSection, "z-index", styles.zIndex);
      panel.appendChild(layoutSection);

      panel.hidden = false;
      const panelRect = panel.getBoundingClientRect();
      const gap = 12;
      const left = event.clientX + gap + panelRect.width <= window.innerWidth
        ? event.clientX + gap
        : Math.max(gap, event.clientX - panelRect.width - gap);
      const top = event.clientY + gap + panelRect.height <= window.innerHeight
        ? event.clientY + gap
        : Math.max(gap, window.innerHeight - panelRect.height - gap);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    }

    function clearDetails() {
      box.hidden = true;
      panel.hidden = true;
    }

    function onMove(e) {
      const t = e.target?.nodeType === Node.ELEMENT_NODE ? e.target : e.target?.parentElement;
      if (!t || t === overlay || overlay.contains(t)) return;
      updateDetails(t, e);
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        void chrome.storage.local.set({ inspectMode: "off" });
      }
    }

    function cleanup() {
      clearDetails();
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("keydown", onKey, true);
      chrome.storage.onChanged.removeListener(onStorage);
      overlay.remove();
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
