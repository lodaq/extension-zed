export const SCREENSHOT_MODES = ["area", "visible", "full", "element"] as const
export type ScreenshotMode = (typeof SCREENSHOT_MODES)[number]
