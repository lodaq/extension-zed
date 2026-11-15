import { cn } from "@/lib/utils"
import { Cross1Icon } from "@radix-ui/react-icons"
import * as Toast from "@radix-ui/react-toast"
import type { ComponentPropsWithoutRef } from "react"
import { useToast } from "./use-toast"

export type ToastProps = ComponentPropsWithoutRef<typeof Toast.Root> & {
  variant?: "default" | "destructive"
}

export function Toaster() {
  const { toasts } = useToast()
  return (
    <Toast.Provider duration={1800} swipeDirection="up">
      {toasts.map(({ id, title, description, variant, className, ...props }) => (
        <Toast.Root key={id} role="status" aria-live="polite"
          data-variant={variant} className={cn("zed-toast group pointer-events-auto relative flex items-center gap-2 pr-8", className)} {...props}>
          <div className="grid gap-1">
            {title && <Toast.Title className="font-semibold">{title}</Toast.Title>}
            {description && <Toast.Description className="opacity-90">{description}</Toast.Description>}
          </div>
          <Toast.Close aria-label="Dismiss notification" toast-close=""
            className="absolute right-2 top-2 rounded-[var(--zed-radius-lg)] p-1 text-foreground/50 opacity-0 hover:text-foreground focus:opacity-100 focus:outline-none group-hover:opacity-100">
            <Cross1Icon className="h-3 w-3" />
          </Toast.Close>
        </Toast.Root>
      ))}
      <Toast.Viewport className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex max-w-full flex-col outline-none" />
    </Toast.Provider>
  )
}
