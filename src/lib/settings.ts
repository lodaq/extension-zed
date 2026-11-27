import { ALL_SHORTCUT_ACTIONS } from "./shortcuts"
import { isHintMode } from "./clickHints"
import { validDownloadDirectory } from "./downloader"
import { isValidInstalledFeatures } from "./features"
import { SAVED_KEY, readSaved, COLLECTIONS_KEY, readCollections } from "./saved"
import { PLAYBACK_MAX, PLAYBACK_MIN } from "./playbackPresets"
import { QUALITY_LEVEL_MAP } from "./videoQuality"

const CURRENT_SETTINGS_SCHEMA_VERSION = 1
export const MAX_SETTINGS_FILE_SIZE = 512 * 1024 // 512 KB

export const POPUP_TABS = ["misc", "extensions", "youtube", "saved", "settings"] as const
export type PopupTab = (typeof POPUP_TABS)[number]
export const MISC_SECTION_ORDER = ["password", "playback", "volume", "quality", "scrollbars", "modes", "screenshot"] as const
export type MiscSectionId = (typeof MISC_SECTION_ORDER)[number]

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean"
const isMode = (value: unknown): value is "on" | "off" => value === "on" || value === "off"
const isValidSpeed = (value: unknown) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) && Number(value) >= PLAYBACK_MIN && Number(value) <= PLAYBACK_MAX
const isValidMiscSectionOrder = (value: unknown) => Array.isArray(value) && (value.length === MISC_SECTION_ORDER.length || value.length === MISC_SECTION_ORDER.length - 1) && new Set(value).size === value.length && MISC_SECTION_ORDER.every((id) => id === "screenshot" || value.includes(id)) && value.every((id) => MISC_SECTION_ORDER.includes(id))
const isValidMiscExpandedSections = (value: unknown) => Array.isArray(value) && new Set(value).size === value.length && value.every((id) => MISC_SECTION_ORDER.some((validId) => validId === id))
const isSavedLinks = (value: unknown) => Array.isArray(value) && value.every(link => {
  if (!isRecord(link) || typeof link.url !== "string" || typeof link.title !== "string" || typeof link.href !== "string") return false
  try { return ["http:", "https:", "chrome:", "chrome-extension:", "edge:", "brave:", "about:", "view-source:", "devtools:", "file:"].includes(new URL(link.href).protocol) }
  catch { return false }
})
const isShortcutMap = (value: unknown) => isRecord(value) && Object.entries(value).every(([key, combo]) => ALL_SHORTCUT_ACTIONS.some(action => action.id === key) && typeof combo === "string" && combo.length <= 100)

const validators = {
  popupLocation: value => isRecord(value) && ["Misc", "Extensions", "YouTube", "Links", "Saved", "Shortcuts"].includes(value.tab as string) && (value.detail === null || ["store", "playback", "quality", "password", "volume", "scrollbars", "modes", "blackAndWhite", "capture", "limiter", "hints", "downloader"].includes(value.detail as string)) && typeof value.settings === "boolean",
  installedFeatures: isValidInstalledFeatures,
  keyboardShortcuts: isShortcutMap,
  hintMode: isHintMode,
  downloaderDirectory: value => typeof value === "string" && validDownloadDirectory(value),
  savedButtonsEnabled: isBoolean,
  savedLinks: isSavedLinks,
  speed: isValidSpeed,
  volumeBoost: value => typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 2000,
  darkTheme: isBoolean,
  blackAndWhite: isBoolean,
  youtubeFocus: isBoolean,
  youtubeHideProgress: isBoolean,
  youtubeHideControls: isBoolean,
  youtubeHideDuration: isBoolean,
  youtubeHideTimestamps: isBoolean,
  youtubeHideAllTimestamps: isBoolean,
  youtubeHalfScreen: isBoolean,
  youtubeQualityOpen: isBoolean,
  videoQuality: value => typeof value === "string" && (value === "auto" || Object.prototype.hasOwnProperty.call(QUALITY_LEVEL_MAP, value)),
  videoQualityFallback: value => value === "higher" || value === "lower",
  inspectMode: isMode,
  designMode: isMode,
  arabicRtlMode: isMode,
  popupActiveTab: value => POPUP_TABS.some(tab => tab === value),
  miscSectionOrder: isValidMiscSectionOrder,
  miscExpandedSections: isValidMiscExpandedSections,
} satisfies Record<string, (value: unknown) => boolean>

export type KnownSettingKey = keyof typeof validators
export const RESET_SETTINGS_KEYS = Object.keys(validators).filter(key => key !== "savedLinks") as Exclude<KnownSettingKey, "savedLinks">[]
const RESET_KEY_SET = new Set<string>(RESET_SETTINGS_KEYS)
const isKnownSettingKey = (key: string): key is KnownSettingKey => Object.prototype.hasOwnProperty.call(validators, key)

export function readSetting<T>(key: string, value: unknown, fallback: T): T {
  if (key === COLLECTIONS_KEY) return readCollections(value) as T
  if (key === SAVED_KEY) return readSaved(value) as T
  if (!isKnownSettingKey(key) || !validators[key](value)) return fallback
  if (key === "miscSectionOrder" && Array.isArray(value) && !value.includes("screenshot")) return [...value, "screenshot"] as T
  return value as T
}

function recognizedSettings(input: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!isKnownSettingKey(key)) continue
    if (!validators[key](value)) throw new Error(`Invalid setting: ${key}`)
    settings[key] = readSetting(key, value, value)
  }
  return settings
}

export async function exportSettings() {
  return { version: CURRENT_SETTINGS_SCHEMA_VERSION, exportedAt: new Date().toISOString(), settings: recognizedSettings(await chrome.storage.local.get(null)) }
}

export function migrateSettings(input: unknown) {
  if (!isRecord(input)) throw new Error("Unsupported settings file")
  if (typeof input.version !== "number" || input.version < 1) throw new Error("missing or invalid schema version")
  if (input.version !== CURRENT_SETTINGS_SCHEMA_VERSION) throw new Error(`schema version ${input.version} is not supported`)
  return input
}

export async function importSettings(input: unknown): Promise<void> {
  const file = migrateSettings(input)
  if (!isRecord(file.settings)) throw new Error("Unsupported settings file")
  await chrome.storage.local.set(recognizedSettings(file.settings))
}

export async function resetSettings(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  const removeKeys = Object.keys(all).filter(key => RESET_KEY_SET.has(key) || key.startsWith("ytMarkers:"))
  if (removeKeys.length > 0) await chrome.storage.local.remove(removeKeys)
}
