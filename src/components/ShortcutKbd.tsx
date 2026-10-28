import { Kbd } from "@/components/ui/kbd"
import { kbdTitle } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

type ShortcutKbdProps = {
  /** Single key cap (comma / period / letter / digit); Alt is implied. */
  label: string
  className?: string
}

/** Use on the parent control (e.g. Button) so the corner badge is not clipped. */
export const shortcutHostClassName = "relative overflow-visible"

/**
 * Key cap sits with its **center** on the host’s top-right corner (half overlaps outside).
 * Render as a **child** of an element with `shortcutHostClassName` (or `relative overflow-visible`).
 */
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
