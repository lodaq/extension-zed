import type { IconName } from "@/design-system/Icon"
import type { PageAction } from "./actionRegistry"
import { DOWNLOADER_ENABLED } from "./downloader"

export const FEATURE_CATEGORIES = ["Media", "Page tools", "Capture", "Productivity"] as const
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number]

export type FeatureId =
  | "playback"
  | "quality"
  | "volume"
  | "downloader"
  | "modes"
  | "scrollbars"
  | "capture"
  | "password"
  | "limiter"
  | "saveTab"

export interface FeatureDefinition {
  id: FeatureId
  title: string
  description: string
  storeDescription: string
  category: FeatureCategory
  icon: IconName
  available?: boolean
}

export const FEATURES: readonly FeatureDefinition[] = [
  {
    id: "playback",
    title: "Playback speed",
    description: "Speed up or slow down video",
    storeDescription: "Adjust HTML5 video and audio playback speed from 0.1× to 10× and remember it across pages.",
    category: "Media",
    icon: "playback",
  },
  {
    id: "quality",
    title: "Video quality",
    description: "Set a preferred resolution",
    storeDescription: "Automatically select your preferred video resolution (Auto, 144p–8K) with higher or lower fallback.",
    category: "Media",
    icon: "quality",
  },
  {
    id: "volume",
    title: "Volume boost",
    description: "Amplify audio up to 2000%",
    storeDescription: "Boost quiet tab audio up to 2000% using Web Audio amplification.",
    category: "Media",
    icon: "volume",
  },
  {
    id: "downloader",
    title: "Video downloader",
    description: "Download videos, audio, or trimmed clips with the local helper",
    storeDescription: "Download videos, extract MP3 audio, or trim clips with the local yt-dlp and ffmpeg helper.",
    category: "Media",
    icon: "download",
    available: DOWNLOADER_ENABLED,
  },
  {
    id: "modes",
    title: "Modes",
    description: "Inspect, design and RTL",
    storeDescription: "Inspect page elements, temporarily edit page text in design mode, and switch Arabic-leading text to RTL.",
    category: "Page tools",
    icon: "modes",
  },
  {
    id: "scrollbars",
    title: "Scrollbars",
    description: "Restyle or hide scrollbars",
    storeDescription: "Apply a minimal custom scrollbar style or hide main and nested scrollbars on any page.",
    category: "Page tools",
    icon: "scrollbars",
  },
  {
    id: "capture",
    title: "Capture screenshot",
    description: "Selected area, visible area, full page or element",
    storeDescription: "Capture a selected area, visible viewport, full rendered page, or element to copy, save, or edit.",
    category: "Capture",
    icon: "capture",
  },
  {
    id: "password",
    title: "Password generator",
    description: "Random, customizable passwords",
    storeDescription: "Generate cryptographic passwords (4–128 characters) with customizable character sets.",
    category: "Productivity",
    icon: "password",
  },
  {
    id: "limiter",
    title: "Site limiter",
    description: "Locked website blocks and daily usage limits",
    storeDescription: "Set timed website blocks and daily foreground usage limits, with optional system-level protection.",
    category: "Productivity",
    icon: "modes",
  },
  {
    id: "saveTab",
    title: "Save & close tab",
    description: "Save this tab’s URL to Links, then close the tab",
    storeDescription: "Save the active tab’s URL to Links and close the tab in one click or keyboard shortcut.",
    category: "Productivity",
    icon: "save",
  },
] as const

export const AVAILABLE_FEATURES = FEATURES.filter((feature) => feature.available !== false)
export const FEATURE_IDS = FEATURES.map((feature) => feature.id) as readonly FeatureId[]

const FEATURE_BY_ID = new Map<FeatureId, FeatureDefinition>(FEATURES.map((feature) => [feature.id, feature]))

export const INSTALLED_FEATURES_KEY = "installedFeatures"
export const DEFAULT_INSTALLED_FEATURES: readonly FeatureId[] = []

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === "string" && FEATURE_BY_ID.has(value as FeatureId)
}

export function isValidInstalledFeatures(value: unknown): boolean {
  return Array.isArray(value) && new Set(value).size === value.length && value.every((id) => isFeatureId(id))
}

export function readInstalledFeatures(value: unknown): FeatureId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<FeatureId>()
  const result: FeatureId[] = []
  for (const item of value) {
    if (!isFeatureId(item)) continue
    const feature = FEATURE_BY_ID.get(item)
    if (!feature || feature.available === false || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

export function isFeatureInstalled(installed: unknown, id: FeatureId): boolean {
  return readInstalledFeatures(installed).includes(id)
}

export function getFeatureTitle(id: FeatureId): string {
  return FEATURE_BY_ID.get(id)?.title ?? id
}

export const PAGE_ACTION_FEATURE: Partial<Record<PageAction, FeatureId>> = {
  playbackRateApply: "playback",
  playbackSlower: "playback",
  playbackFaster: "playback",
  applyVideoQuality: "quality",
  volumeBoost: "volume",
  hideMainScrollBar: "scrollbars",
  hideAllScrollBars: "scrollbars",
  resetMainScrollBar: "scrollbars",
  resetAllScrollBars: "scrollbars",
  applyCustomScrollbar: "scrollbars",
  resetCustomScrollbar: "scrollbars",
  inspectModeApply: "modes",
  designMode: "modes",
  arabicRtlMode: "modes",
}

export const SHORTCUT_FEATURE: Partial<Record<string, FeatureId>> = {
  action0: "playback",
  action1: "playback",
  action2: "playback",
  action3: "quality",
  action4: "quality",
  action5: "volume",
  action6: "volume",
  action7: "volume",
  action8: "password",
  action9: "scrollbars",
  action10: "scrollbars",
  action11: "scrollbars",
  action12: "scrollbars",
  action13: "modes",
  action14: "modes",
  action15: "modes",
  action16: "capture",
  action17: "capture",
  action18: "capture",
  action19: "capture",
  action20: "saveTab",
}
