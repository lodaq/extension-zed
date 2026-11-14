export type SavedLink = { url: string; href: string; title: string }
export function normalizeLink(input: string, title?: string, fromTab = false): SavedLink | null {
  const original = input.trim()
  const url = original.replace(/^https?:\/\//i, "").replace(/\/$/, "")
  if (!url) return null
  const internal = fromTab && /^(?:chrome|chrome-extension|edge|brave|about|view-source|devtools|file):/i.test(original)
  const href = internal ? original : /^https?:\/\//i.test(original) ? original : `https://${url}`
  const parsed = new URL(href)
  if (!internal && !["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter an HTTP or HTTPS URL")
  return { url, href, title: title || (parsed.host || parsed.pathname).replace(/^www\./, "") }
}
export async function addLink(input: string, title?: string, fromTab = false) {
  const link = normalizeLink(input, title, fromTab)
  if (!link) return null
  const stored = await chrome.storage.local.get("savedLinks")
  const links: SavedLink[] = Array.isArray(stored.savedLinks) ? stored.savedLinks : []
  if (links.some(item => item.url === link.url)) return false
  await chrome.storage.local.set({ savedLinks: [link, ...links] })
  return true
}

export async function saveCurrentTab(tab?: chrome.tabs.Tab) {
  tab ??= (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
  if (!tab?.url || tab.id === undefined) throw new Error("Current tab is unavailable")
  const added = await addLink(tab.url, tab.title, true)
  await chrome.tabs.remove(tab.id)
  return added
}

export async function openSavedLink(link: SavedLink) {
  await chrome.tabs.create({ url: link.href })
  const stored = await chrome.storage.local.get("savedLinks")
  const links: SavedLink[] = Array.isArray(stored.savedLinks) ? stored.savedLinks : []
  await chrome.storage.local.set({ savedLinks: links.filter(item => item.url !== link.url) })
}
