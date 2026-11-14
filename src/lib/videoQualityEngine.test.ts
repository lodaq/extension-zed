import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const source = readFileSync(new URL("../../public/scripts/applyVideoQuality.js", import.meta.url), "utf8")

function page(videos: object[], extra: Record<string, unknown> = {}, youtubePlayers: object[] = []) {
  const listeners = new Map<string, (event: { type: string; target: object; detail?: unknown }) => void>()
  const win = {
    __zedVideoQualitySettings: { quality: "hd1080", fallback: "lower" },
    ...extra,
  }
  const run = () => runInNewContext(source, {
    window: win,
    document: {
      getElementById: () => null,
      querySelectorAll: (selector: string) => selector === "video" ? videos : selector === ".html5-video-player" ? youtubePlayers : [],
      addEventListener: (type: string, listener: (event: { type: string; target: object; detail?: unknown }) => void) => listeners.set(type, listener),
    },
    setTimeout: vi.fn(), clearTimeout: vi.fn(),
  })
  return { win, run, event: (type: string, target: object, detail?: unknown) => listeners.get(type)?.({ type, target, detail }) }
}

describe("programmatic video quality", () => {
  it.each(["hd720", "auto"])("does not reapply YouTube quality %s during playback reload events", async quality => {
    const setPlaybackQualityRange = vi.fn()
    const setPlaybackQuality = vi.fn()
    let videoId = "first"
    const player = {
      getVideoData: () => ({ video_id: videoId }),
      getAvailableQualityLevels: () => ["hd720", "medium"],
      getPlaybackQuality: () => "hd720",
      setPlaybackQualityRange, setPlaybackQuality,
    }
    const video = { tagName: "VIDEO" }
    const p = page([video], { __zedVideoQualitySettings: { quality, fallback: "lower" } }, [player])
    await p.run()
    p.event("zed-playback-speed-changed", video, 2)
    p.event("emptied", video)
    p.event("loadstart", video)
    p.event("loadedmetadata", video)
    p.event("playing", video)
    expect(setPlaybackQualityRange).toHaveBeenCalledTimes(1)
    expect(setPlaybackQuality).toHaveBeenCalledTimes(1)
    videoId = "next"
    p.event("loadedmetadata", video)
    expect(setPlaybackQuality).toHaveBeenCalledTimes(2)
    // Explicit quality actions must still apply, even on the same video.
    await p.run()
    expect(setPlaybackQuality).toHaveBeenCalledTimes(3)
  })

  it("does not rewrite an already selected YouTube quality when available levels change", async () => {
    const levels = ["hd720", "medium"]
    const setPlaybackQuality = vi.fn()
    const player = {
      getVideoData: () => ({ video_id: "first" }),
      getAvailableQualityLevels: () => levels,
      getPlaybackQuality: () => "hd720",
      setPlaybackQuality,
    }
    const video = { tagName: "VIDEO" }
    const p = page([video], { __zedVideoQualitySettings: { quality: "hd720", fallback: "lower" } }, [player])
    await p.run()
    levels.push("hd1080")
    p.event("playing", video)
    expect(setPlaybackQuality).toHaveBeenCalledTimes(1)
  })

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

  it("selects Instagram Reel quality and restores Auto through its native controller", async () => {
    const state = { availableVideoQualities: ["360p", "720p"], selectedVideoQuality: "auto" }
    const video = { tagName: "VIDEO", paused: false, __reactFiber$test: {} }
    const selectVideoQuality = vi.fn((quality: string) => { state.selectedVideoQuality = quality })
    video.__reactFiber$test = { memoizedState: { memoizedState: { current: { value: { implementationController: {
      getCurrentState: () => state, internal_getVideoElement: () => video, selectVideoQuality,
    } } } } } }
    const p = page([video], { location: { hostname: "www.instagram.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    expect(await p.run()).toBe("360p")
    p.event("playing", video)
    expect(selectVideoQuality).toHaveBeenCalledTimes(1)
    p.win.__zedVideoQualitySettings = { quality: "auto", fallback: "lower" }
    expect(await p.run()).toBe("auto")
    expect(state.selectedVideoQuality).toBe("auto")
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

  it.each(["www.facebook.com", "www.instagram.com"])("preserves quality when changing speed on %s after a media reset", async hostname => {
    const state = { availableVideoQualities: ["360p", "720p"], selectedVideoQuality: "auto", targetPlaybackRate: 1 }
    const video = { tagName: "VIDEO", __reactFiber$test: {} }
    const selectVideoQuality = vi.fn((quality: string) => { state.selectedVideoQuality = quality })
    const setPlaybackRate = vi.fn((rate: number) => { state.targetPlaybackRate = rate })
    video.__reactFiber$test = { memoizedProps: { value: {
      getCurrentState: () => state, internal_getVideoElement: () => video, selectVideoQuality, setPlaybackRate,
    } } }
    const p = page([video], { location: { hostname }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    await p.run()
    state.selectedVideoQuality = "720p"
    p.event("loadstart", video)
    p.event("zed-playback-speed-changed", video, 2)
    expect(state.targetPlaybackRate).toBe(2)
    expect(state.selectedVideoQuality).toBe("720p")
    expect(selectVideoQuality).toHaveBeenCalledTimes(1)
  })

  it("applies Facebook speed through the native controller even when video quality settings are unconfigured", async () => {
    const state = { availableVideoQualities: ["270p", "360p", "1080p"], selectedVideoQuality: "auto", targetPlaybackRate: 1 }
    const video = { tagName: "VIDEO", __reactFiber$test: {} }
    const selectVideoQuality = vi.fn((quality: string) => { state.selectedVideoQuality = quality })
    const setPlaybackRate = vi.fn((rate: number) => { state.targetPlaybackRate = rate })
    const controller = { getCurrentState: () => state, internal_getVideoElement: () => video, selectVideoQuality, setPlaybackRate }
    video.__reactFiber$test = { memoizedProps: { value: controller } }
    const p = page([video], { location: { hostname: "www.facebook.com" }, __zedVideoQualitySettings: null })
    await p.run()
    p.event("zed-playback-speed-changed", video, 1.5)
    expect(state.targetPlaybackRate).toBe(1.5)
    expect(setPlaybackRate).toHaveBeenCalledWith(1.5)
  })

  it("switches TikTok streams through its native player while preserving playback state", async () => {
    const video = { tagName: "VIDEO", currentTime: 12.5, paused: true, volume: 0.4, muted: true, playbackRate: 1.5,
      parentElement: { __reactFiber$test: {} } }
    const nextVideo = { tagName: "VIDEO", paused: true, parentElement: { __reactFiber$test: {} } }
    const config = { playerConfig: { loop: true }, strategyConfig: { bitrateAdapter: { userSelectResolution: "auto", quality: 20 } } }
    const changeVideo = vi.fn((next: typeof config) => { controller.config = next })
    const controller = { element: video, vid: "tiktok-one", state: "ACTIVE", config, changeVideo,
      resolutionInfo: { resolutionList: [{ resolution: "540P" }, { resolution: "720P" }] } }
    video.parentElement.__reactFiber$test = { memoizedState: { memoizedState: { current: controller } } }
    const preload = { ...controller, element: nextVideo, changeVideo: vi.fn() }
    nextVideo.parentElement.__reactFiber$test = { memoizedState: { memoizedState: { current: preload } } }
    const p = page([video, nextVideo], { location: { hostname: "www.tiktok.com" }, __zedVideoQualitySettings: { quality: "tiny", fallback: "lower" } })
    expect(await p.run()).toBe("540p")
    expect(changeVideo).toHaveBeenCalledWith({
      playerConfig: { loop: true, startTime: 12.5, autoplay: false, volume: 0.4, muted: true, playbackRate: 1.5 },
      strategyConfig: { bitrateAdapter: { userSelectResolution: "540P", quality: 20 } },
    }, "ACTIVE", true)
    expect(config.strategyConfig.bitrateAdapter.userSelectResolution).toBe("auto")
    expect(preload.changeVideo).not.toHaveBeenCalled()
    p.event("loadstart", video)
    p.event("canplay", video)
    expect(changeVideo).toHaveBeenCalledTimes(1)
    p.win.__zedVideoQualitySettings = { quality: "hd720", fallback: "lower" }
    expect(await p.run()).toBe("720p")
    expect(controller.config.strategyConfig.bitrateAdapter.userSelectResolution).toBe("720P")
    p.win.__zedVideoQualitySettings = { quality: "auto", fallback: "lower" }
    expect(await p.run()).toBe("auto")
    expect(controller.config.strategyConfig.bitrateAdapter.userSelectResolution).toBe("auto")
  })

  it("applies TikTok quality to the playing video after navigation, leaving preload players alone", async () => {
    const preload = { tagName: "VIDEO", paused: true }
    const video = { tagName: "VIDEO", paused: false, __reactFiber$test: {} }
    const config = { playerConfig: {}, strategyConfig: { bitrateAdapter: { userSelectResolution: "auto" } } }
    const changeVideo = vi.fn((next: typeof config) => { controller.config = next })
    const controller = { element: video, vid: "one", state: "ACTIVE", config, changeVideo,
      resolutionInfo: { resolutionList: [{ resolution: "540P" }, { resolution: "720P" }] } }
    video.__reactFiber$test = { memoizedState: { memoizedState: { current: controller } } }
    const p = page([preload, video], { location: { hostname: "www.tiktok.com" }, __zedVideoQualitySettings: { quality: "large", fallback: "higher" } })
    expect(await p.run()).toBe("540p")
    controller.vid = "two"
    controller.config = config
    controller.resolutionInfo.resolutionList = [{ resolution: "720P" }]
    p.event("loadstart", video)
    p.event("playing", video)
    expect(controller.config.strategyConfig.bitrateAdapter.userSelectResolution).toBe("720P")
    expect(changeVideo).toHaveBeenCalledTimes(2)
  })

  it("ignores TikTok controllers belonging to another video", async () => {
    const changeVideo = vi.fn()
    const video = { tagName: "VIDEO", __reactFiber$test: { memoizedState: { memoizedState: { current: {
      element: {}, changeVideo, config: {}, resolutionInfo: { resolutionList: [{ resolution: "720P" }] },
    } } } } }
    const p = page([video], { location: { hostname: "www.tiktok.com" } })
    expect(await p.run()).toBeNull()
    expect(changeVideo).not.toHaveBeenCalled()
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
