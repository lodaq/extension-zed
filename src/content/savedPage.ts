import { mediaUrl, readSaved, SAVED_KEY, type SavedItem } from "../lib/saved"

if (window === window.top && /(^|\.)(youtube\.com|youtu\.be|instagram\.com|facebook\.com)$/.test(location.hostname)) {
  const host = document.createElement("div")
  host.className = "dark"
  const shadow = host.attachShadow({ mode: "closed" })
  const theme = document.createElement("link")
  theme.rel = "stylesheet"
  theme.href = chrome.runtime.getURL("theme.css")
  const style = document.createElement("style")
  style.textContent = `:host { all: initial; position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; }
    button { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); border-radius: var(--radius); font-family: var(--font-sans); padding: 12px 16px; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--ring); }`
  const button = document.createElement("button")
  button.type = "button"
  shadow.append(theme, style, button)
  document.documentElement.append(host)
  let current: string | null = null
  let items: SavedItem[] = []
  let busy = false
  const update = () => {
    const next = mediaUrl(location.href)
    if (next !== current) busy = false
    current = next
    host.hidden = !current
    if (!busy) {
      const saved = items.some(item => item.kind === "link" && item.url === current)
      button.textContent = saved ? "Saved to Zed ✓" : "Save to Zed"
      button.disabled = saved
    }
  }
  chrome.storage.local.get(SAVED_KEY).then(result => { items = readSaved(result[SAVED_KEY]); update() }).catch(console.error)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[SAVED_KEY]) { items = readSaved(changes[SAVED_KEY].newValue); update() }
  })
  button.addEventListener("click", async () => {
    const url = mediaUrl(location.href)
    if (!url) return update()
    busy = true
    button.disabled = true
    button.textContent = "Saving…"
    try {
      const result = await chrome.runtime.sendMessage({ type: "saved:add", url })
      if (!result?.ok) throw new Error(result?.error || "Save failed")
      const stored = await chrome.storage.local.get(SAVED_KEY)
      items = readSaved(stored[SAVED_KEY])
      busy = false
      update()
    } catch {
      busy = false
      button.disabled = false
      button.textContent = "Save failed — retry"
    }
  })
  update()
  // Sites change reel URLs without reloading the content script.
  window.setInterval(() => { if (mediaUrl(location.href) !== current) update() }, 750)
}
