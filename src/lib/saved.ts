export const SAVED_KEY = "savedItems"
export type SavedItem = { id: string; kind: "text" | "link"; text: string; url: string; createdAt: number }

export function readSaved(value: unknown): SavedItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SavedItem => item && typeof item.id === "string" &&
    ["text", "link"].includes(item.kind) && typeof item.text === "string" &&
    typeof item.url === "string" && /^https?:\/\//.test(item.url) && typeof item.createdAt === "number")
}

export function mediaUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    const host = url.hostname.replace(/^(www|m)\./, "")
    if (host === "youtube.com") {
      const id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/shorts\/([\w-]+)/)?.[1]
      if (id && /^[\w-]+$/.test(id)) return `https://www.youtube.com/watch?v=${id}`
    }
    if (host === "youtu.be" && /^\/[\w-]+$/.test(url.pathname)) return `https://www.youtube.com/watch?v=${url.pathname.slice(1)}`
    if (host === "instagram.com" || host === "facebook.com") {
      const match = url.pathname.match(host === "instagram.com" ? /^\/reels?\/([\w-]+)(?:\/|$)/ : /^\/reel\/([0-9]+)(?:\/|$)/)
      if (match) return `https://www.${host}/reel/${match[1]}/`
    }
  } catch { /* Invalid URL */ }
  return null
}

// Serialize read-modify-write operations from all tabs in the service worker.
let pending = Promise.resolve()
export function changeSaved(data: { type: string; url?: string; text?: string; id?: string }) {
  const operation = pending.then(async () => {
    const stored = await chrome.storage.local.get(SAVED_KEY)
    const items: SavedItem[] = readSaved(stored[SAVED_KEY])
    if (data.type === "saved:remove") {
      await chrome.storage.local.set({ [SAVED_KEY]: items.filter(item => item.id !== data.id) })
      return { ok: true }
    }
    const url = data.type === "saved:text" ? data.url : mediaUrl(data.url ?? "")
    if (!url || !/^https?:\/\//.test(url)) throw new Error("Unsupported page URL")
    const text = data.type === "saved:text" ? data.text?.trim() : url
    if (!text) throw new Error("No text selected")
    if (!items.some(item => item.url === url && item.text === text)) {
      const item: SavedItem = { id: crypto.randomUUID(), kind: data.type === "saved:text" ? "text" : "link", text, url, createdAt: Date.now() }
      await chrome.storage.local.set({ [SAVED_KEY]: [item, ...items] })
    }
    return { ok: true }
  })
  pending = operation.then(() => {}, () => {})
  return operation
}
