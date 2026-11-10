import { afterEach, describe, expect, it, vi } from "vitest"
import { stepPlayback } from "./playbackPresets"
import { installPlayback } from "./playback"

class Video extends EventTarget {
  playbackRate = 1
  defaultPlaybackRate = 1
  currentSrc = "first.mp4"
}

afterEach(() => vi.unstubAllGlobals())

function page(speed = "1.36", shadowVideos: Video[] = [], hostname = "example.com") {
  const videos = [new Video()]
  const storageListeners = new Set<(changes: Record<string, { newValue: unknown }>, area: string) => void>()
  let mutate = () => {}
  const doc = new EventTarget()
  const attributes = new Map<string, string>()
  const root = { getAttribute: (key: string) => attributes.get(key), setAttribute: (key: string, value: string) => attributes.set(key, value), removeAttribute: (key: string) => attributes.delete(key) }
  const shadow = { host: { isConnected: true }, querySelectorAll: (selector: string) => selector === "video" ? shadowVideos : [] }
  const host = { shadowRoot: shadow }
  Object.assign(doc, { querySelectorAll: (selector: string) => selector === "video" ? videos : shadowVideos.length ? [host] : [], documentElement: root })
  vi.stubGlobal("window", { location: { hostname } })
  vi.stubGlobal("document", doc)
  vi.stubGlobal("HTMLVideoElement", Video)
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: (records: { addedNodes: object[] }[]) => void) { mutate = () => callback([{ addedNodes: [] }]) }
    observe() {}
    disconnect() {}
  })
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({ speed }) }, onChanged: {
      addListener: (listener: typeof storageListeners extends Set<infer T> ? T : never) => storageListeners.add(listener),
      removeListener: (listener: typeof storageListeners extends Set<infer T> ? T : never) => storageListeners.delete(listener),
    } },
  })
  return { videos, attributes, storageListeners, mutate: () => mutate() }
}

describe("playback", () => {
  it("applies media rates and publishes speed for Facebook's controller bridge", async () => {
    const p = page("2", [], "www.facebook.com")
    const cleanup = await installPlayback()
    expect(p.attributes.get("data-zed-playback-speed")).toBe("2")
    expect(p.videos[0].playbackRate).toBe(2)
    expect(p.videos[0].defaultPlaybackRate).toBe(2)
    for (const listener of p.storageListeners) listener({ speed: { newValue: "3" } }, "local")
    expect(p.attributes.get("data-zed-playback-speed")).toBe("3")
    expect(p.videos[0].playbackRate).toBe(3)
    cleanup()
  })

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

  it("allows player overrides until metadata reload, playback start, or an explicit Zed action", async () => {
    const p = page("2")
    await installPlayback()
    const video = p.videos[0]
    expect(video.playbackRate).toBe(2)
    video.playbackRate = 1.25
    video.dispatchEvent(new Event("ratechange"))
    expect(video.playbackRate).toBe(1.25)
    video.dispatchEvent(new Event("loadedmetadata"))
    expect(video.playbackRate).toBe(2)
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

  it("reapplies after metadata and playback start even when a blob URL is reused", async () => {
    const p = page("2")
    const cleanup = await installPlayback()
    const video = p.videos[0]
    expect(video.defaultPlaybackRate).toBe(2)
    for (const type of ["loadedmetadata", "play", "playing"]) {
      video.playbackRate = 1
      video.dispatchEvent(new Event(type))
      expect(video.playbackRate).toBe(2)
    }
    cleanup()
    video.playbackRate = 1
    video.dispatchEvent(new Event("play"))
    expect(video.playbackRate).toBe(1)
  })

  it("does not let one unsupported media element break the remaining videos", async () => {
    const p = page("2")
    Object.defineProperty(p.videos[0], "playbackRate", {
      get: () => 1,
      set: () => { throw new Error("Rate unsupported") },
    })
    const supported = new Video()
    p.videos.push(supported)
    const cleanup = await installPlayback()
    expect(supported.playbackRate).toBe(2)
    cleanup()
  })

  it("applies speed inside open shadow roots and cleans up their listeners", async () => {
    const video = new Video()
    page("2", [video])
    const cleanup = await installPlayback()
    expect(video.playbackRate).toBe(2)
    cleanup()
    video.playbackRate = 1
    video.dispatchEvent(new Event("play"))
    expect(video.playbackRate).toBe(1)
  })
})
