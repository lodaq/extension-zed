import { Component, type ErrorInfo, type ReactNode } from "react"
import { ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons"
import { Button } from "./ui/button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Popup ErrorBoundary caught an error:", error, errorInfo)
  }

  private handleReset = async () => {
    try {
      localStorage.removeItem("zed.boot")
      if (typeof chrome !== "undefined" && chrome.storage?.local) await chrome.storage.local.clear()
    } catch { /* Reload even when storage is unavailable. */ }
    finally { window.location.reload() }
  }

  public override render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div
        role="alert"
        className="flex h-[600px] w-[400px] flex-col justify-between overflow-hidden rounded-[var(--zed-radius-lg)] border border-destructive/40 bg-card p-6 text-card-foreground shadow-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 text-destructive">
            <ExclamationTriangleIcon className="h-6 w-6 shrink-0" />
            <h2 className="text-base font-semibold">Something went wrong</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Extension Zed encountered an unexpected error while rendering the popup.
          </p>
          {this.state.error?.message && (
            <div className="max-h-40 overflow-y-auto rounded-[var(--zed-radius-lg)] border border-border bg-muted/60 p-2.5 font-mono text-[length:var(--zed-fs-2xs)] text-destructive">
              {this.state.error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-4">
          {([
            { label: "Reload popup", variant: "default", className: "flex items-center justify-center gap-1.5", run: () => window.location.reload(), icon: true },
            { label: "Reset stored state & reload", variant: "outline", className: "text-muted-foreground hover:text-foreground", run: this.handleReset, icon: false },
          ] as const).map(action => (
            <Button key={action.label} variant={action.variant} size="sm" onClick={action.run} className={`w-full text-xs ${action.className}`}>
              {action.icon && <ReloadIcon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    )
  }
}
