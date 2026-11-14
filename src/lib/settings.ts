import { SAVED_KEY, readSaved } from "./saved"
import { PLAYBACK_MAX, PLAYBACK_MIN } from "./playbackPresets"
import { QUALITY_LEVEL_MAP } from "./videoQuality"

export const CURRENT_SETTINGS_SCHEMA_VERSION = 1
export const MAX_SETTINGS_FILE_SIZE = 512 * 1024 // 512 KB

export const POPUP_TABS = ["misc", "extensions", "youtube", "saved", "settings"] as const
export type PopupTab = (typeof POPUP_TABS)[number]

export const MISC_SECTION_ORDER = [
  "password",
  "playback",
  "volume",
  "quality",
  "scrollbars",
  "modes",
  "screenshot",
] as const
export type MiscSectionId = (typeof MISC_SECTION_ORDER)[number]

export const RESET_SETTINGS_KEYS = [
  "speed",
  "volumeBoost",
  "darkTheme",
  "blackAndWhite",
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
export type KnownSettingKey = (typeof RESET_SETTINGS_KEYS)[number]

export interface ExportPayload {
  version: number
  exportedAt: string
  settings: Record<string, unknown>
}

export interface RawSettingsFile {
  version?: unknown
  settings?: unknown
  exportedAt?: unknown
  [key: string]: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean"

const isMode = (value: unknown): value is "on" | "off" => value === "on" || value === "off"

function isValidSpeed(value: unknown): boolean {
  if (typeof value !== "number" && (typeof value !== "string" || value.trim() === "")) {
    return false
  }
  const num = Number(value)
  return Number.isFinite(num) && num >= PLAYBACK_MIN && num <= PLAYBACK_MAX
}

function isValidVolumeBoost(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 2000
}

function isValidVideoQuality(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value === "auto" || Object.prototype.hasOwnProperty.call(QUALITY_LEVEL_MAP, value))
  )
}

function isValidVideoQualityFallback(value: unknown): boolean {
  return value === "higher" || value === "lower"
}

function isValidPopupTab(value: unknown): boolean {
  return POPUP_TABS.some((tab) => tab === value)
}

function isValidMiscSectionOrder(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    (value.length === MISC_SECTION_ORDER.length || value.length === MISC_SECTION_ORDER.length - 1) &&
    new Set(value).size === value.length &&
    MISC_SECTION_ORDER.every((id) => id === "screenshot" || value.includes(id)) &&
    value.every((id) => MISC_SECTION_ORDER.includes(id))
  )
}

function isValidMiscExpandedSections(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((id) => MISC_SECTION_ORDER.some((validId) => validId === id))
  )
}

type SettingValidator = (value: unknown) => boolean

const validators: Record<KnownSettingKey, SettingValidator> = {
  speed: isValidSpeed,
  volumeBoost: isValidVolumeBoost,
  darkTheme: isBoolean,
  blackAndWhite: isBoolean,
  youtubeFocus: isBoolean,
  youtubeHideProgress: isBoolean,
  youtubeHideControls: isBoolean,
  youtubeHideDuration: isBoolean,
  youtubeHalfScreen: isBoolean,
  youtubeQualityOpen: isBoolean,
  videoQuality: isValidVideoQuality,
  videoQualityFallback: isValidVideoQualityFallback,
  inspectMode: isMode,
  designMode: isMode,
  arabicRtlMode: isMode,
  popupActiveTab: isValidPopupTab,
  miscSectionOrder: isValidMiscSectionOrder,
  miscExpandedSections: isValidMiscExpandedSections,
}

const RESET_KEY_SET = new Set<string>(RESET_SETTINGS_KEYS)

function isKnownSettingKey(key: string): key is KnownSettingKey {
  return Object.prototype.hasOwnProperty.call(validators, key)
}

export function readSetting<T>(key: string, value: unknown, fallback: T): T {
  if (key === SAVED_KEY) return readSaved(value) as T
  if (isKnownSettingKey(key) && validators[key](value)) {
    if (key === "miscSectionOrder" && Array.isArray(value) && !value.includes("screenshot")) {
      return [...value, "screenshot"] as T
    }
    return value as T
  }
  return fallback
}

function recognizedSettings(input: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (isKnownSettingKey(key)) {
      if (!validators[key](value)) {
        throw new Error(`Invalid setting: ${key}`)
      }
      settings[key] = readSetting(key, value, value)
    }
  }
  return settings
}

export async function exportSettings(): Promise<ExportPayload> {
  const stored = await chrome.storage.local.get(null)
  return {
    version: CURRENT_SETTINGS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    settings: recognizedSettings(stored),
  }
}

export function migrateSettings(input: unknown): RawSettingsFile {
  if (!isRecord(input)) {
    throw new Error("Unsupported settings file")
  }
  if (typeof input.version !== "number" || input.version < 1) {
    throw new Error("missing or invalid schema version")
  }
  if (input.version !== CURRENT_SETTINGS_SCHEMA_VERSION) {
    throw new Error(`schema version ${input.version} is not supported`)
  }
  return input
}

export async function importSettings(input: unknown): Promise<void> {
  const file = migrateSettings(input)
  if (!isRecord(file.settings)) {
    throw new Error("Unsupported settings file")
  }
  const settings = recognizedSettings(file.settings)
  await chrome.storage.local.set(settings)
}

function isResetKey(key: string): boolean {
  return RESET_KEY_SET.has(key) || key.startsWith("ytMarkers:")
}

export async function resetSettings(): Promise<void> {
  const all = await chrome.storage.local.get(null)
  const removeKeys = Object.keys(all).filter(isResetKey)
  if (removeKeys.length > 0) {
    await chrome.storage.local.remove(removeKeys)
  }
}

export const resetAllSettings = resetSettings
