import { nearestPreset, stepPlayback } from "./playbackPresets"
import { isColor, readSetting } from "./settings"

const SCRIPT_EVENTS = {
  changeBackgroundColor: "scripts/applyPageColors.js",
  changeColor: "scripts/applyPageColors.js",
  resetPageColors: "scripts/applyPageColors.js",
  resetBackgroundOnly: "scripts/applyPageColors.js",
  resetTextColorOnly: "scripts/applyPageColors.js",
  inspectModeApply: "scripts/inspectMode.js",
  hideMainScrollBar: "scripts/hideMainScrollBar.js",
  hideAllScrollBars: "scripts/hideAllScrollBars.js",
  resetMainScrollBar: "scripts/resetMainScrollBar.js",
  resetAllScrollBars: "scripts/resetAllScrollBars.js",
  hideYoutubeProgressBar: "scripts/youtubeProgressBar.js",
  hideYoutubeControls: "scripts/youtubeControls.js",
  volumeBoost: "scripts/volumeBoost.js",
  arabicRtlMode: "scripts/arabicRtlMode.js",
} as const

export type PageAction = keyof typeof SCRIPT_EVENTS | "designMode" | "youtubeFocus" |
  "playbackRateApply" | "playbackSlower" | "playbackFaster"
type ModeAction = keyof typeof MODE_KEYS | keyof typeof BOOLEAN_KEYS
type ColorAction = "changeBackgroundColor" | "changeColor"
type ValueAction = "playbackRateApply" | "volumeBoost"
export type PageActionRequest = { tabId?: number } & (
  { event: ModeAction; value?: boolean } |
  { event: ColorAction; value: string } |
  { event: ValueAction; value: number } |
  { event: Exclude<PageAction, ModeAction | ColorAction | ValueAction>; value?: never }
)
export type PageActionResult = { ok: boolean; saved: boolean; error?: string; tabId?: number }

const MODE_KEYS = { designMode: "designMode", inspectModeApply: "inspectMode", arabicRtlMode: "arabicRtlMode" } as const
const BOOLEAN_KEYS = { youtubeFocus: "youtubeFocus", hideYoutubeProgressBar: "youtubeHideProgress", hideYoutubeControls: "youtubeHideControls" } as const

export function requestForCommand(command: string): PageActionRequest | undefined {
  const commands: Record<string, PageActionRequest> = {
    zed_playback_slower: { event: "playbackSlower" },
    zed_playback_faster: { event: "playbackFaster" },
    zed_playback_normal: { event: "playbackRateApply", value: 1 },
    zed_playback_double: { event: "playbackRateApply", value: 2 },
    zed_youtube_focus: { event: "youtubeFocus" },
    zed_youtube_progress_bar: { event: "hideYoutubeProgressBar" },
    zed_scrollbar_main: { event: "hideMainScrollBar" },
    zed_scrollbar_all: { event: "hideAllScrollBars" },
    zed_design_mode: { event: "designMode" },
    zed_inspect: { event: "inspectModeApply" },
    zed_reset_page_colors: { event: "resetPageColors" },
  }
  return Object.prototype.hasOwnProperty.call(commands, command) ? commands[command] : undefined
}

function validate(input: unknown): PageActionRequest {
  if (!input || typeof input !== "object") throw new Error("No page action was provided")
  const request = input as PageActionRequest
  const { event, value, tabId } = request
  if (!Object.prototype.hasOwnProperty.call(SCRIPT_EVENTS, event) &&
    !["designMode", "youtubeFocus", "playbackRateApply", "playbackSlower", "playbackFaster"].includes(event)) {
    throw new Error("Unknown page action")
  }
  if (tabId !== undefined && (!Number.isInteger(tabId) || tabId < 0)) throw new Error("Invalid tab")
  if (event === "changeBackgroundColor" || event === "changeColor") {
    if (!isColor(value) || value === "") throw new Error("Choose a six-digit hex color")
  } else if (event === "volumeBoost") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 2000) throw new Error("Invalid volume boost")
  } else if (event === "playbackRateApply") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid playback speed")
  } else if (Object.prototype.hasOwnProperty.call(MODE_KEYS, event) || Object.prototype.hasOwnProperty.call(BOOLEAN_KEYS, event)) {
    if (value !== undefined && typeof value !== "boolean") throw new Error("Invalid mode value")
  } else if (value !== undefined) throw new Error("This action does not accept a value")
  return request
}

async function inject(tabId: number, files: string[], world: "MAIN" | "ISOLATED" = "ISOLATED") {
  const executionWorld = world as chrome.scripting.ExecutionWorld
  const results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files, world: executionWorld })
    .catch(() => chrome.scripting.executeScript({ target: { tabId }, files, world: executionWorld }))
  if (!results.length) throw new Error("No accessible page frames")
}

async function apply(tabId: number, event: PageAction, settings: Record<string, unknown>) {
  if (event.startsWith("playback")) {
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
  } else if (event === "designMode" || event === "youtubeFocus") {
    const flag = event === "designMode" ? "__zedDesignModeFlag" : "__zedYoutubeFocusEnabled"
    const enabled = event === "designMode" ? settings.designMode === "on" : settings.youtubeFocus === true
    const world = (event === "designMode" ? "MAIN" : "ISOLATED") as chrome.scripting.ExecutionWorld
    const target = event === "designMode" ? { tabId, allFrames: true } : { tabId }
    await chrome.scripting.executeScript({ target, world, func: (key: string, value: boolean) => { Object.assign(window, { [key]: value }) }, args: [flag, enabled] })
      .catch(() => chrome.scripting.executeScript({ target: { tabId }, world, func: (key: string, value: boolean) => { Object.assign(window, { [key]: value }) }, args: [flag, enabled] }))
    if (event === "designMode") await inject(tabId, ["scripts/designMode.js"], "MAIN")
    else await chrome.scripting.executeScript({ target: { tabId }, files: ["scripts/youtubeFocusMode.js"] })
  } else {
    await inject(tabId, [SCRIPT_EVENTS[event as keyof typeof SCRIPT_EVENTS]])
  }
}

// Serialize read/modify/write actions because injected scripts read their saved preference.
let pending: Promise<unknown> = Promise.resolve()
export async function handlePageAction(input: unknown): Promise<PageActionResult> {
  try {
    const request = validate(input)
    const tabId = request.tabId ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
    if (tabId === undefined) throw new Error("No active tab is available")
    const result = pending.then(() => perform({ ...request, tabId }))
    pending = result.catch(() => {})
    return result
  } catch (error) {
    return { ok: false, saved: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function perform(input: unknown): Promise<PageActionResult> {
  let saved = false
  let tabId: number | undefined
  try {
    const request = validate(input)
    tabId = request.tabId
    if (tabId === undefined) throw new Error("No active tab is available")
    const { event, value } = request
    const stored = await chrome.storage.local.get(null)
    const patch: Record<string, unknown> = {}
    if (Object.prototype.hasOwnProperty.call(MODE_KEYS, event)) {
      const key = MODE_KEYS[event as keyof typeof MODE_KEYS]
      patch[key] = (value ?? stored[key] !== "on") ? "on" : "off"
    } else if (Object.prototype.hasOwnProperty.call(BOOLEAN_KEYS, event)) {
      const key = BOOLEAN_KEYS[event as keyof typeof BOOLEAN_KEYS]
      patch[key] = value ?? (stored[key] !== true)
    } else if (event === "volumeBoost") patch.volumeBoost = value
    else if (event.startsWith("playback")) {
      patch.speed = String(event === "playbackRateApply" ? nearestPreset(Number(value)) :
        stepPlayback(Number(readSetting("speed", stored.speed, 1)), event === "playbackFaster" ? 1 : -1))
    } else if (["changeBackgroundColor", "changeColor", "resetBackgroundOnly", "resetTextColorOnly", "resetPageColors"].includes(event)) {
      const tab = await chrome.tabs.get(tabId)
      const url = new URL(tab.url ?? "")
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
    await apply(tabId, event, { ...stored, ...patch })
    return { ok: true, saved, tabId }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, saved, tabId, error: saved ? `Preference saved, but not applied to this page: ${message}` : message }
  }
}
