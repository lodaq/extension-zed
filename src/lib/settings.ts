import { PLAYBACK_MAX, PLAYBACK_MIN } from "./playbackPresets"
import { QUALITY_LEVEL_MAP } from "./videoQuality"

export const CURRENT_SETTINGS_SCHEMA_VERSION = 1
export const MAX_SETTINGS_FILE_SIZE = 512 * 1024 // 512 KB

export const POPUP_TABS = ["misc", "extensions", "youtube", "settings"] as const
export type PopupTab = (typeof POPUP_TABS)[number]
export const MISC_SECTION_ORDER = ["password", "playback", "volume", "quality", "colors", "scrollbars", "modes"] as const
export type MiscSectionId = (typeof MISC_SECTION_ORDER)[number]
export const isColor = (value: unknown): value is string =>
  typeof value === "string" && (value === "" || /^#[\da-f]{6}$/i.test(value))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const isMode = (value: unknown) => value === "on" || value === "off"
const isBoolean = (value: unknown) => typeof value === "boolean"

const validators: Record<string, (value: unknown) => boolean> = {
  speed: (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) &&
    Number.isFinite(Number(value)) && Number(value) >= PLAYBACK_MIN && Number(value) <= PLAYBACK_MAX,
  volumeBoost: (value) => typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 2000,
  darkTheme: isBoolean,
  youtubeFocus: isBoolean,
  youtubeHideProgress: isBoolean,
  youtubeHideControls: isBoolean,
  youtubeHideDuration: isBoolean,
  youtubeHalfScreen: isBoolean,
  youtubeQualityOpen: isBoolean,
  videoQuality: (value) =>
    typeof value === "string" && (value === "auto" || Object.prototype.hasOwnProperty.call(QUALITY_LEVEL_MAP, value)),
  videoQualityFallback: (value) => value === "higher" || value === "lower",
  inspectMode: isMode,
  designMode: isMode,
  arabicRtlMode: isMode,
  popupActiveTab: (value) => POPUP_TABS.some((tab) => tab === value),
  miscSectionOrder: (value) => Array.isArray(value) && value.length === MISC_SECTION_ORDER.length &&
    new Set(value).size === value.length && MISC_SECTION_ORDER.every(id => value.includes(id)),
  miscExpandedSections: (value) => Array.isArray(value) && new Set(value).size === value.length &&
    value.every(id => MISC_SECTION_ORDER.some(validId => validId === id)),
}

export const RESET_SETTINGS_KEYS = [
  "speed",
  "volumeBoost",
  "darkTheme",
  "youtubeFocus",
  "youtubeHideProgress",
  "youtubeHideControls",
  "youtubeHideDuration",
  "youtubeHalfScreen",
  "youtubeQualityOpen",
  "videoQuality",
  "videoQualityFallback",
  "inspectMode",
  "designMode",
  "arabicRtlMode",
  "popupActiveTab",
  "miscSectionOrder",
  "miscExpandedSections",
] as const

export type ExportPayload = {
  version: number
  exportedAt: string
  settings: Record<string, unknown>
}

function validateColors(key: string, value: unknown) {
  const origin = key.slice("pageColors:".length)
  try {
    const url = new URL(origin)
    if (!/^https?:$/.test(url.protocol) || url.origin !== origin) return false
  } catch { return false }
  return isRecord(value) &&
    (value.background === undefined || isColor(value.background)) &&
    (value.text === undefined || isColor(value.text))
}

export function readSetting<T>(key: string, value: unknown, fallback: T): T {
  return Object.prototype.hasOwnProperty.call(validators, key) && validators[key](value) ? value as T : fallback
}

function recognizedSettings(input: Record<string, unknown>) {
  const settings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (key.startsWith("pageColors:")) {
      if (!validateColors(key, value)) throw new Error(`Invalid setting: ${key}`)
      const colors = value as Record<string, unknown>
      settings[key] = Object.fromEntries(Object.entries(colors).filter(([name]) => name === "background" || name === "text"))
    } else if (Object.prototype.hasOwnProperty.call(validators, key)) {
      if (!validators[key](value)) throw new Error(`Invalid setting: ${key}`)
      settings[key] = value
    }
  }
  return settings
}

export async function exportSettings(): Promise<ExportPayload> {
  return {
    version: CURRENT_SETTINGS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: recognizedSettings(await chrome.storage.local.get(null)),
  }
}

export function migrateSettings(input: unknown) {
  if (!isRecord(input)) throw new Error("Unsupported settings file")
  if (typeof input.version !== "number" || input.version < 1) throw new Error("missing or invalid schema version")
  if (input.version !== CURRENT_SETTINGS_SCHEMA_VERSION) throw new Error(`schema version ${input.version} is not supported`)
  return input
}

export async function importSettings(input: unknown): Promise<void> {
  if (!isRecord(input) || input.version !== CURRENT_SETTINGS_SCHEMA_VERSION || !isRecord(input.settings)) {
    throw new Error("Unsupported settings file")
  }
  const settings = recognizedSettings(input.settings)
  const colorKeys = Object.keys(settings).filter((key) => key.startsWith("pageColors:"))
  if (colorKeys.length) {
    const stored = await chrome.storage.local.get(colorKeys)
    for (const key of colorKeys) {
      const previous = isRecord(stored[key]) ? stored[key] : {}
      const colors = Object.fromEntries(Object.entries(previous).filter(([name, value]) =>
        (name === "background" || name === "text") && isColor(value)))
      settings[key] = { ...colors, ...settings[key] as Record<string, unknown> }
    }
  }
  await chrome.storage.local.set(settings)
}

export async function resetSettings(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  const removeKeys = Object.keys(all).filter((key) =>
    (RESET_SETTINGS_KEYS as readonly string[]).includes(key) ||
    key.startsWith("pageColors:") ||
    key.startsWith("ytMarkers:")
  )
  if (removeKeys.length > 0) {
    await chrome.storage.local.remove(removeKeys)
  }
}

export const resetAllSettings = resetSettings
