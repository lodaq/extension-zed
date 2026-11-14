export const SHORTCUT_ACTIONS = [
  { id: "action0", group: 'Playback speed', name: 'Faster', combo: 'Alt+Shift+→' },
  { id: "action1", group: 'Playback speed', name: 'Slower', combo: 'Alt+Shift+←' },
  { id: "action2", group: 'Playback speed', name: 'Reset to 1×', combo: '' },
  { id: "action3", group: 'Video quality', name: 'Prefer higher quality', combo: '' },
  { id: "action4", group: 'Video quality', name: 'Prefer lower quality', combo: '' },
  { id: "action5", group: 'Volume boost', name: 'Boost up', combo: 'Alt+Shift+↑' },
  { id: "action6", group: 'Volume boost', name: 'Boost down', combo: 'Alt+Shift+↓' },
  { id: "action7", group: 'Volume boost', name: 'Reset to 100%', combo: '' },
  { id: "action8", group: 'Password generator', name: 'Generate and copy password', combo: 'Alt+Shift+P' },
  { id: "action9", group: 'Scrollbars', name: 'Apply custom style', combo: '' },
  { id: "action10", group: 'Scrollbars', name: 'Hide main scrollbar', combo: '' },
  { id: "action11", group: 'Scrollbars', name: 'Hide all scrollbars', combo: '' },
  { id: "action12", group: 'Scrollbars', name: 'Reset scrollbars', combo: '' },
  { id: "action13", group: 'Modes', name: 'Toggle inspect mode', combo: 'Alt+Shift+I' },
  { id: "action14", group: 'Modes', name: 'Toggle design mode', combo: 'Alt+Shift+D' },
  { id: "action15", group: 'Modes', name: 'Toggle Arabic RTL mode', combo: 'Alt+Shift+A' },
  { id: "action16", group: 'Capture screenshot', name: 'Selected area', combo: 'Alt+Shift+S' },
  { id: "action17", group: 'Capture screenshot', name: 'Visible area', combo: '' },
  { id: "action18", group: 'Capture screenshot', name: 'Full page', combo: '' },
  { id: "action19", group: 'Capture screenshot', name: 'Element', combo: '' },
  { id: "action20", group: 'Tabs', name: 'Save URL and close tab', combo: 'Ctrl+Cmd+S' },
  { id: "action21", group: 'YouTube', name: 'Focus mode', combo: 'Alt+Shift+F' },
  { id: "action22", group: 'YouTube', name: 'Hide progress bar', combo: '' },
  { id: "action23", group: 'YouTube', name: 'Hide time & duration', combo: '' },
  { id: "action24", group: 'YouTube', name: 'Hide controls', combo: '' },
  { id: "action25", group: 'YouTube', name: 'Half-screen layout', combo: '' },
  { id: "action26", group: 'Appearance', name: 'Toggle dark theme', combo: '' },
  { id: "action27", group: 'Appearance', name: 'Toggle black and white', combo: '' },
] as const
export const DEFAULT_SHORTCUTS: Record<string, string> = Object.fromEntries(SHORTCUT_ACTIONS.map(action => [action.id, action.combo]))
export function recordCombo(event: { key: string; code: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return null
  if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) throw new Error("Add Ctrl, Alt, Shift or Cmd")
  const aliases: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", " ": "Space" }
  const key = aliases[event.key] ?? (/^(Key|Digit)/.test(event.code) ? event.code.replace(/^(Key|Digit)/, "") : event.key.length === 1 ? event.key.toUpperCase() : event.key)
  return [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Cmd", key].filter(Boolean).join("+")
}

export function readShortcuts(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_SHORTCUTS }
  return Object.fromEntries(SHORTCUT_ACTIONS.map(action => [action.id, typeof (value as Record<string, unknown>)[action.id] === "string" ? (value as Record<string, string>)[action.id] : action.combo]))
}
