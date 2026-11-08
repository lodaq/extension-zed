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

type ExecutionOptions =
  | { files: string[]; world?: `${chrome.scripting.ExecutionWorld}` }
  | { func: () => Promise<void> | void; world?: `${chrome.scripting.ExecutionWorld}` }
  | {
      func: (...args: [string, string]) => void
      args: [string, string]
      world?: `${chrome.scripting.ExecutionWorld}`
    }
  | {
      func: (...args: [string, boolean]) => void
      args: [string, boolean]
      world?: `${chrome.scripting.ExecutionWorld}`
    }

async function executeScriptWithFallback<T = unknown>(
  tabId: number,
  allFrames: boolean,
  options: ExecutionOptions
): Promise<chrome.scripting.InjectionResult<T>[]> {
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
  return results as chrome.scripting.InjectionResult<T>[]
}

async function injectFiles(
  tabId: number,
  files: string[],
  world: "MAIN" | "ISOLATED" = "ISOLATED"
) {
  return executeScriptWithFallback(tabId, true, {
    files,
    world: world as chrome.scripting.ExecutionWorld,
  })
}

async function applyPlaybackAction(tabId: number): Promise<void> {
  await injectFiles(tabId, ["scripts/playbackRatePersist.js"])

  const applyPlayback = async () => {
    await window.__zedPlaybackReady
    if (!window.__zedPlaybackApply) throw new Error("Playback is unavailable in this frame")
    await window.__zedPlaybackApply()
  }

  await executeScriptWithFallback(tabId, true, { func: applyPlayback })
}

async function applyVideoQualityAction(
  tabId: number,
  settings: Record<string, unknown>
): Promise<string> {
  const targetQuality = typeof settings.videoQuality === "string" ? settings.videoQuality : "hd1080"
  const fallback = settings.videoQualityFallback === "higher" ? "higher" : "lower"

  const shareSettings = (quality: string, fallbackOption: string) => {
    Object.assign(window, {
      __zedVideoQualitySettings: { quality, fallback: fallbackOption },
    })
  }

  await executeScriptWithFallback(tabId, true, {
    world: "MAIN",
    func: shareSettings,
    args: [targetQuality, fallback],
  })

  const results = await injectFiles(tabId, ["scripts/applyVideoQuality.js"], "MAIN")
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

async function applyFlaggedModeAction(
  tabId: number,
  definition: Extract<ActionExecution, { type: "flagged_mode" }>,
  settings: Record<string, unknown>
): Promise<void> {
  const { flagKey, world, file, allFrames = true, settingKey, onValue } = definition
  const enabled = settings[settingKey] === onValue
  const executionWorld = world as chrome.scripting.ExecutionWorld

  await executeScriptWithFallback(tabId, allFrames, {
    world: executionWorld,
    func: (key: string, value: boolean) => {
      Object.assign(window, { [key]: value })
    },
    args: [flagKey, enabled],
  })

  await executeScriptWithFallback(tabId, allFrames, {
    world: executionWorld,
    files: [file],
  })
}

async function applyScriptAction(
  tabId: number,
  definition: Extract<ActionExecution, { type: "script" }>
): Promise<void> {
  const allFrames = definition.allFrames ?? true
  const world = (definition.world ?? "ISOLATED") as chrome.scripting.ExecutionWorld
  await executeScriptWithFallback(tabId, allFrames, {
    files: [definition.file],
    world,
  })
}

async function apply(
  tabId: number,
  event: PageAction,
  settings: Record<string, unknown>
): Promise<string | undefined> {
  const definition = ACTION_REGISTRY[event]
  switch (definition.type) {
    case "playback":
      await applyPlaybackAction(tabId)
      return undefined
    case "video_quality":
      return applyVideoQualityAction(tabId, settings)
    case "flagged_mode":
      await applyFlaggedModeAction(tabId, definition, settings)
      return undefined
    case "script":
      await applyScriptAction(tabId, definition)
      return undefined
  }
}

function computeSettingsPatch(
  request: PageActionRequest,
  stored: Record<string, unknown>
): Record<string, unknown> {
  const { event, value } = request
  const patch: Record<string, unknown> = {}

  if (Object.prototype.hasOwnProperty.call(MODE_KEYS, event)) {
    const key = MODE_KEYS[event]
    patch[key] = (value ?? stored[key] !== "on") ? "on" : "off"
  } else if (Object.prototype.hasOwnProperty.call(BOOLEAN_KEYS, event)) {
    const key = BOOLEAN_KEYS[event]
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

async function resolveActiveTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.id
}

async function perform(input: unknown): Promise<PageActionResult> {
  let saved = false
  let tabId: number | undefined

  try {
    const request = validateActionRequest(input)
    tabId = request.tabId
    if (tabId === undefined) throw new Error("No active tab is available")

    const stored = await chrome.storage.local.get(null)
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
    const tabId = request.tabId ?? (await resolveActiveTabId())
    if (tabId === undefined) throw new Error("No active tab is available")

    const result = pending.then(() => perform({ ...request, tabId }))
    pending = result.catch(() => {})
    return result
  } catch (error) {
    return { ok: false, saved: false, error: normalizeTabError(error) }
  }
}
