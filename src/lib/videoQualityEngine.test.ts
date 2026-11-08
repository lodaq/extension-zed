import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const source = readFileSync(new URL("../../public/scripts/applyVideoQuality.js", import.meta.url), "utf8")

function page(videos: object[], extra: Record<string, unknown> = {}) {
  const listeners = new Map<string, (event: { type: string; target: object; detail?: unknown }) => void>()
  const win = {
    __zedVideoQualitySettings: { quality: "hd1080", fallback: "lower" },
    ...extra,
  }
  const run = () => runInNewContext(source, {
    window: win,
    document: {
      getElementById: () => null,
      querySelectorAll: (selector: string) => selector === "video" ? videos : [],
      addEventListener: (type: string, listener: (event: { type: string; target: object; detail?: unknown }) => void) => listeners.set(type, listener),
    },
    setTimeout: vi.fn(), clearTimeout: vi.fn(),
  })
  return { win, run, event: (type: string, target: object, detail?: unknown) => listeners.get(type)?.({ type, target, detail }) }
}

describe("programmatic video quality", () => {
  it("finds Facebook's controller through the root tree when host video expandos are absent", async () => {
    const state = { availableVideoQualities: ["240p", "720p"], selectedVideoQuality: "auto" }
    const container = { __reactContainer$test: { stateNode: { current: { child: {} } } } }
    const video = { tagName: "VIDEO", parentElement: container }
    const selectVideoQuality = vi.fn((quality: string) => { state.selectedVideoQuality = quality })
    const controller = { getCurrentState: () => state, internal_getVideoElement: () => video, selectVideoQuality }
    const owner = { memoizedState: { memoizedState: { current: { value: { implementationController: controller } } } } }
    const unrelated = { stateNode: {}, sibling: { stateNode: video, return: owner } }
    container.__reactContainer$test.stateNode.current.child = unrelated
    const p = page([video], { location: { hostname: "www.facebook.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    expect(await p.run()).toBe("240p")
    expect(state.selectedVideoQuality).toBe("240p")
    expect(selectVideoQuality).toHaveBeenCalledTimes(1)
  })

  it("reports the playing Reel's quality instead of the preloaded next Reel", async () => {
    const activeState = { availableVideoQualities: ["240p", "720p"], selectedVideoQuality: "auto" }
    const nextState = { availableVideoQualities: ["540p", "1080p"], selectedVideoQuality: "auto" }
    function video(state: typeof activeState, paused: boolean) {
      const node = { tagName: "VIDEO", paused, __reactFiber$test: {} }
      const controller = { getCurrentState: () => state, internal_getVideoElement: () => node, selectVideoQuality: (quality: string) => { state.selectedVideoQuality = quality } }
      node.__reactFiber$test = { memoizedProps: { value: controller } }
      return node
    }
    const p = page([video(activeState, false), video(nextState, true)], { location: { hostname: "www.facebook.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    expect(await p.run()).toBe("240p")
    expect(activeState.selectedVideoQuality).toBe("240p")
    expect(nextState.selectedVideoQuality).toBe("540p")
  })

  it("selects Facebook's actual 144p stream through its controller without input or navigation", async () => {
    const state = { availableVideoQualities: ["144p", "180p", "240p", "720p", "1080p"], selectedVideoQuality: "auto", videoFBID: "reel-one", playerInstanceKey: "one" }
    const video = { tagName: "VIDEO", currentSrc: "blob:reel", __reactFiber$test: {} }
    const selectVideoQuality = vi.fn((quality: string) => { state.selectedVideoQuality = quality })
    const controller = { getCurrentState: () => state, internal_getVideoElement: () => video, selectVideoQuality }
    video.__reactFiber$test = { memoizedState: { memoizedState: { current: { value: { implementationController: controller } } } } }
    const p = page([video], { location: { hostname: "www.facebook.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    expect(await p.run()).toBe("144p")
    expect(state.selectedVideoQuality).toBe("144p")
    p.event("playing", video)
    p.event("canplay", video)
    p.event("loadstart", video)
    p.event("loadedmetadata", video)
    expect(selectVideoQuality).toHaveBeenCalledTimes(1)
    p.win.__zedVideoQualitySettings = { quality: "auto", fallback: "lower" }
    await p.run()
    expect(state.selectedVideoQuality).toBe("auto")
  })

  it("does not select quality on a Facebook controller belonging to another video", async () => {
    const selectVideoQuality = vi.fn()
    const controller = { getCurrentState: () => ({ availableVideoQualities: ["144p"] }), internal_getVideoElement: () => ({}), selectVideoQuality }
    const video = { tagName: "VIDEO", __reactFiber$test: { memoizedProps: { value: controller } } }
    const p = page([video], { location: { hostname: "www.facebook.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    await p.run()
    expect(selectVideoQuality).not.toHaveBeenCalled()
  })

  it("applies Facebook speed through the native controller and selects its actual lowest quality", async () => {
    const state = { availableVideoQualities: ["270p", "360p", "1080p"], selectedVideoQuality: "auto", targetPlaybackRate: 1 }
    const video = { tagName: "VIDEO", __reactFiber$test: {} }
    const selectVideoQuality = vi.fn((quality: string) => { state.selectedVideoQuality = quality })
    const setPlaybackRate = vi.fn((rate: number) => { state.targetPlaybackRate = rate })
    const controller = { getCurrentState: () => state, internal_getVideoElement: () => video, selectVideoQuality, setPlaybackRate }
    video.__reactFiber$test = { memoizedProps: { value: controller } }
    const p = page([video], { location: { hostname: "www.facebook.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    expect(await p.run()).toBe("270p")
    p.event("zed-playback-speed-changed", video, 2)
    expect(state.targetPlaybackRate).toBe(2)
    expect(setPlaybackRate).toHaveBeenCalledTimes(1)
    p.event("playing", video)
    expect(setPlaybackRate).toHaveBeenCalledTimes(1)
    expect(selectVideoQuality).toHaveBeenCalledTimes(1)
  })

  it("requires a refresh instead of invoking an old menu automation engine", () => {
    const apply = vi.fn()
    const setSettings = vi.fn()
    const p = page([], { __zedVideoQualityEngine: { version: 2, apply, setSettings } })
    expect(p.run).toThrow("Refresh this tab")
    expect(apply).not.toHaveBeenCalled()
    expect(setSettings).toHaveBeenCalledWith({ quality: "auto", fallback: "lower" }, { apply: false })
  })

  it("sets an exposed HLS instance without loading, seeking, or playing the video", async () => {
    const video = { tagName: "VIDEO", currentSrc: "blob:hls", currentTime: 30, paused: true, play: vi.fn(), load: vi.fn(), hls: {} }
    const hls = { media: video, levels: [{ height: 360 }, { height: 720 }], loadLevel: -1 }
    video.hls = hls
    const p = page([video])
    await p.run()
    expect(hls.loadLevel).toBe(1)
    expect(video.currentTime).toBe(30)
    expect(video.play).not.toHaveBeenCalled()
    expect(video.load).not.toHaveBeenCalled()
    p.win.__zedVideoQualitySettings = { quality: "auto", fallback: "lower" }
    await p.run()
    expect(hls.loadLevel).toBe(-1)
  })

  it("uses Video.js levels for all players and restores automatic selection", async () => {
    const levels = [{ height: 360, enabled: true }, { height: 1080, enabled: true }]
    const player = { qualityLevels: () => levels, currentSrc: () => "stream.m3u8" }
    const p = page([], { videojs: { getPlayers: () => ({ one: player }) } })
    await p.run()
    expect(levels.map(level => level.enabled)).toEqual([false, true])
    p.win.__zedVideoQualitySettings = { quality: "auto", fallback: "lower" }
    await p.run()
    expect(levels.every(level => level.enabled)).toBe(true)
  })

  it("uses Shaka tracks without changing the selected audio or clearing the buffer", async () => {
    const configure = vi.fn()
    const selectVariantTrack = vi.fn()
    const tracks = [
      { id: 1, height: 360, language: "ar", audioId: 1, active: true },
      { id: 2, height: 1080, language: "en", audioId: 2 },
      { id: 3, height: 720, language: "ar", audioId: 1 },
    ]
    const player = { getVariantTracks: () => tracks, configure, selectVariantTrack }
    const video = { tagName: "VIDEO", currentSrc: "blob:shaka", ui: { getControls: () => ({ getPlayer: () => player }) } }
    const p = page([video])
    await p.run()
    expect(configure).toHaveBeenCalledWith({ abr: { enabled: false } })
    expect(selectVariantTrack).toHaveBeenCalledWith(tracks[2], false)
    p.win.__zedVideoQualitySettings = { quality: "auto", fallback: "lower" }
    await p.run()
    expect(configure).toHaveBeenLastCalledWith({ abr: { enabled: true } })
  })

  it("retries late levels, deduplicates media events, and handles reused sources", async () => {
    const levels: { height: number }[] = []
    const change = vi.fn()
    const video = { tagName: "VIDEO", currentSrc: "blob:reused", hls: {} }
    video.hls = { media: video, levels, set loadLevel(value: number) { change(value) } }
    const p = page([video])
    await p.run()
    expect(change).not.toHaveBeenCalled()
    levels.push({ height: 720 })
    p.event("loadedmetadata", video)
    expect(change).toHaveBeenCalledTimes(1)
    p.event("canplay", video)
    expect(change).toHaveBeenCalledTimes(1)
    p.event("loadstart", video)
    p.event("loadedmetadata", video)
    expect(change).toHaveBeenCalledTimes(2)
  })

  it("keeps applying to other players when a disposed player throws", async () => {
    const levels = [{ height: 360, enabled: true }, { height: 1080, enabled: true }]
    const p = page([], { videojs: { getPlayers: () => ({
      disposed: { qualityLevels: () => { throw new Error("Disposed") } },
      working: { qualityLevels: () => levels },
    }) } })
    await p.run()
    expect(levels[0].enabled).toBe(false)
  })
})
