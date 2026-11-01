import { nearestPreset } from "./playbackPresets"
import { readSetting } from "./settings"

declare global {
  interface Window {
    __zedPlaybackReady?: Promise<() => void>
    __zedPlaybackApply?: () => Promise<void>
  }
}

export function installPlayback(): Promise<() => void> {
  if (window.__zedPlaybackReady) return window.__zedPlaybackReady
  const ready = initialize().catch((error) => {
    delete window.__zedPlaybackReady
    throw error
  })
  window.__zedPlaybackReady = ready
  return ready
}

async function initialize() {
  const stored = await chrome.storage.local.get(["speed"])
  let speed = nearestPreset(Number(readSetting("speed", stored.speed, 1)))
  const videos = new Map<HTMLVideoElement, { source: string; reset: () => void; metadata: () => void }>()

  function apply(video: HTMLVideoElement) {
    if (video.playbackRate !== speed) video.playbackRate = speed
  }

  function scan() {
    for (const video of document.querySelectorAll("video")) {
      if (videos.has(video)) continue
      const state = {
        source: video.currentSrc,
        reset: () => {
          state.source = video.currentSrc
          apply(video)
        },
        metadata: () => {
          if (state.source !== video.currentSrc) state.reset()
        },
      }
      videos.set(video, state)
      video.addEventListener("loadstart", state.reset)
      video.addEventListener("loadedmetadata", state.metadata)
      apply(video)
    }
    for (const [video, state] of videos) {
      if (video.isConnected === false) {
        video.removeEventListener("loadstart", state.reset)
        video.removeEventListener("loadedmetadata", state.metadata)
        videos.delete(video)
      }
    }
  }

  function applyAll(value: unknown) {
    speed = nearestPreset(Number(readSetting("speed", value, 1)))
    scan()
    for (const video of videos.keys()) apply(video)
  }

  const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area === "local" && changes.speed) applyAll(changes.speed.newValue)
  }
  scan()
  const observer = new MutationObserver(scan)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  chrome.storage.onChanged.addListener(onStorage)
  window.__zedPlaybackApply = async () => {
    const result = await chrome.storage.local.get(["speed"])
    applyAll(result.speed)
  }
  return () => {
    observer.disconnect()
    chrome.storage.onChanged.removeListener(onStorage)
    for (const [video, state] of videos) {
      video.removeEventListener("loadstart", state.reset)
      video.removeEventListener("loadedmetadata", state.metadata)
    }
    videos.clear()
    delete window.__zedPlaybackReady
    delete window.__zedPlaybackApply
  }
}
