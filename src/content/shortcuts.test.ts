import { afterEach, beforeEach, expect, it, vi } from "vitest"

let target: EventTarget
let send: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()
  delete (globalThis as typeof globalThis & { __zedShortcutsInstalled?: boolean }).__zedShortcutsInstalled
  target = new EventTarget()
  send = vi.fn(async () => ({ ok: true }))
  vi.stubGlobal("window", target)
  vi.stubGlobal("chrome", {
    storage: {
      local: { get: async () => ({ keyboardShortcuts: { action13: "Ctrl+Cmd+S" } }) },
      onChanged: { addListener: vi.fn() },
    },
    runtime: { id: "zed", sendMessage: send },
  })
})
afterEach(() => {
  delete (globalThis as typeof globalThis & { __zedShortcutsInstalled?: boolean }).__zedShortcutsInstalled
  vi.unstubAllGlobals()
})

function key(overrides: Record<string, unknown> = {}) {
  const event = new Event("keydown", { cancelable: true })
  Object.assign(event, {
    key: "s", code: "KeyS", ctrlKey: true, metaKey: true, shiftKey: false, altKey: false,
    repeat: false, isComposing: false,
    composedPath: () => [{ tagName: "TEXTAREA", isContentEditable: true }],
    ...overrides,
  })
  return event
}

it("runs assigned shortcuts in editors before site handlers, once after reinjection", async () => {
  await import("./shortcuts")
  vi.resetModules()
  await import("./shortcuts")
  const siteHandler = vi.fn()
  target.addEventListener("keydown", siteHandler)
  const event = key()
  target.dispatchEvent(event)
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "zed:shortcut", id: "action13" })
  expect(event.defaultPrevented).toBe(true)
  expect(siteHandler).not.toHaveBeenCalled()
})

it("handles assigned keys even when a site has prevented their default action", async () => {
  await import("./shortcuts")
  const event = key()
  event.preventDefault()
  target.dispatchEvent(event)
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: "zed:shortcut", id: "action13" })
})

it("leaves unassigned keys, repeated keys and text composition alone", async () => {
  await import("./shortcuts")
  for (const overrides of [{ ctrlKey: false, metaKey: false }, { repeat: true }, { isComposing: true }]) {
    const event = key(overrides)
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  }
  expect(send).not.toHaveBeenCalled()
})

it("lets working listeners receive keys after an older extension context disconnects", async () => {
  await import("./shortcuts")
  const current = chrome.runtime
  vi.stubGlobal("chrome", { ...chrome, runtime: { ...current, id: undefined } })
  const workingListener = vi.fn()
  target.addEventListener("keydown", workingListener)
  const event = key()
  target.dispatchEvent(event)
  expect(send).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
  expect(workingListener).toHaveBeenCalledOnce()
})
