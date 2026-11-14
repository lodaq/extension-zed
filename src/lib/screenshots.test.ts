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
