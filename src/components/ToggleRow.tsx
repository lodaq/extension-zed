import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export interface ToggleRowProps {
  id: string
  label: string
  checked: boolean
  ariaLabel: string
  onToggle: (checked: boolean) => void
}

export function ToggleRow({ id, label, checked, ariaLabel, onToggle }: ToggleRowProps) {
  return (
    <div
      className="flex cursor-pointer items-center justify-between rounded-none px-2 py-2 hover:bg-muted/60"
      onClick={() => onToggle(!checked)}
    >
      <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={onToggle}
        aria-label={ariaLabel}
      />
    </div>
  )
}
