import { isColor } from "./settings"

export type ScriptAction =
  | "changeBackgroundColor"
  | "changeColor"
  | "resetPageColors"
  | "resetBackgroundOnly"
  | "resetTextColorOnly"
  | "inspectModeApply"
  | "hideMainScrollBar"
  | "hideAllScrollBars"
  | "resetMainScrollBar"
  | "resetAllScrollBars"
  | "applyCustomScrollbar"
  | "resetCustomScrollbar"
  | "hideYoutubeProgressBar"
  | "hideYoutubeControls"
  | "hideYoutubeDuration"
  | "youtubeHalfScreen"
  | "volumeBoost"
  | "arabicRtlMode"

export type SpecialAction =
  | "designMode"
  | "youtubeFocus"
  | "playbackRateApply"
  | "playbackSlower"
  | "playbackFaster"
  | "applyVideoQuality"

export type PageAction = ScriptAction | SpecialAction

export type ModeAction =
  | "designMode"
  | "inspectModeApply"
  | "arabicRtlMode"
  | "youtubeFocus"
  | "hideYoutubeProgressBar"
  | "hideYoutubeControls"
  | "hideYoutubeDuration"
  | "youtubeHalfScreen"

export type ColorAction = "changeBackgroundColor" | "changeColor"
export type ValueAction = "playbackRateApply" | "volumeBoost"

export type PageActionRequest = { tabId?: number } & (
  | { event: ModeAction; value?: boolean }
  | { event: ColorAction; value: string }
  | { event: ValueAction; value: number }
  | { event: Exclude<PageAction, ModeAction | ColorAction | ValueAction>; value?: never }
)

export type PageActionResult = { ok: boolean; saved: boolean; error?: string; message?: string; tabId?: number }

export type ActionExecution =
  | { type: "script"; file: string; world?: "MAIN" | "ISOLATED"; allFrames?: boolean }
  | { type: "playback" }
  | { type: "video_quality" }
  | {
      type: "flagged_mode"
      flagKey: string
      world: "MAIN" | "ISOLATED"
      file: string
      allFrames?: boolean
      settingKey: string
      onValue: unknown
    }

export const MODE_KEYS: Record<string, string> = {
  designMode: "designMode",
  inspectModeApply: "inspectMode",
  arabicRtlMode: "arabicRtlMode",
}

export const BOOLEAN_KEYS: Record<string, string> = {
  youtubeFocus: "youtubeFocus",
  hideYoutubeProgressBar: "youtubeHideProgress",
  hideYoutubeControls: "youtubeHideControls",
  hideYoutubeDuration: "youtubeHideDuration",
  youtubeHalfScreen: "youtubeHalfScreen",
}

export const ACTION_REGISTRY: Record<PageAction, ActionExecution> = {
  changeBackgroundColor: { type: "script", file: "scripts/applyPageColors.js", allFrames: true },
  changeColor: { type: "script", file: "scripts/applyPageColors.js", allFrames: true },
  resetPageColors: { type: "script", file: "scripts/applyPageColors.js", allFrames: true },
  resetBackgroundOnly: { type: "script", file: "scripts/applyPageColors.js", allFrames: true },
  resetTextColorOnly: { type: "script", file: "scripts/applyPageColors.js", allFrames: true },
  inspectModeApply: { type: "script", file: "scripts/inspectMode.js", allFrames: true },
  hideMainScrollBar: { type: "script", file: "scripts/hideMainScrollBar.js", allFrames: true },
  hideAllScrollBars: { type: "script", file: "scripts/hideAllScrollBars.js", allFrames: true },
  resetMainScrollBar: { type: "script", file: "scripts/resetMainScrollBar.js", allFrames: true },
  resetAllScrollBars: { type: "script", file: "scripts/resetAllScrollBars.js", allFrames: true },
  applyCustomScrollbar: { type: "script", file: "scripts/applyCustomScrollbar.js", allFrames: true },
  resetCustomScrollbar: { type: "script", file: "scripts/resetCustomScrollbar.js", allFrames: true },
  hideYoutubeProgressBar: { type: "script", file: "scripts/youtubeProgressBar.js", allFrames: true },
  hideYoutubeControls: { type: "script", file: "scripts/youtubeControls.js", allFrames: true },
  hideYoutubeDuration: { type: "script", file: "scripts/youtubeDuration.js", allFrames: true },
  youtubeHalfScreen: { type: "script", file: "scripts/youtubeHalfScreen.js", allFrames: true },
  volumeBoost: { type: "script", file: "scripts/volumeBoost.js", allFrames: true },
  arabicRtlMode: { type: "script", file: "scripts/arabicRtlMode.js", allFrames: true },
  designMode: {
    type: "flagged_mode",
    flagKey: "__zedDesignModeFlag",
    world: "MAIN",
    file: "scripts/designMode.js",
    allFrames: true,
    settingKey: "designMode",
    onValue: "on",
  },
  youtubeFocus: {
    type: "flagged_mode",
    flagKey: "__zedYoutubeFocusEnabled",
    world: "ISOLATED",
    file: "scripts/youtubeFocusMode.js",
    allFrames: false,
    settingKey: "youtubeFocus",
    onValue: true,
  },
  playbackRateApply: { type: "playback" },
  playbackSlower: { type: "playback" },
  playbackFaster: { type: "playback" },
  applyVideoQuality: { type: "video_quality" },
}

export function validateActionRequest(input: unknown): PageActionRequest {
  if (!input || typeof input !== "object") throw new Error("No page action was provided")
  const request = input as PageActionRequest
  const { event, value, tabId } = request
  if (!Object.prototype.hasOwnProperty.call(ACTION_REGISTRY, event)) {
    throw new Error("Unknown page action")
  }
  if (tabId !== undefined && (!Number.isInteger(tabId) || tabId < 0)) throw new Error("Invalid tab")

  if (event === "changeBackgroundColor" || event === "changeColor") {
    if (!isColor(value) || value === "") throw new Error("Choose a six-digit hex color")
  } else if (event === "volumeBoost") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 100 || value > 2000) {
      throw new Error("Invalid volume boost")
    }
  } else if (event === "playbackRateApply") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid playback speed")
  } else if (Object.prototype.hasOwnProperty.call(MODE_KEYS, event) || Object.prototype.hasOwnProperty.call(BOOLEAN_KEYS, event)) {
    if (value !== undefined && typeof value !== "boolean") throw new Error("Invalid mode value")
  } else if (value !== undefined) {
    throw new Error("This action does not accept a value")
  }
  return request
}
