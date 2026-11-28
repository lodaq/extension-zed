import { Fragment, useId, useState } from "react"
import { ALL_SHORTCUT_ACTIONS as SHORTCUT_ACTIONS, DEFAULT_SHORTCUTS, recordCombo, readShortcuts } from "@/lib/shortcuts"
import { DEFAULT_INSTALLED_FEATURES, INSTALLED_FEATURES_KEY, readInstalledFeatures, SHORTCUT_FEATURE, type FeatureId } from "@/lib/features"
import { useStoredValue } from "@/lib/useStoredValue"
import { IconButton } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
import { toast } from "./ui/use-toast"

export default function ShortcutsTab() {
  const [storedCombos, setCombos] = useStoredValue("keyboardShortcuts", DEFAULT_SHORTCUTS)
  const [storedInstalled] = useStoredValue<readonly FeatureId[]>(INSTALLED_FEATURES_KEY, DEFAULT_INSTALLED_FEATURES)
  const installed = readInstalledFeatures(storedInstalled)
  const visibleActions = SHORTCUT_ACTIONS.filter((action) => {
    const required = SHORTCUT_FEATURE[action.id]
    return !required || installed.includes(required)
  })
  const combos = readShortcuts(storedCombos)
  const [recording, setRecording] = useState<string | null>(null)
  const [error, setError] = useState("")
  const instructionsId = useId()
  const errorId = useId()
  const cancel = () => { setRecording(null); setError("") }
  const save = (id: string, combo: string) => void setCombos({ ...combos, [id]: combo }).catch(() => toast({ title: "Could not save shortcut", variant: "destructive" }))
  return <section className="zed-stack zed-root">
    <div className="zed-helper-row"><span className="zed-helper">Edit shortcuts here. Popup shortcuts work while Zed is open, outside text fields and dialogs. Page shortcuts also work on websites, including text fields. Browser-protected pages block page shortcuts.</span><span className="zed-count">{visibleActions.filter(a => combos[a.id]).length} of {visibleActions.length} shortcuts set</span></div>
    <h2 className="zed-group">Standard controls · Fixed</h2>
    <p className="zed-helper">Standard controls: Tab / Shift+Tab move focus; Enter / Space activate controls; Escape closes dialogs or cancels recording. In hint mode, type the displayed label to click. With the F shortcut, hints follow the view as you scroll. Escape or clicking a control dismisses shortcut hints.</p>
    <h2 className="zed-group">Capture and inspection · Fixed</h2>
    <p className="zed-helper">Screenshot selection: arrows move the area; Shift+arrows resize; Enter captures; Escape cancels. Element selection: ↑ parent, ↓ child, ←/→ siblings, Enter captures. Tab stays in the picker. Escape also closes the screenshot preview and exits inspect mode.</p>
    {recording && <p id={instructionsId} className="zed-helper">Press a shortcut. Tab or Escape cancels recording.</p>}
    {error && <p id={errorId} role="alert" className="zed-saved-error">{error}</p>}
    {visibleActions.map((action, index) => {
      const active = recording === action.id
      const assigned = Boolean(combos[action.id])
      return <Fragment key={action.id}>
        {visibleActions[index - 1]?.group !== action.group && <h2 className="zed-group">{action.group}</h2>}
        <div className={`zed-row zed-shortcut${active ? " zed-recording" : ""}`}>
          <span className="zed-row-text">{action.name}</span>
          {!active && assigned && <span className="flex gap-1">{(combos[action.id].endsWith("++") ? [...combos[action.id].slice(0, -2).split("+"), "+"] : combos[action.id].split("+")).map(part => <kbd className="zed-key" key={part}>{part}</kbd>)}</span>}
          <button type="button" className={active ? "zed-inline zed-recording" : assigned ? "zed-icon-button" : "zed-inline"}
            aria-label={`${active ? "Record" : assigned ? "Edit" : "Add"} shortcut for ${action.name}`}
            aria-describedby={active ? `${instructionsId}${error ? ` ${errorId}` : ""}` : undefined}
            onClick={event => { event.currentTarget.focus(); setRecording(action.id) }}
            onBlur={() => { if (active) cancel() }}
            onKeyDown={event => {
              if (!active || event.key === "Tab") return
              event.preventDefault(); event.stopPropagation()
              if (event.key === "Escape") { cancel(); return }
              setError("")
              try {
                const combo = recordCombo(event, !action.id.startsWith("action"))
                if (!combo) return
                const other = SHORTCUT_ACTIONS.find(a => a.id !== action.id && combos[a.id] === combo)
                if (other) throw new Error(`Used by ${other.name}`)
                save(action.id, combo)
                cancel()
              } catch (error) { setError((error as Error).message) }
            }}>{active ? "Press a shortcut…" : assigned ? <Icon name="edit" size={18} /> : "+ Add"}</button>
          {!active && assigned && <IconButton label={`Remove shortcut for ${action.name}`} icon="delete" onClick={() => save(action.id, "")} />}
        </div>
      </Fragment>
    })}
  </section>
}
