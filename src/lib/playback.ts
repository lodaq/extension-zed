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
  const facebook = /(^|\.)facebook\.com$/i.test(window.location?.hostname || "")
  const videos = new Map<HTMLVideoElement, () => void>()
  const roots = new Set<Document | ShadowRoot>([document])
  const events = ["loadstart", "loadedmetadata", "play", "playing"]

  function publishSpeed() {
    document.documentElement.setAttribute("data-zed-playback-speed", String(speed))
    document.dispatchEvent(new CustomEvent("zed-playback-speed-changed", { detail: speed }))
  }

  function discover(root: Document | ShadowRoot | Element) {
    function add(element: Element) {
      const shadow = element.shadowRoot
      if (!shadow || roots.has(shadow)) return
      roots.add(shadow)
      observer.observe(shadow, { childList: true, subtree: true })
      discover(shadow)
    }
    if ("shadowRoot" in root) add(root)
    for (const element of root.querySelectorAll("*")) add(element)
  }

  function apply(video: HTMLVideoElement) {
    // Live streams and some players reject particular rates; keep other videos working.
    try { if (video.defaultPlaybackRate !== speed) video.defaultPlaybackRate = speed } catch { /* Unsupported rate */ }
    try { if (video.playbackRate !== speed) video.playbackRate = speed } catch { /* Unsupported rate */ }
  }

  function scan() {
    for (const root of roots) {
      if ("host" in root && root.host.isConnected === false) {
        roots.delete(root)
        continue
      }
      for (const video of root.querySelectorAll("video")) {
        if (videos.has(video)) continue
        const reset = () => apply(video)
        videos.set(video, reset)
        for (const event of events) video.addEventListener(event, reset)
        apply(video)
      }
    }
    for (const [video, reset] of videos) {
      if (video.isConnected === false) {
        for (const event of events) video.removeEventListener(event, reset)
        videos.delete(video)
      }
    }
  }

  function applyAll(value: unknown) {
    speed = nearestPreset(Number(readSetting("speed", value, 1)))
    if (facebook) { publishSpeed(); return }
    discover(document)
    scan()
    for (const video of videos.keys()) apply(video)
  }

  const onStorage: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area === "local" && changes.speed) applyAll(changes.speed.newValue)
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node.nodeType === 1) discover(node as Element)
    }
    scan()
  })
  if (facebook) publishSpeed()
  else {
    observer.observe(document.documentElement, { childList: true, subtree: true })
    discover(document)
    scan()
  }
  chrome.storage.onChanged.addListener(onStorage)
  window.__zedPlaybackApply = async () => {
    const result = await chrome.storage.local.get(["speed"])
    applyAll(result.speed)
  }
  return () => {
    observer.disconnect()
    chrome.storage.onChanged.removeListener(onStorage)
    for (const [video, reset] of videos) {
      for (const event of events) video.removeEventListener(event, reset)
    }
    videos.clear()
    roots.clear()
    delete window.__zedPlaybackReady
    delete window.__zedPlaybackApply
  }
}
