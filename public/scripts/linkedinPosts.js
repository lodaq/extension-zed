(function () {
  "use strict";
  if (window !== window.top || window.__zedLinkedInPosts) return;
  window.__zedLinkedInPosts = true;
  const selector = '[componentkey^="update-card-focus"]';
  const resolved = new WeakMap();

  function postUrn(props) {
    // shortcut: LinkedIn's SDUI feed keeps post IDs in React props, not DOM links.
    // Bound traversal to this card; never walk React owners into neighboring posts.
    const queue = [{ value: props, depth: 0 }];
    const seen = new Set();
    for (let index = 0; index < queue.length && index < 25000; index++) {
      const { value, depth } = queue[index];
      if (typeof value === "string") {
        const match = value.slice(0, 1000000).match(/(?:commentCount|commentingDisabled)-urn:li:(activity|ugcPost|share):(\d+)/);
        if (match) return "urn:li:" + match[1] + ":" + match[2];
      }
      if (!value || typeof value !== "object" || seen.has(value) || depth >= 24) continue;
      seen.add(value);
      for (const key of Object.keys(value)) {
        if (["_owner", "return", "child", "sibling", "stateNode"].includes(key)) continue;
        if (queue.length >= 25000) break;
        queue.push({ value: value[key], depth: depth + 1 });
      }
    }
    return null;
  }

  function scan() {
    for (const card of document.querySelectorAll(selector)) {
      const key = Object.getOwnPropertyNames(card).find(key => key.startsWith("__reactProps$"));
      const props = key && card[key];
      const identity = card.getAttribute("componentkey");
      const cached = resolved.get(card);
      if (cached && cached.props === props && cached.identity === identity) continue;
      const urn = postUrn(props);
      if (urn) {
        card.setAttribute("data-zed-linkedin-url", "https://www.linkedin.com/feed/update/" + urn + "/");
        resolved.set(card, { props, identity });
      } else if (cached) {
        card.removeAttribute("data-zed-linkedin-url");
        resolved.delete(card);
      }
    }
  }
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; scan(); }, 100);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["componentkey"] });
  scan();
})();
