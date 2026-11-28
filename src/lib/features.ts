import type { IconName } from "@/design-system/Icon"
import type { PageAction } from "./actionRegistry"
import { DOWNLOADER_ENABLED } from "./downloader"

export const FEATURE_CATEGORIES = ["Media", "Page tools", "Capture", "Productivity"] as const
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number]
export type FeatureId = "playback" | "quality" | "volume" | "downloader" | "modes" | "scrollbars" | "blackAndWhite" | "capture" | "password" | "limiter" | "hints" | "saveTab"

export interface FeatureDefinition {
  id: FeatureId; title: string; description: string; storeDescription: string; category: FeatureCategory; icon: IconName; available?: boolean
}

const f = (id: FeatureId, title: string, category: FeatureCategory, icon: IconName, description: string, storeDescription: string, available = true): FeatureDefinition =>
  ({ id, title, category, icon, description, storeDescription, available })

export const FEATURES: readonly FeatureDefinition[] = [
  f("playback", "Playback speed", "Media", "playback", "Speed up or slow down video", "Adjust HTML5 video and audio playback speed from 0.1× to 10× and remember it across pages."),
  f("quality", "Video quality", "Media", "quality", "Set a preferred resolution", "Automatically select your preferred video resolution (Auto, 144p–8K) with higher or lower fallback."),
  f("volume", "Volume boost", "Media", "volume", "Amplify audio up to 2000%", "Boost quiet tab audio up to 2000% using Web Audio amplification."),
  f("downloader", "Video downloader", "Media", "download", "Download videos, audio, or trimmed clips with the local helper", "Download videos, extract MP3 audio, or trim clips with the local yt-dlp and ffmpeg helper.", DOWNLOADER_ENABLED),
  f("modes", "Inspect & edit", "Page tools", "modes", "Inspect elements, edit text, and flip RTL", "Inspect page elements, temporarily edit page text in design mode, and switch Arabic-leading text to RTL."),
  f("scrollbars", "Scrollbars", "Page tools", "scrollbars", "Restyle or hide scrollbars", "Apply a minimal custom scrollbar style or hide main and nested scrollbars on any page."),
  f("blackAndWhite", "Grayscale", "Page tools", "contrast", "Show all websites in grayscale", "Display all websites in grayscale across open and newly loaded pages."),
  f("capture", "Screenshots", "Capture", "capture", "Selected area, visible area, full page or element", "Capture a selected area, visible viewport, full rendered page, or element to copy, save, or edit."),
  f("password", "Password generator", "Productivity", "password", "Random, customizable passwords", "Generate cryptographic passwords (4–128 characters) with customizable character sets."),
  f("limiter", "Website limits", "Productivity", "modes", "Timed blocks and daily usage limits", "Set timed website blocks and daily foreground usage limits, with optional system-level protection."),
  f("hints", "Shortcut hints", "Productivity", "keyboard", "Key labels for popup controls", "Display shortcut hint labels on popup controls (always, on F press, or disabled)."),
  f("saveTab", "Save tab & close", "Productivity", "save", "Save this tab’s URL to Read later, then close the tab", "Save the active tab’s URL to Read later and close the tab in one click or keyboard shortcut."),
]

export const AVAILABLE_FEATURES = FEATURES.filter((feature) => feature.available !== false)
export const FEATURE_IDS = FEATURES.map((feature) => feature.id) as readonly FeatureId[]
const FEATURE_BY_ID = new Map<FeatureId, FeatureDefinition>(FEATURES.map((feature) => [feature.id, feature]))

export const INSTALLED_FEATURES_KEY = "installedFeatures"
export const DEFAULT_INSTALLED_FEATURES: readonly FeatureId[] = []

export const isFeatureId = (value: unknown): value is FeatureId => typeof value === "string" && FEATURE_BY_ID.has(value as FeatureId)
export const isValidInstalledFeatures = (value: unknown) => Array.isArray(value) && new Set(value).size === value.length && value.every(isFeatureId)

export function readInstalledFeatures(value: unknown): FeatureId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<FeatureId>()
  return value.filter((item): item is FeatureId => {
    if (!isFeatureId(item) || FEATURE_BY_ID.get(item)?.available === false || seen.has(item)) return false
    seen.add(item)
    return true
  })
}

export const isFeatureInstalled = (installed: unknown, id: FeatureId) => readInstalledFeatures(installed).includes(id)
export const getFeatureTitle = (id: FeatureId) => FEATURE_BY_ID.get(id)?.title ?? id

export const PAGE_ACTION_FEATURE: Partial<Record<PageAction, FeatureId>> = {
  playbackRateApply: "playback", playbackSlower: "playback", playbackFaster: "playback",
  applyVideoQuality: "quality", volumeBoost: "volume",
  hideMainScrollBar: "scrollbars", hideAllScrollBars: "scrollbars", resetMainScrollBar: "scrollbars", resetAllScrollBars: "scrollbars", applyCustomScrollbar: "scrollbars", resetCustomScrollbar: "scrollbars",
  inspectModeApply: "modes", designMode: "modes", arabicRtlMode: "modes",
}

export const SHORTCUT_FEATURE: Partial<Record<string, FeatureId>> = {
  action0: "playback", action1: "playback", action2: "playback",
  action3: "quality", action4: "quality",
  action5: "volume", action6: "volume", action7: "volume",
  action8: "password",
  action9: "scrollbars", action10: "scrollbars", action11: "scrollbars", action12: "scrollbars",
  action13: "modes", action14: "modes", action15: "modes",
  action16: "capture", action17: "capture", action18: "capture", action19: "capture",
  action20: "saveTab", action27: "blackAndWhite", hints: "hints",
}
