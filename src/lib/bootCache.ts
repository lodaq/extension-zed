import { MISC_SECTION_ORDER, POPUP_TABS, type MiscSectionId, type PopupTab } from "./settings"

export type BootState = {
  tab?: PopupTab
  dark?: boolean
  order?: readonly MiscSectionId[]
  expanded?: readonly MiscSectionId[]
  scrollPositions?: Record<string, number>
}

const STORAGE_KEY = "zed.boot"

let memoryBootCache: BootState = {}

const isPopupTab = (value: unknown): value is PopupTab =>
  typeof value === "string" && POPUP_TABS.some((tab) => tab === value)

const isSectionOrder = (value: unknown): value is MiscSectionId[] =>
  Array.isArray(value) && value.length === MISC_SECTION_ORDER.length &&
  new Set(value).size === value.length && MISC_SECTION_ORDER.every((id) => value.includes(id))

const isSectionList = (value: unknown): value is MiscSectionId[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string" && MISC_SECTION_ORDER.includes(id as MiscSectionId))

const isScrollPositions = (value: unknown): value is Record<string, number> =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.values(value).every((v) => typeof v === "number" && Number.isFinite(v))

/**
 * Synchronous snapshot used only to paint the first frame. chrome.storage.local
 * remains the source of truth; this mirror only avoids a blank or mis-sized
 * first paint while that asynchronous read is in flight.
 */
export function readBootState(): BootState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return memoryBootCache
    const value: unknown = JSON.parse(raw)
    if (value === null || typeof value !== "object" || Array.isArray(value)) return memoryBootCache
    const record = value as Record<string, unknown>
    const result: BootState = {
      tab: isPopupTab(record.tab) ? record.tab : memoryBootCache.tab,
      dark: typeof record.dark === "boolean" ? record.dark : memoryBootCache.dark,
      order: isSectionOrder(record.order) ? record.order : memoryBootCache.order,
      expanded: isSectionList(record.expanded) ? record.expanded : memoryBootCache.expanded,
      scrollPositions: isScrollPositions(record.scrollPositions)
        ? record.scrollPositions
        : memoryBootCache.scrollPositions,
    }
    memoryBootCache = result
    return result
  } catch {
    return memoryBootCache
  }
}

export function updateBootState(patch: BootState) {
  memoryBootCache = { ...readBootState(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryBootCache))
  } catch {
    // localStorage can be unavailable; in-memory cache preserves state during the session.
  }
}

export function mirrorBootValue(key: string, value: unknown) {
  if (key === "darkTheme" && typeof value === "boolean") updateBootState({ dark: value })
  else if (key === "miscSectionOrder" && isSectionOrder(value)) updateBootState({ order: value })
  else if (key === "miscExpandedSections" && isSectionList(value)) updateBootState({ expanded: value })
}

export function getStoredScrollPosition(key: string): number {
  const positions = readBootState().scrollPositions
  if (positions && typeof positions[key] === "number" && Number.isFinite(positions[key])) {
    return Math.max(0, positions[key])
  }
  return 0
}

export function saveStoredScrollPosition(key: string, top: number) {
  try {
    const current = readBootState().scrollPositions ?? {}
    const rounded = Math.max(0, Math.round(top))
    if (current[key] === rounded) return
    const updated = {
      ...current,
      [key]: rounded,
    }
    updateBootState({
      scrollPositions: updated,
    })
    try {
      void chrome?.storage?.local?.set({ popupScrollPositions: updated })
    } catch {
      // storage unavailable
    }
  } catch {
    // localStorage can be unavailable
  }
}

export function _resetBootStateForTesting() {
  memoryBootCache = {}
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
