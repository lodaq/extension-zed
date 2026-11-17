import {
  YOUTUBE_STYLE_SETTING_KEYS,
  cssForYoutubeStyles,
  type YoutubeStyleState,
} from "../lib/youtubeStyles"
import { applyPageStyle } from "./pageStyle"

const STYLE_ID = "zed-youtube-styles"
const CACHE_KEY = "zed.youtubeStyles"

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function normalizeState(value: unknown): YoutubeStyleState {
  const record = asRecord(value)
  const state: YoutubeStyleState = {}
  if (!record) return state
  for (const key of YOUTUBE_STYLE_SETTING_KEYS) {
    state[key] = record[key] === true
  }
  return state
}

function readCache(): YoutubeStyleState | null {
  try {
    const record = asRecord(JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"))
    return record ? normalizeState(record) : null
  } catch {
    return null
  }
}

function writeCache(state: YoutubeStyleState) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)) } catch { /* Storage may be unavailable. */ }
}

function applyStyles(state: YoutubeStyleState) {
  applyPageStyle(STYLE_ID, cssForYoutubeStyles(state))
}

// Apply cached preferences synchronously so enabled styles are present before first paint.
const cached = readCache()
const state: YoutubeStyleState = cached ?? {}
const changedDuringHydration = new Set<keyof YoutubeStyleState>()
if (cached) applyStyles(state)

void chrome.storage.local.get(YOUTUBE_STYLE_SETTING_KEYS).then((stored) => {
  const hydrated = normalizeState(stored)
  for (const key of YOUTUBE_STYLE_SETTING_KEYS) {
    if (!changedDuringHydration.has(key)) state[key] = hydrated[key]
  }
  changedDuringHydration.clear()
  applyStyles(state)
  writeCache(state)
}).catch(console.error)

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return
  let changed = false
  for (const key of YOUTUBE_STYLE_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(changes, key)) continue
    changedDuringHydration.add(key)
    state[key] = changes[key].newValue === true
    changed = true
  }
  if (!changed) return
  applyStyles(state)
  writeCache(state)
})
