import { mediaUrl } from "./mediaUrl"

export { mediaUrl } from "./mediaUrl"

export const SAVED_KEY = "savedItems"
export const SAVED_BUTTONS_KEY = "savedButtonsEnabled"
export type SavedItem = { id: string; kind: "text" | "link"; text: string; url: string; createdAt: number }

export function readSaved(value: unknown): SavedItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SavedItem => item && typeof item.id === "string" &&
    ["text", "link"].includes(item.kind) && typeof item.text === "string" &&
    typeof item.url === "string" && /^https?:\/\//.test(item.url) && typeof item.createdAt === "number")
}

// Serialize read-modify-write operations from all tabs in the service worker.
let pending = Promise.resolve()
export function changeSaved(data: { type: string; url?: string; text?: string; id?: string }) {
  const operation = pending.then(async () => {
    // Runtime messages are untyped, even when callers compile as TypeScript.
    if (!data || typeof data !== "object" ||
      !["saved:add", "saved:remove", "saved:text"].includes(data.type) ||
      (data.type === "saved:remove"
        ? typeof data.id !== "string" || !data.id
        : typeof data.url !== "string" || data.url.length > 16384 ||
          (data.type === "saved:text" && (typeof data.text !== "string" || data.text.length > 65536)))) {
      throw new Error("Invalid saved item request")
    }
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
