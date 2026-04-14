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
        "pointer-events-none absolute right-0 top-0 z-10 translate-x-1/2 -translate-y-1/2",
        className
      )}
      title={kbdTitle(label)}
    >
      <Kbd className="flex h-4 min-w-[1.125rem] items-center justify-center px-1 text-[9px] font-medium leading-none tabular-nums shadow-sm ring-1 ring-border/80">
        {label}
      </Kbd>
    </span>
  )
}
