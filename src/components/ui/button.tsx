import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "zed-btn inline-flex items-center justify-center gap-2 px-4 disabled:pointer-events-none disabled:opacity-50",
  { variants: {
    variant: { default: "zed-btn--primary", destructive: "zed-btn--danger", outline: "", secondary: "", ghost: "zed-ghost", link: "underline" },
    size: { default: "", sm: "zed-btn--compact", lg: "", icon: "zed-square" },
  }, defaultVariants: { variant: "outline", size: "default" } }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
