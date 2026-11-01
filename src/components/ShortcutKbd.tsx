import { Kbd } from "@/components/ui/kbd"
import { kbdTitle } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

type ShortcutKbdProps = {
  label: string
  className?: string
}

export const shortcutHostClassName = "relative overflow-visible"

export function ShortcutKbd({ label, className }: ShortcutKbdProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-1 top-1 z-10 opacity-60",
        className
      )}
      title={kbdTitle(label)}
    >
      <Kbd className="flex h-3.5 min-w-3.5 items-center justify-center border-0 bg-transparent px-0.5 text-[8px] font-medium leading-none tabular-nums shadow-none">
        {label}
      </Kbd>
    </span>
  )
}
