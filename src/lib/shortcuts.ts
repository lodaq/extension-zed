/**
 * Key caps shown on controls (all use Alt+… when bound in Chrome).
 * Only four commands may ship with manifest `suggested_key`; bind the rest at
 * chrome://extensions/shortcuts (recommended: Alt+2, Alt+F, Alt+R, …).
 */
export const KBD = {
  tabMisc: "Q",
  tabYoutube: "W",
  tabShortcuts: "E",
  openPopup: "Z",
  playbackSlower: ",",
  playbackFaster: ".",
  playbackNormal: "1",
  playbackDouble: "2",
  hideMainScrollbar: "M",
  hideAllScrollbars: "K",
  inspect: "I",
  designMode: "D",
  resetPageColors: "U",
  youtubeFocus: "F",
  youtubeReset: "R",
  youtubeProgressBar: "P",
} as const

/** Hover / a11y: full chord (matches typical bindings). */
export function kbdTitle(cap: string): string {
  if (cap === ",") return "Alt+Comma"
  if (cap === ".") return "Alt+Period"
  return `Alt+${cap}`
}
