import { afterEach, expect, it, vi } from "vitest"
import { handleScreenshotMessage } from "./screenshots"

afterEach(() => vi.unstubAllGlobals())

it("rejects capture from a tab without a matching session before reading any pixels", async () => {
  const capture = vi.fn()
  vi.stubGlobal("chrome", {
    storage: { session: { get: async () => ({}) } },
    tabs: { captureVisibleTab: capture },
  })
  await expect(handleScreenshotMessage({ type: "screenshot:frame", token: "forged" }, { tab: { id: 1, windowId: 2 }, frameId: 0 })).rejects.toThrow("expired")
  expect(capture).not.toHaveBeenCalled()
})

it("rejects screenshot initiation by a page content script", async () => {
  await expect(handleScreenshotMessage({ type: "screenshot:start", mode: "visible" }, { tab: { id: 1, windowId: 2 } })).rejects.toThrow("popup")
})

it("does not capture a different tab after the user switches tabs", async () => {
  const capture = vi.fn()
  vi.stubGlobal("chrome", {
    storage: { session: { get: async () => ({ "screenshot:1": { token: "valid" } }) } },
    tabs: { query: async () => [{ id: 9 }], captureVisibleTab: capture },
    windows: { get: async () => ({ focused: true }) },
  })
  await expect(handleScreenshotMessage({ type: "screenshot:frame", token: "valid" }, { tab: { id: 1, windowId: 2 }, frameId: 0 })).rejects.toThrow("active")
  expect(capture).not.toHaveBeenCalled()
})

it("captures only the authorized active top frame and ends its session", async () => {
  const capture = vi.fn(async () => "data:image/png;base64,cGl4ZWxz")
  const remove = vi.fn(async () => {})
  vi.stubGlobal("chrome", {
    storage: { session: { get: async () => ({ "screenshot:1": { token: "valid" } }), remove } },
    tabs: { query: async () => [{ id: 1 }], captureVisibleTab: capture },
    windows: { get: async () => ({ focused: true }) },
  })
  const sender = { tab: { id: 1, windowId: 2 }, frameId: 0 }
  expect(await handleScreenshotMessage({ type: "screenshot:frame", token: "valid" }, sender)).toEqual({ ok: true, image: "data:image/png;base64,cGl4ZWxz" })
  expect(capture).toHaveBeenCalledWith(2, { format: "png" })
  await handleScreenshotMessage({ type: "screenshot:end", token: "valid" }, sender)
  expect(remove).toHaveBeenCalledWith("screenshot:1")
  await expect(handleScreenshotMessage({ type: "screenshot:frame", token: "valid" }, { ...sender, frameId: 1 })).rejects.toThrow("sender")
})

it("rejects malformed modes from the real popup without injecting scripts", async () => {
  const executeScript = vi.fn()
  vi.stubGlobal("chrome", {
    runtime: { getURL: (path: string) => `chrome-extension://zed/${path}` },
    scripting: { executeScript },
  })
  await expect(handleScreenshotMessage({ type: "screenshot:start", mode: "arbitrary" }, { url: "chrome-extension://zed/index.html" })).rejects.toThrow("mode")
  expect(executeScript).not.toHaveBeenCalled()
})

it("refuses native full-page capture if the browser has not granted debugger access", async () => {
  const attach = vi.fn()
  vi.stubGlobal("chrome", {
    storage: { session: { get: async () => ({ "screenshot:1": { token: "valid" } }) } },
    permissions: { contains: async () => false },
    debugger: { attach },
  })
  await expect(handleScreenshotMessage({ type: "screenshot:full", token: "valid" }, { tab: { id: 1, windowId: 2 }, frameId: 0 })).rejects.toThrow("permission")
  expect(attach).not.toHaveBeenCalled()
})


it("rejects editor requests without an authorized screenshot session", async () => {
  const create = vi.fn()
  vi.stubGlobal("chrome", { storage: { session: { get: async () => ({}) } }, tabs: { create } })
  await expect(handleScreenshotMessage({ type: "screenshot:edit", token: "forged", image: "data:image/png;base64,eA==" }, { tab: { id: 1, windowId: 2 }, frameId: 0 })).rejects.toThrow("expired")
  expect(create).not.toHaveBeenCalled()
})

it("copies PNGs from the authorized extension clipboard frame in the background", async () => {
  const write = vi.fn<(items: { data: Record<string, Blob> }[]) => Promise<void>>(async () => {})
  vi.stubGlobal("chrome", {
    runtime: { getURL: (path: string) => `chrome-extension://zed/${path}` },
    storage: { session: { get: async () => ({ "screenshot:1": { token: "valid" } }) } },
  })
  vi.stubGlobal("navigator", { clipboard: { write } })
  vi.stubGlobal("ClipboardItem", class { constructor(public data: Record<string, Blob>) {} })
  const sender = { tab: { id: 1, windowId: 2 }, frameId: 3, url: "chrome-extension://zed/screenshot-clipboard.html" }
  await expect(handleScreenshotMessage({ type: "screenshot:copy", token: "valid", image: "data:image/png;base64,cG5n" }, sender)).resolves.toEqual({ ok: true })
  expect(write).toHaveBeenCalledOnce()
  const blob = write.mock.calls[0][0][0].data["image/png"]
  expect(blob.type).toBe("image/png")
  expect(await blob.text()).toBe("png")
  await expect(handleScreenshotMessage({ type: "screenshot:copy", token: "valid", image: "not a PNG" }, sender)).rejects.toThrow("Invalid clipboard image")
  await expect(handleScreenshotMessage({ type: "screenshot:copy", token: "valid", image: "data:image/png;base64,cG5n" }, { ...sender, url: "https://gitmanual.com/" })).rejects.toThrow("Invalid screenshot sender")
  await expect(handleScreenshotMessage({ type: "screenshot:copy", token: "forged", image: "data:image/png;base64,cG5n" }, sender)).rejects.toThrow("expired")
})

it("keeps native image copy available on browsers without worker clipboard support", async () => {
  vi.stubGlobal("chrome", {
    runtime: { getURL: (path: string) => `chrome-extension://zed/${path}` },
    storage: { session: { get: async () => ({ "screenshot:1": { token: "valid" } }) } },
  })
  vi.stubGlobal("navigator", {})
  await expect(handleScreenshotMessage({ type: "screenshot:copy", token: "valid", image: "data:image/png;base64,cG5n" }, { tab: { id: 1, windowId: 2 }, frameId: 3, url: "chrome-extension://zed/screenshot-clipboard.html" })).resolves.toEqual({ ok: true, nativeCopy: true })
})
