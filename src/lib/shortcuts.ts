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
  youtubeProgressBar: "P",
} as const

export function kbdTitle(cap: string): string {
  if (cap === ",") return "Alt+Comma"
  if (cap === ".") return "Alt+Period"
  return `Alt+${cap}`
}
