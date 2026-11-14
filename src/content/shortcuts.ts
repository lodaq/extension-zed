import "./savedPage"
import { installSavedIndicator } from "./savedIndicator"
import { readShortcuts, recordCombo } from "../lib/shortcuts"
// Install/update backfill can reach a frame that already has the declarative script.
const state = globalThis as typeof globalThis & { __zedShortcutsInstalled?: boolean }
if (!state.__zedShortcutsInstalled) {
  state.__zedShortcutsInstalled = true
  if (window === window.top) installSavedIndicator()
  // Don't consume page keys until the user's assignments are known.
  let combos: Record<string, string> = {}
  let acceptInitialRead = true
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.keyboardShortcuts) return
    acceptInitialRead = false
    combos = readShortcuts(changes.keyboardShortcuts.newValue)
  })
  void chrome.storage.local.get("keyboardShortcuts").then(result => {
    if (acceptInitialRead) combos = readShortcuts(result.keyboardShortcuts)
  }).catch(console.error)
  const onKeydown = async (event: KeyboardEvent) => {
    try {
      // Reloaded extensions leave disconnected listeners in already-open pages.
      if (!chrome.runtime?.id || event.repeat || event.isComposing) return
      let combo: string | null
      try { combo = recordCombo(event) } catch { return }
      if (!combo) return
      const id = Object.keys(combos).find(id => combos[id] === combo)
      if (!id) return
      event.preventDefault(); event.stopImmediatePropagation()
      const result = await chrome.runtime.sendMessage({ type: "zed:shortcut", id })
      if (!result?.ok) throw new Error(result?.error || "Shortcut failed")
      if (result.password) await navigator.clipboard.writeText(result.password)
    } catch (error) {
      if (/extension context invalidated/i.test(String(error))) {
        window.removeEventListener("keydown", onKeydown, true)
        return
      }
      console.error(error)
    }
  }
  window.addEventListener("keydown", onKeydown, true)
}
