export const TAB_IDS = ["Misc", "Extensions", "YouTube", "Links", "Saved", "Shortcuts"] as const
export type TabId = (typeof TAB_IDS)[number]

export const TAB_LABELS: Record<TabId, string> = {
  Misc: "Tools",
  Extensions: "Other extensions",
  YouTube: "YouTube",
  Links: "Read later",
  Saved: "Library",
  Shortcuts: "Shortcuts",
}
