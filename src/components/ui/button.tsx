import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

const variants = {
  default: "zed-btn--primary", destructive: "zed-btn--danger", outline: "",
  secondary: "", ghost: "zed-ghost", link: "underline",
}
const sizes = { default: "", sm: "zed-btn--compact", lg: "", icon: "zed-square" }

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outline", size = "default", ...props }, ref) => (
    <button ref={ref} className={cn(
      "zed-btn inline-flex items-center justify-center disabled:pointer-events-none disabled:opacity-50",
      variants[variant], sizes[size], className
    )} {...props} />
  )
)
Button.displayName = "Button"
