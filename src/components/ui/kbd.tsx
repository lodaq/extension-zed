import * as React from "react"

import { cn } from "@/lib/utils"

const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(
        "pointer-events-none inline-flex select-none items-center gap-0.5 rounded border border-border bg-muted font-mono font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
)
Kbd.displayName = "Kbd"

export { Kbd }
