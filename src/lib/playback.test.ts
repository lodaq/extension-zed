import { afterEach, describe, expect, it, vi } from "vitest"
import { stepPlayback } from "./playbackPresets"
import { installPlayback } from "./playback"

class Video extends EventTarget {
  playbackRate = 1
  currentSrc = "first.mp4"
}

afterEach(() => vi.unstubAllGlobals())

function page(speed = "1.36") {
  const videos = [new Video()]
  const storageListeners = new Set<(changes: Record<string, { newValue: unknown }>, area: string) => void>()
  let mutate = () => {}
  const doc = new EventTarget()
  Object.assign(doc, { querySelectorAll: () => videos, documentElement: {} })
  vi.stubGlobal("window", {})
  vi.stubGlobal("document", doc)
  vi.stubGlobal("HTMLVideoElement", Video)
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { mutate = callback }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({ speed }) }, onChanged: {
      addListener: (listener: typeof storageListeners extends Set<infer T> ? T : never) => storageListeners.add(listener),
      removeListener: (listener: typeof storageListeners extends Set<infer T> ? T : never) => storageListeners.delete(listener),
    } },
  })
  return { videos, storageListeners, mutate: () => mutate() }
}

describe("playback", () => {
  it.each(["invalid", "99", "0", "Infinity"])("defaults invalid stored speed %s safely", async (speed) => {
    const p = page(speed)
    const cleanup = await installPlayback()
    expect(p.videos[0].playbackRate).toBe(1)
    cleanup()
  })
  it("normalizes before stepping and clamps at the limits", () => {
    expect(stepPlayback(1.36, 1)).toBe(1.5)
    expect(stepPlayback(1.36, -1)).toBe(1.3)
    expect(stepPlayback(Number.NaN, 1)).toBe(1.1)
    expect(stepPlayback(10, 1)).toBe(10)
    expect(stepPlayback(0.1, -1)).toBe(0.1)
  })

  it("allows player overrides until new media or an explicit Zed action", async () => {
    const p = page("2")
    await installPlayback()
    const video = p.videos[0]
    expect(video.playbackRate).toBe(2)
    video.playbackRate = 1.25
    video.dispatchEvent(new Event("ratechange"))
    expect(video.playbackRate).toBe(1.25)
    video.dispatchEvent(new Event("loadedmetadata"))
    expect(video.playbackRate).toBe(1.25)
    video.currentSrc = "second.mp4"
    video.dispatchEvent(new Event("loadedmetadata"))
    expect(video.playbackRate).toBe(2)
    video.playbackRate = 1.5
    await window.__zedPlaybackApply!()
    expect(video.playbackRate).toBe(2)
  })

  it("handles new videos, global updates, repeated initialization, and cleanup", async () => {
    const p = page()
    const cleanup = await installPlayback()
    await installPlayback()
    expect(p.storageListeners.size).toBe(1)
    const added = new Video()
    p.videos.push(added)
    p.mutate()
    expect(added.playbackRate).toBe(1.4)
    for (const listener of p.storageListeners) listener({ speed: { newValue: "3" } }, "local")
    expect(added.playbackRate).toBe(3)
    cleanup()
    expect(window.__zedPlaybackApply).toBeUndefined()
    expect(p.storageListeners.size).toBe(0)
    added.currentSrc = "new.mp4"
    added.playbackRate = 1
    added.dispatchEvent(new Event("loadedmetadata"))
    expect(added.playbackRate).toBe(1)
  })
})
