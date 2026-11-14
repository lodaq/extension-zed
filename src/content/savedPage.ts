import { readSaved, mediaUrl, SAVED_BUTTONS_KEY, SAVED_KEY, type SavedItem } from "../lib/saved"
import { findMediaTargets } from "../lib/mediaTargets"

type SaveEntry = { mount: HTMLElement; previousPosition: string | null; host: HTMLDivElement; button: HTMLButtonElement; url: string | null; busy: boolean }

const state = globalThis as typeof globalThis & { __zedSaveInstalled?: boolean }

function installSaveButtons() {
  if (state.__zedSaveInstalled || window !== window.top || !/(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com)$/.test(location.hostname)) return
  state.__zedSaveInstalled = true
  let items: SavedItem[] = []
  let dark = true
  let enabled = false
  let preferenceChanged = false
  const entries = new Map<HTMLElement, SaveEntry>()
  const render = () => {
    for (const entry of entries.values()) {
      entry.host.classList.toggle("dark", dark)
      if (entry.busy) continue
      const saved = entry.url !== null && items.some(item => item.kind === "link" && mediaUrl(item.url) === entry.url)
      entry.button.textContent = saved ? "Remove from Zed" : "Save to Zed"
      entry.button.setAttribute("aria-pressed", String(saved))
      entry.button.title = saved ? "Remove from Zed" : entry.url ? `Save ${entry.url} to Zed` : "Save this post to Zed"
      entry.button.disabled = false
    }
  }
  const raiseAbovePlayer = (entry: SaveEntry) => {
    if (entry.host.hasAttribute("data-zed-post")) return
    const rect = entry.host.getBoundingClientRect()
    if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight) return
    const blocker = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    if (!blocker || blocker === entry.host) return
    let mount: HTMLElement | null = entry.mount
    while (mount && !mount.contains(blocker)) mount = mount.parentElement
    if (!mount || mount === entry.mount || mount === document.body || mount === document.documentElement) return
    const bounds = mount.getBoundingClientRect()
    const original = entry.mount.getBoundingClientRect()
    // Promote only within this player, never over unrelated dialogs or feed items.
    if (mount.querySelectorAll("video").length > 1 || bounds.width > original.width * 1.5 || bounds.height > original.height * 1.5) return
    if (entry.previousPosition !== null && entry.mount.style.position === "relative") entry.mount.style.position = entry.previousPosition
    entry.previousPosition = getComputedStyle(mount).position === "static" ? mount.style.position : null
    if (entry.previousPosition !== null) mount.style.position = "relative"
    entry.mount = mount
    mount.append(entry.host)
  }
  const scan = () => {
    const targets = enabled ? findMediaTargets(document, location.href) : new Map<HTMLElement, string | null>()
    for (const [target, entry] of entries) {
      if (targets.get(target) !== entry.url || !entry.host.isConnected || entry.host.parentElement !== entry.mount) {
        entry.host.remove()
        if (entry.previousPosition !== null && entry.mount.style.position === "relative") entry.mount.style.position = entry.previousPosition
        entries.delete(target)
      }
    }
    for (const [target, url] of targets) {
      if (entries.has(target)) continue
      const host = document.createElement("div")
      host.setAttribute("data-zed-save-button", "")
      const card = target.matches('article, [role=article], [data-pagelet^=FeedUnit]')
      const facebook = /^(?:www\.|m\.)?facebook\.com$/.test(location.hostname)
      const post = (card || facebook) && !/\/reels?\//.test(url ?? "")
      if (post && !card) host.setAttribute("data-zed-post-inline", "")
      if (post) host.setAttribute("data-zed-post", "")
      const shadow = host.attachShadow({ mode: "closed" })
      const theme = document.createElement("link")
      theme.rel = "stylesheet"
      theme.href = chrome.runtime.getURL("theme.css")
      const style = document.createElement("style")
      style.textContent = `:host { all: initial; position: absolute !important; top: var(--zed-space-3); right: var(--zed-space-3); z-index: 2147483647; animation: none !important; transition: none !important; }
        :host([data-zed-post]) { position: relative !important; display: block; top: auto; right: auto; padding: var(--zed-space-3); }
        :host([data-zed-post-inline]) { display: inline-flex; vertical-align: middle; }
        :host([hidden]) { display: none !important; }
        *, *::before, *::after { box-sizing: border-box; animation: none !important; transition: none !important; }
        button { background: var(--zed-surface-raised); color: var(--zed-text); border: 1px solid var(--zed-border); border-radius: var(--zed-radius-md); font: 600 var(--zed-fs-base) var(--zed-font); height: var(--zed-h-compact); padding: 0 var(--zed-space-6); cursor: pointer; }
        button:hover:not(:disabled) { background: var(--zed-surface-hover); border-color: var(--zed-border-strong); }
        button:disabled { opacity: .5; cursor: default; }
        button:focus-visible { outline: 2px solid var(--zed-accent); outline-offset: 2px; }`
      const button = document.createElement("button")
      button.type = "button"
      button.setAttribute("aria-live", "polite")
      button.title = url ? `Save ${url} to Zed` : "Save this post to Zed"
      shadow.append(theme, style, button)
      const previousPosition = !post && getComputedStyle(target).position === "static" ? target.style.position : null
      if (previousPosition !== null) target.style.position = "relative"
      if (post && card) target.prepend(host)
      else if (post) target.append(host)
      else target.append(host)
      const entry = { host, button, url, busy: false, previousPosition, mount: target }
      theme.addEventListener("load", () => raiseAbovePlayer(entry))
      entries.set(target, entry)
      for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup"]) {
        button.addEventListener(type, event => event.stopPropagation())
      }
      button.addEventListener("click", async (event) => {
        event.preventDefault()
        event.stopPropagation()
        entry.busy = true
        button.disabled = true
        button.textContent = "Updating…"
        try {
          // Facebook hydrates timestamp hrefs in response to pointer events.
          if (!url) {
            for (const link of target.querySelectorAll('a[href]')) link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
          }
          const resolvedUrl = findMediaTargets(document, location.href).get(target)
          if (!resolvedUrl) throw new Error("Post link unavailable. Open the post and try again.")
          entry.url = resolvedUrl
          button.title = `Save ${resolvedUrl} to Zed`
          const saved = items.find(item => item.kind === "link" && mediaUrl(item.url) === resolvedUrl)
          const result = await chrome.runtime.sendMessage(saved ? { type: "saved:remove", id: saved.id } : { type: "saved:add", url: resolvedUrl })
          if (!result?.ok) throw new Error(result?.error || "Save failed")
          items = readSaved((await chrome.storage.local.get(SAVED_KEY))[SAVED_KEY])
          entry.busy = false
          render()
        } catch (error) {
          button.title = error instanceof Error ? error.message : "Save failed"
          entry.busy = false
          button.disabled = false
          button.textContent = "Update failed — retry"
        }
      })
    }
    render()
    for (const entry of entries.values()) raiseAbovePlayer(entry)
  }
  chrome.storage.local.get([SAVED_KEY, "darkTheme", SAVED_BUTTONS_KEY]).then(result => {
    items = readSaved(result[SAVED_KEY]); dark = result.darkTheme !== false
    if (!preferenceChanged) enabled = result[SAVED_BUTTONS_KEY] !== false
    scan()
  }).catch(console.error)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return
    if (changes[SAVED_BUTTONS_KEY]) { preferenceChanged = true; enabled = changes[SAVED_BUTTONS_KEY].newValue !== false; scan() }
    if (changes.darkTheme) dark = changes.darkTheme.newValue !== false
    if (changes[SAVED_KEY]) items = readSaved(changes[SAVED_KEY].newValue)
    render()
  })
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    window.setTimeout(() => { scheduled = false; scan() }, 100)
  }
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "video-id", "data-video-id", "src", "aria-hidden"] })
  window.addEventListener("scroll", schedule, { capture: true, passive: true })
  window.addEventListener("resize", schedule)
  window.addEventListener("popstate", schedule)
  let pageUrl = location.href
  window.setInterval(() => { if (location.href !== pageUrl) { pageUrl = location.href; schedule() } }, 750)
  scan()
}

if (window === window.top) {
  if (document.documentElement) installSaveButtons()
  else document.addEventListener("DOMContentLoaded", installSaveButtons, { once: true })
}
