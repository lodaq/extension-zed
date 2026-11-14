import { useEffect, useRef, type ReactNode } from "react"
import { Icon, type IconName } from "./Icon"

export function Tile({ id, title, tooltip, icon, badge, disabled, onClick }: { id?: string; title: string; tooltip: string; icon: IconName; badge?: string; disabled?: boolean; onClick: () => void }) {
  return <button id={id} className="zed-tile" disabled={disabled} onClick={onClick}><span className="zed-tile-top"><span className="zed-well"><Icon name={icon} /></span><span>{badge}</span></span><span>{title}</span><span className="zed-tooltip" role="tooltip">{tooltip}</span></button>
}
export function SwitchRow({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <button type="button" className="zed-switch-row" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}><span>{label}{description && <span className="zed-helper" style={{ display: "block" }}>{description}</span>}</span><span className="zed-switch" /></button>
}
export function StatusPill({ active }: { active: boolean }) { return <span className={`zed-pill${active ? " zed-pill--active" : ""}`}>{active ? "Active" : "Off"}</span> }
export function Card({ children, active = false }: { children: ReactNode; active?: boolean }) { return <div className={`zed-card${active ? " zed-card--active" : ""}`} style={{ padding: 16 }}>{children}</div> }
export function IconButton({ label, icon, onClick, disabled }: { label: string; icon: IconName; onClick: () => void; disabled?: boolean }) { return <button type="button" className="zed-icon-button" aria-label={label} onClick={onClick} disabled={disabled}><Icon name={icon} size={18} /></button> }
export function LetterAvatar({ title, compact=false }: { title: string; compact?:boolean }) { return <span className={`zed-avatar${compact?" zed-avatar--link":""}`} style={{ background: `var(--zed-avatar-${title.length % 6 + 1})` }}>{title[0]?.toUpperCase()}</span> }
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
