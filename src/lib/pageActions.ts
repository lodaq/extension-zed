import {
  ACTION_REGISTRY,
  BOOLEAN_KEYS,
  MODE_KEYS,
  validateActionRequest,
  type PageAction,
  type PageActionResult,
} from "./actionRegistry"
import { nearestPreset, stepPlayback } from "./playbackPresets"
import { isColor, readSetting } from "./settings"
import { QUALITY_OPTIONS } from "./videoQuality"

export type { PageAction, PageActionRequest, PageActionResult } from "./actionRegistry"

function normalizeTabError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (
    message.includes("Cannot access a chrome:// URL") ||
    message.includes("cannot be scripted") ||
    message.includes("The extensions gallery cannot be scripted") ||
    message.includes("Cannot access contents of the page") ||
    message.includes("restricted")
  ) {
    return "This page is protected by Chrome and cannot be modified."
  }
  return message
}

async function inject(tabId: number, files: string[], world: "MAIN" | "ISOLATED" = "ISOLATED") {
  const executionWorld = world as chrome.scripting.ExecutionWorld
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files, world: executionWorld })
    .catch(() => chrome.scripting.executeScript({ target: { tabId }, files, world: executionWorld }))
  if (!results.length) throw new Error("No accessible page frames")
  return results
}

async function apply(tabId: number, event: PageAction, settings: Record<string, unknown>) {
  const definition = ACTION_REGISTRY[event]
  if (definition.type === "playback") {
    await inject(tabId, ["scripts/playbackRatePersist.js"])
    const applyPlayback = async () => {
      await window.__zedPlaybackReady
      if (!window.__zedPlaybackApply) throw new Error("Playback is unavailable in this frame")
      await window.__zedPlaybackApply()
    }
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: applyPlayback,
    }).catch(() => chrome.scripting.executeScript({
      target: { tabId },
      func: applyPlayback,
    }))
    if (!results.length) throw new Error("No accessible page frames")
  } else if (definition.type === "video_quality") {
    const targetQuality = typeof settings.videoQuality === "string" ? settings.videoQuality : "hd1080"
    const fallback = settings.videoQualityFallback === "higher" ? "higher" : "lower"
    const shareSettings = (q: string, fb: string) => {
      Object.assign(window, { __zedVideoQualitySettings: { quality: q, fallback: fb } })
    }
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: "MAIN",
      func: shareSettings,
      args: [targetQuality, fallback],
    }).catch(() => chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: shareSettings,
      args: [targetQuality, fallback],
    }))
    const results = await inject(tabId, ["scripts/applyVideoQuality.js"], "MAIN")
    const selected = [...new Set(results.map(result => result.result).filter((result): result is string => typeof result === "string" && result.length > 0))]
    if (!selected.length) throw new Error("No controllable video is ready on this page. The saved quality will be retried when a supported player is ready.")
    const labels = selected.map(quality => QUALITY_OPTIONS.find(option => option.id === quality)?.label || (quality === "auto" ? "Auto" : quality))
    return `Player quality set to ${labels.join(", ")}`
  } else if (definition.type === "flagged_mode") {
    const { flagKey, world, file, allFrames, settingKey, onValue } = definition
    const enabled = settings[settingKey] === onValue
    const executionWorld = world as chrome.scripting.ExecutionWorld
    const target = allFrames ? { tabId, allFrames: true } : { tabId }
    await chrome.scripting.executeScript({
      target,
      world: executionWorld,
      func: (key: string, value: boolean) => { Object.assign(window, { [key]: value }) },
      args: [flagKey, enabled],
    }).catch(() => chrome.scripting.executeScript({
      target: { tabId },
      world: executionWorld,
      func: (key: string, value: boolean) => { Object.assign(window, { [key]: value }) },
      args: [flagKey, enabled],
    }))
    if (allFrames) {
      await inject(tabId, [file], world)
    } else {
      await chrome.scripting.executeScript({ target: { tabId }, files: [file] })
    }
  } else if (definition.type === "script") {
    await inject(tabId, [definition.file], definition.world ?? "ISOLATED")
  }
}

// Serialize read/modify/write actions because injected scripts read their saved preference.
let pending: Promise<unknown> = Promise.resolve()
export async function handlePageAction(input: unknown): Promise<PageActionResult> {
  try {
    const request = validateActionRequest(input)
    const tabId = request.tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
    if (tabId === undefined) throw new Error("No active tab is available")
    const result = pending.then(() => perform({ ...request, tabId }))
    pending = result.catch(() => {})
    return result
  } catch (error) {
    return { ok: false, saved: false, error: normalizeTabError(error) }
  }
}

async function perform(input: unknown): Promise<PageActionResult> {
  let saved = false
  let tabId: number | undefined
  try {
    const request = validateActionRequest(input)
    tabId = request.tabId
    if (tabId === undefined) throw new Error("No active tab is available")
    const { event, value } = request
    const stored = await chrome.storage.local.get(null)
    if (event === "applyVideoQuality") saved = stored.videoQuality !== undefined
    const patch: Record<string, unknown> = {}
    if (Object.prototype.hasOwnProperty.call(MODE_KEYS, event)) {
      const key = MODE_KEYS[event]
      patch[key] = (value ?? stored[key] !== "on") ? "on" : "off"
    } else if (Object.prototype.hasOwnProperty.call(BOOLEAN_KEYS, event)) {
      const key = BOOLEAN_KEYS[event]
      patch[key] = value ?? (stored[key] !== true)
    } else if (event === "volumeBoost") {
      patch.volumeBoost = value
    } else if (event.startsWith("playback")) {
      patch.speed = String(event === "playbackRateApply" ? nearestPreset(Number(value)) :
        stepPlayback(Number(readSetting("speed", stored.speed, 1)), event === "playbackFaster" ? 1 : -1))
    } else if (["changeBackgroundColor", "changeColor", "resetBackgroundOnly", "resetTextColorOnly", "resetPageColors"].includes(event)) {
      const tab = await chrome.tabs.get(tabId)
      if (!tab.url) throw new Error("This page is protected by Chrome and cannot be modified.")
      let url: URL
      try {
        url = new URL(tab.url)
      } catch {
        throw new Error("Page colors require an HTTP or HTTPS page")
      }
      if (!/^https?:$/.test(url.protocol)) throw new Error("Page colors require an HTTP or HTTPS page")
      const key = `pageColors:${url.origin}`
      const previous = stored[key] as { background?: unknown; text?: unknown } | undefined
      const colors = { background: isColor(previous?.background) ? previous.background : "", text: isColor(previous?.text) ? previous.text : "" }
      if (event === "changeBackgroundColor") colors.background = String(value)
      if (event === "changeColor") colors.text = String(value)
      if (event === "resetBackgroundOnly" || event === "resetPageColors") colors.background = ""
      if (event === "resetTextColorOnly" || event === "resetPageColors") colors.text = ""
      patch[key] = colors
    }
    if (Object.keys(patch).length) {
      await chrome.storage.local.set(patch)
      saved = true
    }
    const message = await apply(tabId, event, { ...stored, ...patch })
    return { ok: true, saved, tabId, ...(message ? { message } : {}) }
  } catch (error) {
    const message = normalizeTabError(error)
    return { ok: false, saved, tabId, error: saved ? `Preference saved, but not applied to this page: ${message}` : message }
  }
}
