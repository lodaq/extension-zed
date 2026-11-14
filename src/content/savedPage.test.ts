import { afterEach, expect, it, vi } from "vitest"
import { findMediaTargets } from "../lib/mediaTargets"

vi.mock("../lib/mediaTargets", () => ({ findMediaTargets: vi.fn(() => new Map()) }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.resetModules()
})

it.each([false, true])("stops scanning after runtime invalidation (throwing accessor: %s)", async throwing => {
  const callbacks: Record<string, () => void> = {}
  const disconnect = vi.fn()
  const removeListener = vi.fn()
  const removeEventListener = vi.fn()
  const clearInterval = vi.fn()
  const runtime = { id: "zed", getURL: vi.fn(() => "chrome-extension://zed/theme.css") }
  const win = {
    top: null as unknown,
    addEventListener: vi.fn((name: string, callback: () => void) => { callbacks[name] = callback }),
    removeEventListener,
    setInterval: vi.fn((callback: () => void) => { callbacks.interval = callback; return 1 }),
    clearInterval,
    setTimeout: vi.fn(),
    clearTimeout: vi.fn(),
  }
  win.top = win
  vi.stubGlobal("window", win)
  vi.stubGlobal("location", { hostname: "www.instagram.com", href: "https://www.instagram.com/reels/example/" })
  vi.stubGlobal("document", { documentElement: {} })
  vi.stubGlobal("MutationObserver", class {
    observe() {}
    disconnect = disconnect
  })
  vi.stubGlobal("chrome", {
    runtime,
    storage: {
      local: { get: vi.fn(async () => ({})) },
      onChanged: { addListener: vi.fn(), removeListener },
    },
  })
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
  await import("./savedPage")
  expect(findMediaTargets).toHaveBeenCalled()
  vi.mocked(findMediaTargets).mockClear()
  Object.defineProperty(runtime, "id", { get: () => {
    if (throwing) throw new Error("Extension context invalidated.")
    return undefined
  } })
  expect(() => callbacks.scroll()).not.toThrow()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(clearInterval).toHaveBeenCalledWith(1)
  expect(removeListener).toHaveBeenCalledOnce()
  expect(removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), true)
  callbacks.interval()
  expect(findMediaTargets).not.toHaveBeenCalled()
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
})

it.each(["missing", "throwing"])("ignores deferred startup with a %s runtime", async mode => {
  let start = () => {}
  const win = { top: null as unknown }
  win.top = win
  vi.stubGlobal("window", win)
  vi.stubGlobal("location", { hostname: "www.instagram.com" })
  vi.stubGlobal("document", { documentElement: null, addEventListener: (_: string, callback: () => void) => { start = callback } })
  const getURL = vi.fn(() => { throw new Error("Extension context invalidated.") })
  vi.stubGlobal("chrome", { runtime: mode === "missing" ? undefined : { id: "zed", getURL } })
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
  await import("./savedPage")
  expect(() => start()).not.toThrow()
  expect(findMediaTargets).not.toHaveBeenCalled()
})

it.each(["missing runtime", "invalidated callback"])("handles stylesheet load after %s", async mode => {
  const callbacks: Record<string, () => void> = {}
  const disconnect = vi.fn()
  const runtime: { id?: string; getURL: () => string } = { id: "zed", getURL: () => "chrome-extension://zed/theme.css" }
  const host = {
    setAttribute: vi.fn(), attachShadow: () => ({ append: vi.fn() }),
    classList: { toggle: vi.fn() }, isConnected: true,
    hasAttribute: vi.fn(() => true), remove: vi.fn(), parentElement: null as unknown,
  }
  vi.stubGlobal("getComputedStyle", () => ({ position: "relative" }))
  const target = { append: vi.fn(), matches: () => true, prepend: vi.fn(), style: { position: "" } }
  host.parentElement = target
  const button = { setAttribute: vi.fn(), addEventListener: vi.fn() }
  vi.mocked(findMediaTargets).mockReturnValue(new Map([[target as unknown as HTMLElement, "https://www.instagram.com/reel/example/"]]))
  const win = { top: null as unknown, addEventListener: vi.fn(), removeEventListener: vi.fn(), setInterval: () => 1, clearInterval: vi.fn(), clearTimeout: vi.fn() }
  win.top = win
  vi.stubGlobal("window", win)
  vi.stubGlobal("location", { hostname: "www.instagram.com", href: "https://www.instagram.com/reels/example/" })
  vi.stubGlobal("document", { documentElement: {}, createElement: (tag: string) => tag === "div" ? host : tag === "button" ? button : { addEventListener: (name: string, callback: () => void) => { callbacks[name] = callback } } })
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect = disconnect })
  vi.stubGlobal("chrome", { runtime, storage: { local: { get: async () => ({}) }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } })
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
  await import("./savedPage")
  expect(callbacks.load).toBeTypeOf("function")
  if (mode === "missing runtime") runtime.id = undefined
  host.hasAttribute.mockImplementation(() => { throw new Error("Extension context invalidated.") })
  expect(() => callbacks.load()).not.toThrow()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(host.remove).toHaveBeenCalledOnce()
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
})
