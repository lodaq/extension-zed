import React from "react"
import { describe, expect, it, vi } from "vitest"
import { ErrorBoundary } from "./ErrorBoundary"

// Mock React render/component tree testing in node environment
describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    const boundary = new ErrorBoundary({ children: "child content" })
    expect(boundary.state.hasError).toBe(false)
    expect(boundary.state.error).toBe(null)
    const rendered = boundary.render()
    expect(rendered).toBe("child content")
  })

  it("updates state on getDerivedStateFromError", () => {
    const error = new Error("Simulated component failure")
    const nextState = ErrorBoundary.getDerivedStateFromError(error)
    expect(nextState).toEqual({ hasError: true, error })
  })

  it("renders error card with error message when an error occurred", () => {
    const error = new Error("Boom! Exploded during render")
    const boundary = new ErrorBoundary({ children: "child content" })
    boundary.state = { hasError: true, error }

    const rendered = boundary.render() as React.ReactElement<{ role?: string }>
    expect(rendered).toBeDefined()
    expect(rendered.props.role).toBe("alert")
  })

  it("renders custom fallback when provided", () => {
    const error = new Error("Boom")
    const customFallback = React.createElement("div", { id: "custom" }, "Custom Fallback")
    const boundary = new ErrorBoundary({ children: "child content", fallback: customFallback })
    boundary.state = { hasError: true, error }

    const rendered = boundary.render()
    expect(rendered).toBe(customFallback)
  })

  it("logs error in componentDidCatch", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const boundary = new ErrorBoundary({ children: "child content" })
    const err = new Error("Test error")
    boundary.componentDidCatch(err, { componentStack: "stack trace" })
    expect(spy).toHaveBeenCalledWith("Popup ErrorBoundary caught an error:", err, { componentStack: "stack trace" })
    spy.mockRestore()
  })
})
