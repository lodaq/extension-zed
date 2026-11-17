import { mediaUrl } from "./mediaUrl"

export { mediaUrl } from "./mediaUrl"

export const COLLECTIONS_KEY = "savedCollections"
export function readCollections(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((name): name is string => typeof name === "string" && !!name.trim() && name.length <= 80))] : []
}

export const SAVED_KEY = "savedItems"
export const SAVED_BUTTONS_KEY = "savedButtonsEnabled"
export type SavedItem = { id: string; kind: "text" | "link"; text: string; url: string; createdAt: number; collection?: string }

export function readSaved(value: unknown): SavedItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SavedItem => item && typeof item.id === "string" &&
    ["text", "link"].includes(item.kind) && typeof item.text === "string" &&
    typeof item.url === "string" && /^https?:\/\//.test(item.url) && typeof item.createdAt === "number" &&
    (item.collection === undefined || typeof item.collection === "string"))
}

// Serialize read-modify-write operations from all tabs in the service worker.
let pending = Promise.resolve()
export function changeSaved(data: { type: string; url?: string; text?: string; id?: string; collection?: string; name?: string }) {
  const operation = pending.then(async () => {
    if (data && ["saved:rename", "saved:delete-collection"].includes(data.type)) {
      if (typeof data.collection !== "string" || !data.collection.trim() || data.collection.length > 80 ||
        (data.type === "saved:rename" && (typeof data.name !== "string" || !data.name.trim() || data.name.length > 80))) throw new Error("Invalid collection request")
      const stored = await chrome.storage.local.get([SAVED_KEY, COLLECTIONS_KEY])
      const collections = readCollections(stored[COLLECTIONS_KEY])
      if (!collections.includes(data.collection)) throw new Error("Collection not found")
      const name = data.type === "saved:rename" ? data.name!.trim() : ""
      if (name !== data.collection && collections.includes(name)) throw new Error("A collection with that name already exists")
      await chrome.storage.local.set({
        [COLLECTIONS_KEY]: collections.flatMap(collection => collection === data.collection ? name ? [name] : [] : [collection]),
        [SAVED_KEY]: readSaved(stored[SAVED_KEY]).map(item => item.collection === data.collection ? { ...item, collection: name } : item),
      })
      return { ok: true }
    }
    if (data && ["saved:collection", "saved:move"].includes(data.type)) {
      if (typeof data.collection !== "string" || data.collection.length > 80 ||
        (data.type === "saved:collection" && !data.collection.trim()) ||
        (data.type === "saved:move" && (typeof data.id !== "string" || !data.id))) throw new Error("Invalid collection request")
      const stored = await chrome.storage.local.get([SAVED_KEY, COLLECTIONS_KEY])
      const collections = readCollections(stored[COLLECTIONS_KEY])
      const collection = data.collection.trim()
      if (data.type === "saved:collection") {
        if (!collections.includes(collection)) await chrome.storage.local.set({ [COLLECTIONS_KEY]: [...collections, collection] })
      } else {
        if (collection && !collections.includes(collection)) throw new Error("Collection not found")
        const items = readSaved(stored[SAVED_KEY])
        if (!items.some(item => item.id === data.id)) throw new Error("Saved item not found")
        await chrome.storage.local.set({ [SAVED_KEY]: items.map(item => item.id === data.id ? { ...item, collection } : item) })
      }
      return { ok: true }
    }
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
