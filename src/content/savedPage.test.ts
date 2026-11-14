import { afterEach, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { findMediaTargets } from "../lib/mediaTargets"

vi.mock("../design-system/tokens.css?raw", () => ({
  default: readFileSync(new URL("../design-system/tokens.css", import.meta.url), "utf8"),
}))

vi.mock("../lib/mediaTargets", async importOriginal => ({
  ...await importOriginal<typeof import("../lib/mediaTargets")>(),
  findMediaTargets: vi.fn(() => new Map()),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.resetModules()
})

it.each([
  [false, "www.instagram.com"], [true, "www.instagram.com"],
  [false, "www.linkedin.com"], [true, "www.linkedin.com"],
])("stops scanning after runtime invalidation (throwing accessor: %s, host: %s)", async (throwing, hostname) => {
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
  vi.stubGlobal("location", { hostname, href: `https://${hostname}/feed/` })
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
  const runtime = { get id(): string { throw new Error("Extension context invalidated.") } }
  vi.stubGlobal("chrome", { runtime: mode === "missing" ? undefined : runtime })
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
  await import("./savedPage")
  expect(() => start()).not.toThrow()
  expect(findMediaTargets).not.toHaveBeenCalled()
})


it("mounts LinkedIn controls beside post actions with bundled styles and removes them on invalidation", async () => {
  const callbacks: Record<string, () => void> = {}
  const disconnect = vi.fn()
  const runtime: { id?: string } = { id: "zed" }
  const styles: { textContent?: string }[] = []
  const shadowAppend = vi.fn()
  const parent = { append: vi.fn() }
  const host = {
    setAttribute: vi.fn(), attachShadow: () => ({ append: shadowAppend }),
    classList: { toggle: vi.fn() }, isConnected: true,
    hasAttribute: vi.fn(() => true), remove: vi.fn(), parentElement: parent,
  }
  const target = { querySelector: () => parent, parentElement: parent, before: vi.fn(), append: vi.fn(), matches: () => true, prepend: vi.fn(), style: { position: "" } }
  const button = { setAttribute: vi.fn(), addEventListener: vi.fn() }
  vi.mocked(findMediaTargets).mockReturnValue(new Map([[target as unknown as HTMLElement, "https://www.linkedin.com/feed/update/urn:li:activity:123/"]]))
  const win = {
    top: null as unknown,
    addEventListener: (name: string, callback: () => void) => { callbacks[name] = callback },
    removeEventListener: vi.fn(), setInterval: () => 1, clearInterval: vi.fn(), clearTimeout: vi.fn(),
  }
  win.top = win
  vi.stubGlobal("window", win)
  vi.stubGlobal("location", { hostname: "www.linkedin.com", href: "https://www.linkedin.com/feed/" })
  const createElement = vi.fn((tag: string) => {
    if (tag === "div") return host
    if (tag === "button") return button
    const style = {}
    styles.push(style)
    return style
  })
  vi.stubGlobal("document", { documentElement: {}, createElement })
  vi.stubGlobal("MutationObserver", class { observe() {} disconnect = disconnect })
  vi.stubGlobal("chrome", { runtime, storage: { local: { get: async () => ({}) }, onChanged: { addListener: vi.fn(), removeListener: vi.fn() } } })
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
  await import("./savedPage")
  expect(parent.append).toHaveBeenCalledWith(host)
  expect(target.before).not.toHaveBeenCalled()
  expect(host.setAttribute).toHaveBeenCalledWith("data-zed-post-action", "")
  expect(target.prepend).not.toHaveBeenCalled()
  expect(target.append).not.toHaveBeenCalled()
  expect(target.style.position).toBe("")
  expect(createElement).not.toHaveBeenCalledWith("link")
  expect(styles[0].textContent).toContain(":host {")
  expect(styles[0].textContent).toContain("--zed-bg:")
  expect(shadowAppend).toHaveBeenCalledWith(styles[0], button)
  runtime.id = undefined
  callbacks.scroll()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(host.remove).toHaveBeenCalledOnce()
  delete (globalThis as { __zedSaveInstalled?: boolean }).__zedSaveInstalled
})
