import { applyPageStyle } from "../content/pageStyle"
import {
  ACTION_REGISTRY,
  BOOLEAN_KEYS,
  MODE_KEYS,
  validateActionRequest,
  type ActionExecution,
  type PageAction,
  type PageActionRequest,
  type PageActionResult,
} from "./actionRegistry"
import { getFeatureTitle, INSTALLED_FEATURES_KEY, isFeatureInstalled, PAGE_ACTION_FEATURE } from "./features"
import { nearestPreset, stepPlayback } from "./playbackPresets"
import { readSetting } from "./settings"
import { QUALITY_OPTIONS } from "./videoQuality"

export type { PageAction, PageActionRequest, PageActionResult } from "./actionRegistry"

const PROTECTED_PAGE_PATTERNS = [
  "Cannot access a chrome:// URL",
  "cannot be scripted",
  "The extensions gallery cannot be scripted",
  "Cannot access contents of the page",
  "restricted",
]

function normalizeTabError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (PROTECTED_PAGE_PATTERNS.some((pattern) => message.includes(pattern))) {
    return "This page is protected by Chrome and cannot be modified."
  }
  return message
}

type ExecutionOptions<Args extends unknown[], Result> =
  Omit<chrome.scripting.ScriptInjection<Args, Result>, "target"> & {
    func?: (...args: Args) => Result
    args?: Args
  }

async function executeScriptWithFallback<Args extends unknown[] = [], Result = unknown>(
  tabId: number,
  allFrames: boolean,
  options: ExecutionOptions<Args, Result>
): Promise<chrome.scripting.InjectionResult<Awaited<Result>>[]> {
  const target = allFrames ? { tabId, allFrames: true } : { tabId }
  const injection = { target, ...options } as Parameters<typeof chrome.scripting.executeScript>[0]
  const results = allFrames
    ? await chrome.scripting.executeScript(injection).catch(() =>
        chrome.scripting.executeScript({ ...injection, target: { tabId } })
      )
    : await chrome.scripting.executeScript(injection)

  if (!results || results.length === 0) {
    throw new Error("No accessible page frames")
  }
  return results as chrome.scripting.InjectionResult<Awaited<Result>>[]
}

async function applyVideoQualityAction(
  tabId: number,
  settings: Record<string, unknown>
): Promise<string> {
  const targetQuality = typeof settings.videoQuality === "string" ? settings.videoQuality : "hd1080"
  const fallback = settings.videoQualityFallback === "higher" ? "higher" : "lower"

  await executeScriptWithFallback(tabId, true, {
    world: "MAIN", args: [targetQuality, fallback],
    func: (quality: string, fallbackOption: string) => {
      Object.assign(window, { __zedVideoQualitySettings: { quality, fallback: fallbackOption } })
    },
  })
  const results = await executeScriptWithFallback(tabId, true, { files: ["scripts/metaPlayback.js", "scripts/applyVideoQuality.js"], world: "MAIN" })
  const selected = [
    ...new Set(
      results
        .map((result) => result.result)
        .filter((result): result is string => typeof result === "string" && result.length > 0)
    ),
  ]

  if (!selected.length) {
    throw new Error(
      "No controllable video is ready on this page. The saved quality will be retried when a supported player is ready."
    )
  }

  const labels = selected.map(
    (quality) =>
      QUALITY_OPTIONS.find((option) => option.id === quality)?.label ||
      (quality === "auto" ? "Auto" : quality)
  )
  return `Player quality set to ${labels.join(", ")}`
}

async function apply(tabId: number, event: PageAction, settings: Record<string, unknown>): Promise<string | undefined> {
  const definition: ActionExecution = ACTION_REGISTRY[event]
  if (definition.type === "playback") {
    await executeScriptWithFallback(tabId, true, { files: ["scripts/playbackRatePersist.js"] })
    await executeScriptWithFallback(tabId, true, { func: async () => {
      await window.__zedPlaybackReady
      if (!window.__zedPlaybackApply) throw new Error("Playback is unavailable in this frame")
      await window.__zedPlaybackApply()
    } })
  }
  else if (definition.type === "video_quality") return applyVideoQualityAction(tabId, settings)
  else if (definition.type === "style") {
    const enabled = !definition.settingKey || settings[definition.settingKey] === true
    await executeScriptWithFallback(tabId, true, {
      func: applyPageStyle, args: [definition.id, enabled ? definition.css : ""],
    })
  } else {
    const { world = "ISOLATED", allFrames = true, file } = definition
    if (definition.type === "flagged_mode") {
      await executeScriptWithFallback(tabId, allFrames, {
        world, args: [definition.flagKey, settings[definition.settingKey] === definition.onValue],
        func: (key: string, value: boolean) => { Object.assign(window, { [key]: value }) },
      })
    }
    await executeScriptWithFallback(tabId, allFrames, { world, files: [file] })
  }
}

function computeSettingsPatch(
  request: PageActionRequest,
  stored: Record<string, unknown>
): Record<string, unknown> {
  const { event, value } = request
  const patch: Record<string, unknown> = {}

  if (Object.prototype.hasOwnProperty.call(MODE_KEYS, event)) {
    const key = MODE_KEYS[event as keyof typeof MODE_KEYS]
    patch[key] = (value ?? stored[key] !== "on") ? "on" : "off"
  } else if (Object.prototype.hasOwnProperty.call(BOOLEAN_KEYS, event)) {
    const key = BOOLEAN_KEYS[event as keyof typeof BOOLEAN_KEYS]
    patch[key] = value ?? stored[key] !== true
  } else if (event === "volumeBoost") {
    patch.volumeBoost = value
  } else if (event.startsWith("playback")) {
    const currentSpeed = Number(readSetting("speed", stored.speed, 1))
    patch.speed = String(
      event === "playbackRateApply"
        ? nearestPreset(Number(value))
        : stepPlayback(currentSpeed, event === "playbackFaster" ? 1 : -1)
    )
  }

  return patch
}

async function perform(request: PageActionRequest & { tabId: number }): Promise<PageActionResult> {
  let saved = false
  const { tabId } = request

  try {
    const stored = await chrome.storage.local.get(null)
    const requiredFeature = PAGE_ACTION_FEATURE[request.event]
    if (requiredFeature && !isFeatureInstalled(stored[INSTALLED_FEATURES_KEY], requiredFeature)) {
      return { ok: false, saved: false, tabId, error: `${getFeatureTitle(requiredFeature)} is not installed` }
    }
    if (request.event === "applyVideoQuality") {
      saved = stored.videoQuality !== undefined
    }

    const patch = computeSettingsPatch(request, stored)
    if (Object.keys(patch).length > 0) {
      await chrome.storage.local.set(patch)
      saved = true
    }

    const message = await apply(tabId, request.event, { ...stored, ...patch })
    return { ok: true, saved, tabId, ...(message ? { message } : {}) }
  } catch (error) {
    const message = normalizeTabError(error)
    return {
      ok: false,
      saved,
      tabId,
      error: saved ? `Preference saved, but not applied to this page: ${message}` : message,
    }
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
