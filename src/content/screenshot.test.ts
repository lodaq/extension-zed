import { afterEach, expect, it, vi } from "vitest"
import { measureFullPage, restoreFullPage } from "../lib/nativeScreenshot"

afterEach(() => vi.unstubAllGlobals())

it("measures a locked app shell despite clipped body overflow and restores its panel after layout", async () => {
  const panel = {
    clientWidth: 800, clientHeight: 530, scrollHeight: 2200,
    scrollLeft: 0, scrollTop: 120, isConnected: true,
    overflowY: "auto", visibility: "visible",
    getBoundingClientRect: () => ({ left: 0, top: 70, right: 800, bottom: 600 }),
    scrollTo: vi.fn(function (this: { scrollTop: number }, options: { top: number }) { this.scrollTop = options.top }),
  }
  const decoration = { ...panel, overflowY: "hidden", scrollHeight: 4000 }
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  const window = { scrollTo: vi.fn() }
  vi.stubGlobal("window", window)
  vi.stubGlobal("document", { documentElement: { scrollHeight: 600 }, body: { scrollHeight: 2600 }, querySelectorAll: () => [decoration, panel] })
  vi.stubGlobal("innerWidth", 800)
  vi.stubGlobal("innerHeight", 600)
  vi.stubGlobal("devicePixelRatio", 1)
  vi.stubGlobal("scrollX", 0)
  vi.stubGlobal("scrollY", 0)
  vi.stubGlobal("getComputedStyle", (element: unknown) => element)
  expect(await measureFullPage()).toEqual({ width: 800, height: 600, scale: 1, expandedHeight: 2270 })
  expect(panel.scrollTo).not.toHaveBeenCalled()
  panel.scrollTop = 0 // Expanding the viewport removes the panel's overflow.
  const restoring = restoreFullPage()
  expect(panel.scrollTo).not.toHaveBeenCalled()
  frames.shift()!(0)
  frames.shift()!(0)
  await restoring
  expect(panel.scrollTop).toBe(120)
  expect(window.scrollTo).not.toHaveBeenCalled()
})


it("captures scrolled pages from the document origin and restores the original position", async () => {
  const frames: FrameRequestCallback[] = []
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  vi.stubGlobal("document", { documentElement: { scrollHeight: 4000 } })
  vi.stubGlobal("innerWidth", 1000)
  vi.stubGlobal("innerHeight", 800)
  vi.stubGlobal("devicePixelRatio", 1)
  vi.stubGlobal("scrollX", 120)
  vi.stubGlobal("scrollY", 2400)
  const scrollTo = vi.fn(({ left, top }: { left: number; top: number }) => {
    vi.stubGlobal("scrollX", left)
    vi.stubGlobal("scrollY", top)
  })
  vi.stubGlobal("window", { scrollTo })
  const measuring = measureFullPage()
  expect(scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: "instant" })
  frames.shift()!(0)
  frames.shift()!(0)
  expect(await measuring).toEqual({ width: 1000, height: 800, scale: 1, expandedHeight: 0 })
  const restoring = restoreFullPage()
  frames.shift()!(0)
  frames.shift()!(0)
  await restoring
  expect(scrollTo).toHaveBeenLastCalledWith({ left: 120, top: 2400, behavior: "instant" })
})
