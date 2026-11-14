import type { MiscSectionId } from "./settings"
export const DEFAULT_TOOL_ORDER: readonly MiscSectionId[] = ["playback","quality","password","volume","scrollbars","modes","screenshot"]
export const popupSectionStack = "flex flex-col gap-3"

export const popupPanel = "zed-stack"

export const popupSectionTitle = "zed-title"

export const popupSectionInner = "flex flex-col gap-2.5"

export const popupControlRow = "flex flex-wrap items-center gap-2"

export const popupSubhead = "text-sm font-medium leading-none text-foreground"

export const popupDescription = "text-xs leading-relaxed text-muted-foreground"
