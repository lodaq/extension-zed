import {
  YOUTUBE_STYLE_SETTING_KEYS,
  cssForYoutubeStyles,
  type YoutubeStyleState,
} from "../lib/youtubeStyles"

const STYLE_ID = "zed-youtube-styles"
const CACHE_KEY = "zed.youtubeStyles"

function normalizeState(value: unknown): YoutubeStyleState {
  const state: YoutubeStyleState = {}
  if (!value || typeof value !== "object" || Array.isArray(value)) return state
  for (const key of YOUTUBE_STYLE_SETTING_KEYS) {
    state[key] = (value as Record<string, unknown>)[key] === true
  }
  return state
}

function readCache(): YoutubeStyleState | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null")
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return normalizeState(value)
  } catch {
    return null
  }
}

function writeCache(state: YoutubeStyleState) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)) } catch { /* Storage may be unavailable. */ }
}

function applyStyles(state: YoutubeStyleState) {
  const css = cssForYoutubeStyles(state)
  const existing = document.getElementById(STYLE_ID)
  if (!css) {
    existing?.remove()
    return
  }

  const style = (existing as HTMLStyleElement | null) ?? document.createElement("style")
  if (!style.isConnected) {
    style.id = STYLE_ID
    const root = document.head || document.documentElement
    if (!root) return
    root.appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}

// Apply cached preferences synchronously so enabled styles are present before first paint.
const cached = readCache()
const state: YoutubeStyleState = cached ?? {}
const changedDuringHydration = new Set<(typeof YOUTUBE_STYLE_SETTING_KEYS)[number]>()
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
