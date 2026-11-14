import { SwitchRow } from "@/design-system/components"

export interface ToggleRowProps {
  id: string
  label: string
  checked: boolean
  ariaLabel: string
  onToggle: (checked: boolean) => void
}

export function ToggleRow({ label, checked, onToggle }: ToggleRowProps) {
 return <SwitchRow label={label} checked={checked} onChange={onToggle}/>
}
