import "./savedPage"
import { installSavedIndicator } from "./savedIndicator"
import { DEFAULT_SHORTCUTS, readShortcuts, recordCombo } from "../lib/shortcuts"
// Install/update backfill can reach a frame that already has the declarative script.
const state = globalThis as typeof globalThis & { __zedShortcutsInstalled?: boolean }
if (!state.__zedShortcutsInstalled) {
  state.__zedShortcutsInstalled = true
  if (window === window.top) installSavedIndicator()
  let combos = { ...DEFAULT_SHORTCUTS }
  void chrome.storage.local.get("keyboardShortcuts").then(result => { combos = readShortcuts(result.keyboardShortcuts) })
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.keyboardShortcuts) combos = readShortcuts(changes.keyboardShortcuts.newValue) })
  window.addEventListener("keydown", event => {
    // Reloaded extensions leave disconnected listeners in already-open pages.
    if (!chrome.runtime?.id || event.repeat || event.isComposing) return
    let combo: string | null
    try { combo = recordCombo(event) } catch { return }
    if (!combo) return
    const id = Object.keys(combos).find(id => combos[id] === combo)
    if (!id) return
    event.preventDefault(); event.stopImmediatePropagation()
    void chrome.runtime.sendMessage({ type: "zed:shortcut", id }).then(async result => { if (!result?.ok) throw new Error(result?.error || "Shortcut failed"); if (result.password) await navigator.clipboard.writeText(result.password) }).catch(console.error)
  }, true)
}
