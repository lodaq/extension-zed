import { Fragment, useId, useState } from "react"
import { SHORTCUT_ACTIONS, DEFAULT_SHORTCUTS, recordCombo } from "@/lib/shortcuts"
import { useStoredValue } from "@/lib/useStoredValue"
import { IconButton } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
import { toast } from "./ui/use-toast"

export default function ShortcutsTab() {
  const [combos, setCombos] = useStoredValue("keyboardShortcuts", DEFAULT_SHORTCUTS)
  const [recording, setRecording] = useState<string | null>(null)
  const [error, setError] = useState("")
  const instructionsId = useId()
  const errorId = useId()
  const cancel = () => { setRecording(null); setError("") }
  const save = (id: string, combo: string) => void setCombos({ ...combos, [id]: combo }).catch(() => toast({ title: "Could not save shortcut", variant: "destructive" }))
  return <section className="zed-stack zed-root">
    <div className="zed-helper-row"><span className="zed-helper">Edit shortcuts here. They work on websites, including text fields, without opening Zed. Browser-protected pages block page shortcuts.</span><span className="zed-count">{SHORTCUT_ACTIONS.filter(a => combos[a.id]).length} of {SHORTCUT_ACTIONS.length} page shortcuts set</span></div>
    {recording && <p id={instructionsId} className="zed-helper">Press a shortcut. Tab or Escape cancels recording.</p>}
    {error && <p id={errorId} role="alert" className="zed-saved-error">{error}</p>}
    {SHORTCUT_ACTIONS.map((action, index) => {
      const active = recording === action.id
      const assigned = Boolean(combos[action.id])
      return <Fragment key={action.id}>
        {SHORTCUT_ACTIONS[index - 1]?.group !== action.group && <h2 className="zed-group">{action.group}</h2>}
        <div className={`zed-row zed-shortcut${active ? " zed-recording" : ""}`}>
          <span className="zed-row-text">{action.name}</span>
          {!active && assigned && <span className="flex gap-1">{(combos[action.id].endsWith("++") ? [...combos[action.id].slice(0, -2).split("+"), "+"] : combos[action.id].split("+")).map(part => <span className="zed-key" key={part}>{part}</span>)}</span>}
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
                const combo = recordCombo(event)
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
