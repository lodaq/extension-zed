import { afterEach, expect, it, vi } from "vitest"

vi.mock("./savedPage", () => ({}))
vi.mock("./savedIndicator", () => ({ installSavedIndicator: vi.fn() }))

afterEach(() => {
  delete (globalThis as { __zedShortcutsInstalled?: boolean }).__zedShortcutsInstalled
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

it.each(["accessor", "synchronous message", "rejected message"])("handles invalidation from %s without an uncaught error", async mode => {
  let keydown: (event: KeyboardEvent) => Promise<void> = async () => {}
  const removeEventListener = vi.fn()
  const runtime = {
    id: "zed",
    sendMessage: vi.fn(() => {
      if (mode === "synchronous message") throw new Error("Extension context invalidated.")
      return Promise.reject(new Error("Extension context invalidated."))
    }),
  }
  const win = {
    top: {},
    addEventListener: (_name: string, listener: typeof keydown) => { keydown = listener },
    removeEventListener,
  }
  vi.stubGlobal("window", win)
  vi.stubGlobal("chrome", {
    runtime,
    storage: { onChanged: { addListener: vi.fn() }, local: { get: vi.fn(async () => ({ keyboardShortcuts: { action0: "Alt+Shift+→" } })) } },
  })
  const log = vi.spyOn(console, "error").mockImplementation(() => {})
  await import("./shortcuts")
  if (mode === "accessor") Object.defineProperty(runtime, "id", { get() { throw new Error("Extension context invalidated.") } })
  await expect(keydown({ key: "ArrowRight", code: "ArrowRight", altKey: true, shiftKey: true, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as KeyboardEvent)).resolves.toBeUndefined()
  expect(removeEventListener).toHaveBeenCalledWith("keydown", keydown, true)
  expect(log).not.toHaveBeenCalled()
})
