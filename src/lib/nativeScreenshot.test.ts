import { afterEach, expect, it, vi } from "vitest"
import { captureFullPage, restoreFullPage } from "./nativeScreenshot"

afterEach(() => vi.unstubAllGlobals())

it.each([false, true])("uses one browser capture for a short page without scrolling and detaches (capture failure: %s)", async (fail) => {
  const attach = vi.fn(async () => {})
  const detach = vi.fn(async () => {})
  const sendCommand = vi.fn(async (_target, method) => {
    if (method === "Page.getLayoutMetrics") return { cssContentSize: { width: 800, height: 200 } }
    if (method === "Page.captureScreenshot") {
      if (fail) throw new Error("Renderer failed")
      return { data: "cG5n" }
    }
    return {}
  })
  const executeScript = vi.fn(async () => [{ result: { width: 800, height: 600, scale: 1 } }])
  vi.stubGlobal("chrome", { tabs: { getZoom: async () => 1 }, debugger: { attach, detach, sendCommand }, scripting: { executeScript } })
  if (fail) await expect(captureFullPage(7)).rejects.toThrow("Renderer failed")
  else expect(await captureFullPage(7)).toBe("data:image/png;base64,cG5n")
  expect(sendCommand.mock.calls.filter((call) => call[1] === "Page.captureScreenshot")).toHaveLength(1)
  expect(sendCommand).toHaveBeenCalledWith({ tabId: 7 }, "Page.captureScreenshot", expect.objectContaining({ captureBeyondViewport: true }))
  expect(executeScript).toHaveBeenLastCalledWith({ target: { tabId: 7 }, func: restoreFullPage })
  expect(detach).toHaveBeenCalledWith({ tabId: 7 })
})

it.each([0.8, 1, 1.1, 1.25, 2])("preserves page zoom %s during viewport expansion and clears it on failure", async (zoom) => {
  vi.stubGlobal("OffscreenCanvas", class { getContext() { return {} } })
  const commands: { method: string; params: unknown }[] = []
  vi.stubGlobal("chrome", {
    tabs: { getZoom: async () => zoom },
    debugger: {
      attach: async () => {}, detach: async () => {},
      sendCommand: async (_target: unknown, method: string, params: unknown) => {
        commands.push({ method, params })
        if (method === "Page.captureScreenshot") throw new Error("Capture interrupted")
        return { cssContentSize: { width: 800, height: 2270 } }
      },
    },
    scripting: { executeScript: async () => [{ result: { width: 800, height: 600, scale: zoom, expandedHeight: 2270 } }] },
  })
  await expect(captureFullPage(7)).rejects.toThrow("Capture interrupted")
  expect(commands).toContainEqual({ method: "Emulation.setDeviceMetricsOverride", params: {
    width: Math.round(800 * zoom), height: Math.round(2270 * zoom),
    deviceScaleFactor: 1, mobile: false, dontSetVisibleSize: true,
  } })
  expect(commands[commands.length - 1].method).toBe("Emulation.clearDeviceMetricsOverride")
})

it("rejects oversized images before encoding and still disconnects", async () => {
  const detach = vi.fn(async () => {})
  const sendCommand = vi.fn(async () => ({ cssContentSize: { width: 800, height: 40000 } }))
  vi.stubGlobal("chrome", {
    tabs: { getZoom: async () => 1 },
    debugger: { attach: async () => {}, detach, sendCommand },
    scripting: { executeScript: async () => [{ result: { width: 800, height: 600, scale: 1 } }] },
  })
  await expect(captureFullPage(7)).rejects.toThrow("size limit")
  expect(sendCommand).not.toHaveBeenCalledWith(expect.anything(), "Page.captureScreenshot", expect.anything())
  expect(detach).toHaveBeenCalled()
})

it.each([1, 1.1])("captures tall pages as offset clips at zoom %s, including the final strip", async (zoom) => {
  const drawImage = vi.fn()
  const close = vi.fn()
  const detach = vi.fn(async () => {})
  const captures: unknown[] = []
  const sendCommand = vi.fn(async (_target, method, params?: unknown) => {
    if (method === "Page.captureScreenshot") captures.push(params)
    if (method === "Page.getLayoutMetrics") return { cssContentSize: { width: 800, height: 1450 } }
    return { data: "cG5n" }
  })
  const dimensions: number[][] = []
  vi.stubGlobal("OffscreenCanvas", class {
    width: number
    height: number
    constructor(width: number, height: number) { this.width = width; this.height = height; dimensions.push([width, height]) }
    getContext() { return { drawImage } }
    async convertToBlob() { return new Blob(["combined"]) }
  })
  vi.stubGlobal("createImageBitmap", async () => ({ close }))
  vi.stubGlobal("chrome", {
    tabs: { getZoom: async () => zoom },
    debugger: { attach: async () => {}, detach, sendCommand },
    scripting: { executeScript: async () => [{ result: { width: 800, height: 600, scale: 1.25 * zoom } }] },
  })
  expect(await captureFullPage(7)).toBe(`data:image/png;base64,${btoa("combined")}`)
  expect(captures).toEqual([0, 300, 600, 900, 1200].map((y) => expect.objectContaining({
    clip: { x: 0, y: y * zoom, width: 800 * zoom, height: Math.min(300, 1450 - y) * zoom, scale: 1 },
  })))
  expect(dimensions).toEqual([[Math.round(1000 * zoom), Math.round(1812.5 * zoom)]])
  expect(drawImage.mock.calls.map((call) => call.slice(1))).toEqual([0, 300, 600, 900, 1200].map((y) => {
    const top = Math.round(y * 1.25 * zoom)
    const bottom = Math.round(Math.min(1450, y + 300) * 1.25 * zoom)
    return [0, top, Math.round(1000 * zoom), bottom - top]
  }))
  expect(close).toHaveBeenCalledTimes(5)
  expect(detach).toHaveBeenCalledWith({ tabId: 7 })
})
