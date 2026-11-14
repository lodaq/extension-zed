import { afterEach, expect, it, vi } from "vitest"
import { openScreenshotEditor, sendScreenshotToEditor } from "./screenshotEditor"

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

function mockEditor(open: (image: string) => void) {
  vi.stubGlobal("location", { origin: "https://viliusle.github.io", pathname: "/miniPaint/" })
  vi.stubGlobal("window", { FileOpen: { file_open_data_url_handler: open }, AppConfig: { layers: [{ id: 1, name: "Empty", width: 1, height: 1 }] } })
}

it("passes the original PNG to miniPaint and waits for its image layer", async () => {
  vi.useFakeTimers()
  const open = vi.fn()
  mockEditor(open)
  const image = `data:image/png;base64,${btoa("x".repeat(2_000_000))}`
  let settled = false
  const result = sendScreenshotToEditor(image).then((value) => { settled = true; return value })
  await vi.advanceTimersByTimeAsync(100)
  expect(open).toHaveBeenCalledExactlyOnceWith(image)
  expect(settled).toBe(false)
  Object.assign(window, { AppConfig: { layers: [{ id: 2, name: "Data URL", width: 1920, height: 1080 }] } })
  await vi.advanceTimersByTimeAsync(25)
  expect(await result).toBe(true)
})

it("times out if the editor opens but the image never loads", async () => {
  vi.useFakeTimers()
  mockEditor(vi.fn())
  const result = sendScreenshotToEditor("data:image/png;base64,eA==")
  await vi.advanceTimersByTimeAsync(15_000)
  expect(await result).toBe(false)
})

it("waits for the editor to initialize before opening the image", async () => {
  vi.useFakeTimers()
  mockEditor(vi.fn())
  Object.assign(window, { FileOpen: undefined })
  const result = sendScreenshotToEditor("data:image/png;base64,eA==")
  await vi.advanceTimersByTimeAsync(100)
  const open = vi.fn(() => Object.assign(window, { AppConfig: { layers: [{ id: 2, name: "Data URL", width: 2, height: 2 }] } }))
  Object.assign(window, { FileOpen: { file_open_data_url_handler: open } })
  await vi.advanceTimersByTimeAsync(25)
  expect(await result).toBe(true)
  expect(open).toHaveBeenCalledOnce()
})

it("refuses to transfer to a different site or another GitHub Pages project", async () => {
  vi.stubGlobal("location", { origin: "https://example.com", pathname: "/miniPaint/" })
  expect(await sendScreenshotToEditor("data:image/png;base64,eA==")).toBe(false)
  vi.stubGlobal("location", { origin: "https://viliusle.github.io", pathname: "/other/" })
  expect(await sendScreenshotToEditor("data:image/png;base64,eA==")).toBe(false)
})

it("opens miniPaint's own tab and passes the original image to its page-context script", async () => {
  const create = vi.fn(async () => ({ id: 12 }))
  const executeScript = vi.fn(async () => [{ result: true }])
  vi.stubGlobal("chrome", { tabs: { create, get: async () => ({ status: "complete" }) }, scripting: { executeScript } })
  const image = "data:image/png;base64,eA=="
  await openScreenshotEditor(image)
  expect(create).toHaveBeenCalledWith({ url: "https://viliusle.github.io/miniPaint/" })
  expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 12 }, world: "MAIN", func: sendScreenshotToEditor, args: [image] })
})

it("rejects malformed and oversized messages before opening a tab", async () => {
  const create = vi.fn()
  vi.stubGlobal("chrome", { tabs: { create } })
  for (const image of [undefined, "https://example.com/image.png", "data:image/png;base64,'", "x".repeat(48 * 1024 * 1024 + 1)]) {
    await expect(openScreenshotEditor(image)).rejects.toThrow("Download")
  }
  expect(create).not.toHaveBeenCalled()
})

it("reports image loading failure instead of claiming success", async () => {
  vi.stubGlobal("chrome", { tabs: { create: async () => ({ id: 12 }), get: async () => ({ status: "complete" }) }, scripting: { executeScript: async () => [{ result: false }] } })
  await expect(openScreenshotEditor("data:image/png;base64,eA==")).rejects.toThrow("could not open")
})
