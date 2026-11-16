import type { MiscSectionId } from "./settings"

export function fitPopup() {
  // Brave can anchor shortcut popups partly off-screen when its toolbar is hidden.
  const overflow = ((screen as Screen & { availLeft?: number }).availLeft ?? 0) - window.screenX
  if (overflow > 0) document.documentElement.style.setProperty('--zed-popup-width', `${Math.max(200, window.innerWidth - overflow)}px`)
}

export const DEFAULT_TOOL_ORDER: readonly MiscSectionId[] = ["playback","quality","password","volume","scrollbars","modes","screenshot"]
export const popupSectionStack = "flex flex-col gap-3"

export const popupPanel = "zed-stack"

export const popupSectionTitle = "zed-title"

export const popupSectionInner = "flex flex-col gap-2.5"

export const popupControlRow = "flex flex-wrap items-center gap-2"

export const popupDescription = "text-xs leading-relaxed text-muted-foreground"
