import tokens from "../design-system/tokens.css?raw"
import type { SavedLink } from "../lib/links"

export function installSavedIndicator() {
  const host = document.createElement("div")
  host.setAttribute("data-zed-saved", "")
  host.style.cssText = "all:initial!important;position:fixed!important;bottom:16px!important;right:16px!important;z-index:2147483647!important;pointer-events:none!important;"
  const shadow = host.attachShadow({ mode: "open" })
  const style = document.createElement("style")
  style.textContent = tokens.replace(/:root/g, ":host") + `
    span { display:block;padding:8px 12px;border:1px solid var(--zed-accent-line);
      border-radius:var(--zed-radius-pill);background:var(--zed-bg);color:var(--zed-accent);
      font:500 var(--zed-fs-sm)/1.5 var(--zed-font);box-shadow:var(--zed-shadow-pop); }
  `
  const label = document.createElement("span")
  label.setAttribute("role", "status")
  label.textContent = "✓ Saved in Zed"
  shadow.append(style, label)
  let links: SavedLink[] = []
  let acceptInitialRead = true
  const render = () => {
    const url = location.href.replace(/^https?:\/\//i, "").replace(/\/$/, "")
    if (links.some(link => link.url === url)) document.documentElement?.append(host)
    else host.remove()
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.savedLinks) return
    acceptInitialRead = false
    links = Array.isArray(changes.savedLinks.newValue) ? changes.savedLinks.newValue : []
    render()
  })
  void chrome.storage.local.get("savedLinks").then(stored => {
    if (!acceptInitialRead) return
    links = Array.isArray(stored.savedLinks) ? stored.savedLinks : []
    render()
  }).catch(console.error)
  document.addEventListener("DOMContentLoaded", render, { once: true })
  window.addEventListener("popstate", render)
  window.addEventListener("hashchange", render)
  ;(window as Window & { navigation?: EventTarget }).navigation?.addEventListener("currententrychange", render)
}
