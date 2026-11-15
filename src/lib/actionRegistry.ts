export type PageActionRequest = { tabId?: number } & (
  | { event: ModeAction; value?: boolean }
  | { event: ValueAction; value: number }
  | { event: Exclude<PageAction, ModeAction | ValueAction>; value?: never }
)

export type PageActionResult = { ok: boolean; saved: boolean; error?: string; message?: string; tabId?: number }

export type ActionExecution =
  | { type: "script"; file: string; world?: "MAIN" | "ISOLATED"; allFrames?: boolean }
  | { type: "style"; id: string; css: string; settingKey?: string }
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

export const MODE_KEYS = {
  designMode: "designMode",
  inspectModeApply: "inspectMode",
  arabicRtlMode: "arabicRtlMode",
} as const

export const BOOLEAN_KEYS = {
  youtubeFocus: "youtubeFocus",
  hideYoutubeProgressBar: "youtubeHideProgress",
  hideYoutubeControls: "youtubeHideControls",
  hideYoutubeDuration: "youtubeHideDuration",
  youtubeHalfScreen: "youtubeHalfScreen",
} as const

export type ModeAction = keyof typeof MODE_KEYS | keyof typeof BOOLEAN_KEYS
export type ValueAction = "playbackRateApply" | "volumeBoost"
export type PageAction = keyof typeof ACTION_REGISTRY

function style(id: string, css = "", settingKey?: string): ActionExecution {
  return { type: "style", id, css, settingKey }
}

export const ACTION_REGISTRY = {
  inspectModeApply: { type: "script", file: "scripts/inspectMode.js", allFrames: true },
  hideMainScrollBar: style("zed-hide-main-scrollbar", `html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
    html, body { scrollbar-width: none; -ms-overflow-style: none; }`),
  hideAllScrollBars: style("zed-hide-all-scrollbars", `*::-webkit-scrollbar { display: none; }
    * { scrollbar-width: none; -ms-overflow-style: none; }`),
  resetMainScrollBar: style("zed-hide-main-scrollbar"),
  resetAllScrollBars: style("zed-hide-all-scrollbars"),
  applyCustomScrollbar: { type: "script", file: "scripts/applyCustomScrollbar.js", allFrames: true },
  resetCustomScrollbar: style("zed-custom-scrollbar"),
  hideYoutubeProgressBar: style("zed-youtube-progress-bar", `.ytp-progress-bar-container, .ytp-progress-bar, #progress-bar, ytd-player .ytp-progress-bar-container, .ytp-chapter-container { display: none !important; }`, "youtubeHideProgress"),
  hideYoutubeControls: style("zed-youtube-controls", `.ytp-chrome-bottom, .ytp-chrome-controls, .ytp-gradient-bottom, ytd-player .ytp-chrome-bottom { display: none !important; }`, "youtubeHideControls"),
  hideYoutubeDuration: style("zed-youtube-duration", `.ytp-time-display, .ytp-time-duration, .ytp-time-current, .ytp-time-separator, .ytp-chapter-container { display: none !important; }`, "youtubeHideDuration"),
  youtubeHalfScreen: style("zed-youtube-half-screen", `ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: 100% !important; min-width: 0 !important; }
    ytd-watch-flexy[flexy] #player-container-outer.ytd-watch-flexy { max-width: 100% !important; }
    #secondary.ytd-watch-flexy { width: 100% !important; }`, "youtubeHalfScreen"),
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
} satisfies Record<string, ActionExecution>

export function validateActionRequest(input: unknown): PageActionRequest {
  if (!input || typeof input !== "object") throw new Error("No page action was provided")
  const request = input as PageActionRequest
  const { event, value, tabId } = request
  if (!Object.prototype.hasOwnProperty.call(ACTION_REGISTRY, event)) {
    throw new Error("Unknown page action")
  }
  if (tabId !== undefined && (!Number.isInteger(tabId) || tabId < 0)) throw new Error("Invalid tab")

  if (event === "volumeBoost") {
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
