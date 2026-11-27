import { installSavedIndicator } from "./savedIndicator"
import { readShortcuts, recordCombo, SHORTCUT_ACTIONS } from "../lib/shortcuts"
import { INSTALLED_FEATURES_KEY, readInstalledFeatures, SHORTCUT_FEATURE, type FeatureId } from "../lib/features"
// Install/update backfill can reach a frame that already has the declarative script.
const state = globalThis as typeof globalThis & { __zedShortcutsInstalled?: boolean }
if (!state.__zedShortcutsInstalled) {
  state.__zedShortcutsInstalled = true
  if (window === window.top) installSavedIndicator()
  // Don't consume page keys until the user's assignments are known.
  let combos: Record<string, string> = {}
  let installed: FeatureId[] = []
  let acceptInitialRead = true
  let acceptInitialFeatures = true
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return
    if (changes.keyboardShortcuts) {
      acceptInitialRead = false
      combos = readShortcuts(changes.keyboardShortcuts.newValue)
    }
    if (changes[INSTALLED_FEATURES_KEY]) {
      acceptInitialFeatures = false
      installed = readInstalledFeatures(changes[INSTALLED_FEATURES_KEY].newValue)
    }
  })
  void chrome.storage.local.get(["keyboardShortcuts", INSTALLED_FEATURES_KEY]).then(result => {
    if (acceptInitialRead) combos = readShortcuts(result.keyboardShortcuts)
    if (acceptInitialFeatures) installed = readInstalledFeatures(result[INSTALLED_FEATURES_KEY])
  }).catch(console.error)
  const onKeydown = async (event: KeyboardEvent) => {
    try {
      // Reloaded extensions leave disconnected listeners in already-open pages.
      if (!chrome.runtime?.id || event.repeat || event.isComposing) return
      let combo: string | null
      try { combo = recordCombo(event) } catch { return }
      if (!combo) return
      const id = SHORTCUT_ACTIONS.find(action => {
        if (combos[action.id] !== combo) return false
        const required = SHORTCUT_FEATURE[action.id]
        return !required || installed.includes(required)
      })?.id
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
