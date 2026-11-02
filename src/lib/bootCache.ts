import { MISC_SECTION_ORDER, POPUP_TABS, type MiscSectionId, type PopupTab } from "./settings"

export type BootState = {
  tab?: PopupTab
  dark?: boolean
  order?: readonly MiscSectionId[]
}

const STORAGE_KEY = "zed.boot"

const isPopupTab = (value: unknown): value is PopupTab =>
  typeof value === "string" && POPUP_TABS.some((tab) => tab === value)

const isSectionOrder = (value: unknown): value is MiscSectionId[] =>
  Array.isArray(value) && value.length === MISC_SECTION_ORDER.length &&
  new Set(value).size === value.length && MISC_SECTION_ORDER.every((id) => value.includes(id))

/**
 * Synchronous snapshot used only to paint the first frame. chrome.storage.local
 * remains the source of truth; this mirror only avoids a blank or mis-sized
 * first paint while that asynchronous read is in flight.
 */
export function readBootState(): BootState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    if (value === null || typeof value !== "object" || Array.isArray(value)) return {}
    const record = value as Record<string, unknown>
    return {
      tab: isPopupTab(record.tab) ? record.tab : undefined,
      dark: typeof record.dark === "boolean" ? record.dark : undefined,
      order: isSectionOrder(record.order) ? record.order : undefined,
    }
  } catch {
    return {}
  }
}

export function updateBootState(patch: BootState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readBootState(), ...patch }))
  } catch {
    // localStorage can be unavailable; the next open falls back to defaults.
  }
}

export function mirrorBootValue(key: string, value: unknown) {
  if (key === "darkTheme" && typeof value === "boolean") updateBootState({ dark: value })
  else if (key === "miscSectionOrder" && isSectionOrder(value)) updateBootState({ order: value })
}
