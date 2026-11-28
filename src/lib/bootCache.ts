import { readSetting, type MiscSectionId } from "./settings"

type BootState = {
  location?: { tab: string; detail: string | null; settings: boolean }
  dark?: boolean
  order?: readonly MiscSectionId[]
  scrollPositions?: Record<string, number>
}

const STORAGE_KEY = "zed.boot"
let memoryBootCache: BootState = {}
const pendingScrollPositions = new Map<string, number>()

function isScrollPositions(value: unknown): value is Record<string, number> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.values(value).every(top => typeof top === "number" && Number.isFinite(top))
}

// A synchronous first-frame mirror; Chrome storage hydrates preferences afterward.
export function readBootState(): BootState {
  try {
    const record: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")
    if (!record || typeof record !== "object" || Array.isArray(record)) return memoryBootCache
    const value = record as Record<string, unknown>
    const positions = value.scrollPositions
    memoryBootCache = {
      location: readSetting("popupLocation", value.location, memoryBootCache.location),
      dark: readSetting("darkTheme", value.dark, memoryBootCache.dark),
      order: readSetting("miscSectionOrder", value.order, memoryBootCache.order),
      scrollPositions: isScrollPositions(positions) ? positions : memoryBootCache.scrollPositions,
    }
  } catch { /* localStorage may be unavailable or contain malformed data. */ }
  return memoryBootCache
}

export function updateBootState(patch: BootState) {
  const current = readBootState()
  const scrollPositions = pendingScrollPositions.size
    ? { ...current.scrollPositions, ...Object.fromEntries(pendingScrollPositions) }
    : current.scrollPositions
  pendingScrollPositions.clear()
  memoryBootCache = { ...current, scrollPositions, ...patch }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryBootCache)) }
  catch { /* Keep the in-memory mirror when persistence is unavailable. */ }
}

export function mirrorBootValue(key: string, value: unknown) {
  const fields: Record<string, keyof BootState> = { popupLocation: "location", darkTheme: "dark", miscSectionOrder: "order" }
  if (!Object.prototype.hasOwnProperty.call(fields, key)) return
  const next = readSetting(key, value, undefined)
  if (next !== undefined) updateBootState({ [fields[key]]: next })
}

export function getStoredScrollPosition(key: string): number {
  const top = pendingScrollPositions.get(key) ?? readBootState().scrollPositions?.[key] ?? 0
  return Number.isFinite(top) ? Math.max(0, top) : 0
}

export function saveStoredScrollPosition(key: string, top: number) {
  if (Number.isFinite(top)) pendingScrollPositions.set(key, Math.max(0, Math.round(top)))
}

export function flushStoredScrollPositions() {
  if (pendingScrollPositions.size) updateBootState({})
}

export function _resetBootStateForTesting() {
  memoryBootCache = {}
  pendingScrollPositions.clear()
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* Storage may be unavailable in tests. */ }
}
