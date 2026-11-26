import { useEffect, useId, useRef, type ReactNode } from "react"
import { Icon, type IconName } from "./Icon"
import { clampClipRange, formatTime, trimmerPosition } from "@/lib/clip"

export function Tile({ id, title, description, icon, badge, disabled, onClick }: { id?: string; title: string; description: string; icon: IconName; badge?: string; disabled?: boolean; onClick: () => void }) {
  const nameId = useId()
  const descriptionId = useId()
  const badgeId = useId()
  return <button id={id} type="button" className="zed-tile" disabled={disabled} onClick={onClick}
    aria-labelledby={`${badge ? `${badgeId} ` : ""}${nameId}`} aria-describedby={descriptionId}>
    <span className="zed-tile-top"><span className="zed-well"><Icon name={icon} /></span><span id={badgeId}>{badge}</span></span>{" "}
    <span id={nameId} className="zed-tile-label">{title}</span><span id={descriptionId} className="sr-only">{description}</span>
  </button>
}
export function SwitchRow({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" className="zed-switch-row" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}><span>{label}{description && <span className="zed-helper" style={{ display: "block" }}>{description}</span>}</span><span className="zed-switch" /></button>
}
export function StatusPill({ active }: { active: boolean }) { return <span className={`zed-pill${active ? " zed-pill--active" : ""}`}>{active ? "Active" : "Off"}</span> }
export function Card({ children, active = false }: { children: ReactNode; active?: boolean }) { return <div className={`zed-card${active ? " zed-card--active" : ""}`} style={{ padding: 16 }}>{children}</div> }
export function IconButton({ label, icon, onClick, disabled }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean }) { return <button type="button" className="zed-icon-button" aria-label={label} onClick={onClick} disabled={disabled}><Icon name={icon} size={18} /></button> }
export function LetterAvatar({ title, compact=false }: { title: string; compact?:boolean }) { return <span aria-hidden="true" className={`zed-avatar${compact?" zed-avatar--link":""}`} style={{ background: `var(--zed-avatar-${title.length % 6 + 1})` }}>{title[0]?.toUpperCase()}</span> }
export function Notice({ title, children }: { title: string; children: ReactNode }) { return <div className="zed-notice" role="alert"><Icon name="info" /><div><strong>{title}</strong><div className="zed-helper">{children}</div></div></div> }
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); ref.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => { previous?.focus() } }, [])
  return <dialog ref={ref} className="zed-dialog" aria-modal="true" onKeyDown={event => {
    if(event.key!=="Tab")return
    const buttons=ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if(!buttons?.length)return
    const first=buttons[0],last=buttons[buttons.length-1]
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }} aria-labelledby="zed-dialog-title" onCancel={event => { event.preventDefault(); onClose() }}><h2 className="zed-title" id="zed-dialog-title">{title}</h2>{children}</dialog>
}

export function CheckboxTile({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" className="zed-check" role="checkbox" aria-checked={checked} onClick={() => onChange(!checked)}><span className="zed-checkbox">{checked && <Icon name="check" size={16} />}</span><span><strong>{label}</strong><span className="zed-helper block">{hint}</span></span></button>
}

export function ChoiceGroup<T extends string>({ label, value, options, onChange }: {
  label: string
  value: T
  options: readonly { id: T; label: string; description?: string }[]
  onChange: (value: T) => void
}) {
  const current = Math.max(0, options.findIndex(option => option.id === value))
  return <div className="zed-stack" role="radiogroup" aria-label={label} onKeyDown={event => {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !options.length) return
    event.preventDefault()
    const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (current + (event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1) + options.length) % options.length
    onChange(options[index].id)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus()
  }}>
    {options.map(option => <button type="button" key={option.id} role="radio" aria-checked={value === option.id} tabIndex={value === option.id ? 0 : -1} className="zed-choice" onClick={() => onChange(option.id)}>
      <span className="zed-choice-radio" aria-hidden="true" /><span><strong>{option.label}</strong>{option.description && <span className="zed-helper block">{option.description}</span>}</span>
    </button>)}
  </div>
}

export function TimelineTrimmer({ duration, start, end, onChange, disabled = false }: {
  duration: number
  start: number
  end: number
  onChange: (range: { start: number; end: number }) => void
  disabled?: boolean
}) {
  const max = Math.max(1, Math.floor(duration))
  const safe = clampClipRange(start, end, max)
  const startPos = trimmerPosition(safe.start, max)
  const endPos = trimmerPosition(safe.end, max)
  const raiseStart = safe.end - safe.start <= Math.max(2, Math.ceil(max * 0.08)) || safe.start >= max * 0.5

  return (
    <div className="zed-stack">
      <div className="zed-trim" role="group" aria-label="Clip range">
        <div className="zed-trim-film" aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
        </div>
        <div className="zed-trim-dim" style={{ left: 0, width: startPos }} aria-hidden="true" />
        <div className="zed-trim-dim" style={{ left: endPos, right: 0 }} aria-hidden="true" />
        <div className="zed-trim-sel" style={{ left: startPos, right: `calc(100% - (${endPos}))` }} aria-hidden="true" />
        <input
          type="range"
          className={`zed-trim-range${raiseStart ? " zed-trim-range--raised" : ""}`}
          min={0}
          max={max}
          step={1}
          value={safe.start}
          disabled={disabled}
          aria-label="Clip start"
          aria-valuetext={formatTime(safe.start)}
          onChange={(event) => {
            const nextStart = Math.min(Number(event.target.value), safe.end - 1)
            onChange({ start: Math.max(0, nextStart), end: safe.end })
          }}
        />
        <input
          type="range"
          className="zed-trim-range"
          min={0}
          max={max}
          step={1}
          value={safe.end}
          disabled={disabled}
          aria-label="Clip end"
          aria-valuetext={formatTime(safe.end)}
          onChange={(event) => {
            const nextEnd = Math.max(Number(event.target.value), safe.start + 1)
            onChange({ start: safe.start, end: Math.min(max, nextEnd) })
          }}
        />
      </div>
      <div className="zed-trim-scale" aria-hidden="true">
        <span>0:00</span>
        <span>{formatTime(max)}</span>
      </div>
    </div>
  )
}
