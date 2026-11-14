import { DEFAULT_SHORTCUTS, readShortcuts, recordCombo } from "../lib/shortcuts"
let combos = { ...DEFAULT_SHORTCUTS }
void chrome.storage.local.get("keyboardShortcuts").then(result => { combos = readShortcuts(result.keyboardShortcuts) })
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.keyboardShortcuts) combos = readShortcuts(changes.keyboardShortcuts.newValue) })
document.addEventListener("keydown", event => {
  if (event.repeat || event.defaultPrevented || event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))) return
  let combo: string | null
  try { combo = recordCombo(event) } catch { return }
  if (!combo) return
  const id = Object.keys(combos).find(id => combos[id] === combo)
  if (!id) return
  event.preventDefault(); event.stopPropagation()
  void chrome.runtime.sendMessage({ type: "zed:shortcut", id }).then(async result => { if (!result?.ok) throw new Error(result?.error || "Shortcut failed"); if (result.password) await navigator.clipboard.writeText(result.password) }).catch(console.error)
}, true)
