import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

it("replies to runtime messages, reports failure badge, and clears badge on success", async () => {
  vi.resetModules()
  let message!: (data: unknown, sender: { id: string }, reply: (result: unknown) => void) => void
  const values: Record<string, unknown> = {}
  const inject = vi.fn().mockRejectedValue(new Error("Restricted page"))
  const badge = vi.fn(async () => {})
  const title = vi.fn(async () => {})
  vi.stubGlobal("chrome", {
    contextMenus: { removeAll: vi.fn((callback: () => void) => callback()), create: vi.fn(), onClicked: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } },
    storage: {
      local: {
        get: async () => ({ ...values }),
        set: async (patch: Record<string, unknown>) => { Object.assign(values, patch) },
      },
    },
    tabs: { onActivated: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() }, query: async () => [{ id: 7 }] },
    scripting: { executeScript: inject },
    action: { setBadgeText: badge, setTitle: title },
    runtime: { onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() }, id: "zed", onMessage: { addListener: (listener: typeof message) => { message = listener } } },
  })
  await import("./background")

  // Message with injection failure
  const failReply = vi.fn()
  message({ event: "inspectModeApply", value: true }, { id: "zed" }, failReply)
  await vi.waitFor(() => expect(badge).toHaveBeenCalledWith({ tabId: 7, text: "!" }))
  expect(title).toHaveBeenCalledWith({ tabId: 7, title: expect.stringContaining("Preference saved") })
  expect(failReply).toHaveBeenCalledWith(expect.objectContaining({ ok: false, saved: true, tabId: 7 }))

  // Message with injection success
  inject.mockResolvedValue([{ frameId: 0 }])
  const successReply = vi.fn()
  message({ event: "hideMainScrollBar" }, { id: "zed" }, successReply)
  await vi.waitFor(() => expect(badge).toHaveBeenLastCalledWith({ tabId: 7, text: "" }))
  expect(title).toHaveBeenLastCalledWith({ tabId: 7, title: "Extension Zed" })
  expect(successReply).toHaveBeenCalledWith({ ok: true, saved: false, tabId: 7 })
})

it("runs page shortcuts from a focused frame before any popup interaction", async () => {
  vi.resetModules()
  let message!: (data: unknown, sender: unknown, reply: (result: unknown) => void) => boolean | undefined
  const inject = vi.fn(async () => [{ frameId: 0 }])
  vi.stubGlobal("chrome", {
    contextMenus: { removeAll: vi.fn((callback: () => void) => callback()), create: vi.fn(), onClicked: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: {
      id: "zed", getURL: (path: string) => `chrome-extension://zed/${path}`,
      onMessage: { addListener: (listener: typeof message) => { message = listener } },
      onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() },
    },
    storage: { local: { get: async () => ({}), set: vi.fn(async () => {}) } },
    scripting: { executeScript: inject },
    tabs: { onActivated: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() }, query: async () => [] },
  })
  await import("./background")
  const reply = vi.fn()
  expect(message({ type: "zed:shortcut", id: "action13" }, { id: "zed", tab: { id: 7 }, frameId: 3 }, reply)).toBe(true)
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true }))
  expect(inject).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 7, allFrames: true } }))
})

it("backfills shortcut listeners on worker load, install and startup without a popup", async () => {
  vi.resetModules()
  const events: Record<string, () => void> = {}
  const inject = vi.fn(async () => [])
  vi.stubGlobal("chrome", {
    contextMenus: { removeAll: vi.fn((callback: () => void) => callback()), create: vi.fn(), onClicked: { addListener: vi.fn() } },
    commands: { onCommand: { addListener: vi.fn() } },
    runtime: {
      onMessage: { addListener: vi.fn() },
      onInstalled: { addListener: (listener: () => void) => { events.install = listener } },
      onStartup: { addListener: (listener: () => void) => { events.startup = listener } },
    },
    tabs: { onActivated: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() }, query: vi.fn(async () => [{ id: 7 }, { id: 8 }]) },
    scripting: { executeScript: inject },
  })
  await import("./background")
  expect(chrome.contextMenus.create).toHaveBeenCalledWith({ id: "zed-save-text", title: "Save text to Zed", contexts: ["selection"] })
  await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(2))
  inject.mockRejectedValueOnce(new Error("Protected page"))
  events.install()
  await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(4))
  events.startup()
  await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(6))
  expect(inject).toHaveBeenCalledWith({ target: { tabId: 7, allFrames: true }, files: ["scripts/shortcuts.js"] })
})

it("reconnects activated and newly loaded tabs without opening the popup", async () => {
  vi.resetModules()
  let activate!: (info: { tabId: number }) => void
  let update!: (tabId: number, change: { status: string }) => void
  const inject = vi.fn(async () => [])
  vi.stubGlobal("chrome", {
    contextMenus: { removeAll: vi.fn((callback: () => void) => callback()), create: vi.fn(), onClicked: { addListener: vi.fn() } },
    runtime: { onMessage: { addListener: vi.fn() }, onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() } },
    tabs: {
      query: async () => [],
      onActivated: { addListener: (listener: typeof activate) => { activate = listener } },
      onUpdated: { addListener: (listener: typeof update) => { update = listener } },
    },
    scripting: { executeScript: inject },
  })
  await import("./background")
  activate({ tabId: 7 })
  update(8, { status: "loading" })
  update(8, { status: "complete" })
  await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(2))
  expect(inject).toHaveBeenCalledWith({ target: { tabId: 7, allFrames: true }, files: ["scripts/shortcuts.js"] })
  expect(inject).toHaveBeenCalledWith({ target: { tabId: 8, allFrames: true }, files: ["scripts/shortcuts.js"] })
})
