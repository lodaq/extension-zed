/// <reference types="node" />
import { readFileSync } from "node:fs"
import { runInNewContext as runContext, type Context } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const script = (name: string) => readFileSync(new URL(`../../public/scripts/${name}.js`, import.meta.url), "utf8")
const runInNewContext = (source: string, context: Context) => runContext(source, { setTimeout, clearTimeout, ...context })

describe("injected script completion", () => {
  it.each([
    "inspectMode",
    "youtubeProgressBar",
    "youtubeControls",
    "volumeBoost",
    "arabicRtlMode",
    "youtubeDuration",
    "youtubeHalfScreen",
  ])("%s returns its asynchronous work", async (name) => {
    let finish!: (value: Record<string, unknown>) => void
    const get = new Promise<Record<string, unknown>>((resolve) => { finish = resolve })
    const result = runInNewContext(script(name), {
      chrome: { storage: { local: { get: () => get } } },
      window: { __zedVolumeBoost: { setGain: () => {} }, __zedArabicRtlApply: () => {} },
      location: { origin: "https://example.com" },
      document: { getElementById: () => null },
    })
    expect(typeof result?.then).toBe("function")
    let completed = false
    const pending = result.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    finish({})
    await pending
    expect(completed).toBe(true)
  })

  it("injects and resets main, all, and custom scrollbar style elements", () => {
    const mainCreated: { id?: string }[] = []
    const allCreated: { id?: string }[] = []
    const customCreated: { id?: string }[] = []
    const mainRemove = vi.fn()
    const allRemove = vi.fn()
    const customRemove = vi.fn()

    // Hide main scrollbar
    runInNewContext(script("hideMainScrollBar"), {
      document: {
        getElementById: () => null,
        createElement: () => { const el = { id: "", appendChild: () => {} }; mainCreated.push(el); return el },
        createTextNode: (t: string) => t,
        head: { appendChild: () => {} },
      },
    })
    expect(mainCreated[0]?.id).toBe("zed-hide-main-scrollbar")

    // Reset main scrollbar
    runInNewContext(script("resetMainScrollBar"), {
      document: { getElementById: (id: string) => (id === "zed-hide-main-scrollbar" ? { remove: mainRemove } : null) },
    })
    expect(mainRemove).toHaveBeenCalled()

    // Hide all scrollbars
    runInNewContext(script("hideAllScrollBars"), {
      document: {
        getElementById: () => null,
        createElement: () => { const el = { id: "", appendChild: () => {} }; allCreated.push(el); return el },
        createTextNode: (t: string) => t,
        head: { appendChild: () => {} },
      },
    })
    expect(allCreated[0]?.id).toBe("zed-hide-all-scrollbars")

    // Reset all scrollbars
    runInNewContext(script("resetAllScrollBars"), {
      document: { getElementById: (id: string) => (id === "zed-hide-all-scrollbars" ? { remove: allRemove } : null) },
    })
    expect(allRemove).toHaveBeenCalled()

    // Apply custom scrollbar
    runInNewContext(script("applyCustomScrollbar"), {
      document: {
        getElementById: () => null,
        createElement: () => { const el = { id: "", appendChild: () => {} }; customCreated.push(el); return el },
        createTextNode: (t: string) => t,
        head: { appendChild: () => {} },
      },
    })
    expect(customCreated[0]?.id).toBe("zed-custom-scrollbar")

    // Reset custom scrollbar
    runInNewContext(script("resetCustomScrollbar"), {
      document: { getElementById: (id: string) => (id === "zed-custom-scrollbar" ? { remove: customRemove } : null) },
    })
    expect(customRemove).toHaveBeenCalled()
  })

  it("applies and resets YouTube progress bar, duration, half-screen, and controls styles", async () => {
    let progressStyle = ""
    const progressAppend = vi.fn((node: { textContent: string }) => { progressStyle = node.textContent })
    const progressRemove = vi.fn()

    // Enable progress bar hide
    await runInNewContext(script("youtubeProgressBar"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHideProgress: true }) } } },
      document: {
        getElementById: () => null,
        createElement: () => ({ id: "", textContent: "" }),
        head: { appendChild: progressAppend },
      },
    })
    expect(progressStyle).toContain(".ytp-progress-bar-container")

    // Disable progress bar hide
    await runInNewContext(script("youtubeProgressBar"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHideProgress: false }) } } },
      document: {
        getElementById: () => ({ remove: progressRemove }),
        createElement: () => ({ id: "" }),
      },
    })
    expect(progressRemove).toHaveBeenCalled()

    // YouTube duration hide
    let durationStyle = ""
    const durationAppend = vi.fn((node: { textContent: string }) => { durationStyle = node.textContent })
    const durationRemove = vi.fn()

    await runInNewContext(script("youtubeDuration"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHideDuration: true }) } } },
      document: {
        getElementById: () => null,
        createElement: () => ({ id: "", textContent: "" }),
        head: { appendChild: durationAppend },
      },
    })
    expect(durationStyle).toContain(".ytp-time-duration")

    await runInNewContext(script("youtubeDuration"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHideDuration: false }) } } },
      document: {
        getElementById: () => ({ remove: durationRemove }),
        createElement: () => ({ id: "" }),
      },
    })
    expect(durationRemove).toHaveBeenCalled()

    // YouTube half screen
    let halfScreenStyle = ""
    const halfScreenAppend = vi.fn((node: { textContent: string }) => { halfScreenStyle = node.textContent })
    const halfScreenRemove = vi.fn()

    await runInNewContext(script("youtubeHalfScreen"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHalfScreen: true }) } } },
      document: {
        getElementById: () => null,
        createElement: () => ({ id: "", textContent: "" }),
        head: { appendChild: halfScreenAppend },
      },
    })
    expect(halfScreenStyle).toContain("ytd-watch-flexy")

    await runInNewContext(script("youtubeHalfScreen"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHalfScreen: false }) } } },
      document: {
        getElementById: () => ({ remove: halfScreenRemove }),
        createElement: () => ({ id: "" }),
      },
    })
    expect(halfScreenRemove).toHaveBeenCalled()

    // YouTube controls
    let controlsStyle = ""
    const controlsAppend = vi.fn((node: { textContent: string }) => { controlsStyle = node.textContent })
    const controlsRemove = vi.fn()

    await runInNewContext(script("youtubeControls"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHideControls: true }) } } },
      document: {
        getElementById: () => null,
        createElement: () => ({ id: "", textContent: "" }),
        head: { appendChild: controlsAppend },
      },
    })
    expect(controlsStyle).toContain(".ytp-chrome-bottom")

    await runInNewContext(script("youtubeControls"), {
      chrome: { storage: { local: { get: async () => ({ youtubeHideControls: false }) } } },
      document: {
        getElementById: () => ({ remove: controlsRemove }),
        createElement: () => ({ id: "" }),
      },
    })
    expect(controlsRemove).toHaveBeenCalled()
  })

  it("reversibly applies and resets youtubeFocusMode without mutating element inline styles", () => {
    const attributes = new Map<string, string>()
    const classList = new Set<string>()
    let baseStyleAdded = false
    let baseStyleRemoved = false

    const anchor = {
      setAttribute: (k: string, v: string) => attributes.set(k, v),
      removeAttribute: (k: string) => attributes.delete(k),
      hasAttribute: (k: string) => attributes.has(k),
      parentElement: null,
      style: {
        setProperty: vi.fn(),
        removeProperty: vi.fn(),
      },
    }

    const doc = {
      documentElement: {
        classList: {
          add: (c: string) => classList.add(c),
          remove: (c: string) => classList.delete(c),
        },
      },
      head: {
        appendChild: () => { baseStyleAdded = true },
      },
      getElementById: (id: string) => (id === "extension-zed-yt-focus-base" ? { remove: () => { baseStyleRemoved = true } } : null),
      querySelector: (sel: string) => (sel.includes("player") ? anchor : null),
      querySelectorAll: () => [],
      createElement: () => ({ id: "", textContent: "" }),
      addEventListener: () => {},
    }

    const win: Record<string, unknown> = {
      __zedYoutubeFocusEnabled: true,
      addEventListener: () => {},
      dispatchEvent: () => {},
    }

    // Apply Focus Mode
    runInNewContext(script("youtubeFocusMode"), {
      location: { hostname: "www.youtube.com" },
      document: doc,
      window: win,
      requestAnimationFrame: (fn: () => void) => fn(),
      setTimeout: (fn: () => void) => fn(),
      Event: class {},
      AbortController: class { abort() {} },
    })

    expect(baseStyleAdded).toBe(true)
    expect(classList.has("extension-zed-yt-focus-lock")).toBe(true)
    expect(attributes.get("data-zed-focus-anchor")).toBe("1")
    // Assert zero inline style mutations occurred!
    expect(anchor.style.setProperty).not.toHaveBeenCalled()

    // Disable / Reset Focus Mode
    win.__zedYoutubeFocusEnabled = false
    runInNewContext(script("youtubeFocusMode"), {
      location: { hostname: "www.youtube.com" },
      document: {
        ...doc,
        querySelector: (sel: string) => (sel.includes("anchor") ? anchor : null),
      },
      window: win,
      requestAnimationFrame: (fn: () => void) => fn(),
      setTimeout: (fn: () => void) => fn(),
      Event: class {},
      AbortController: class { abort() {} },
    })

    expect(baseStyleRemoved).toBe(true)
    expect(classList.has("extension-zed-yt-focus-lock")).toBe(false)
    expect(attributes.has("data-zed-focus-anchor")).toBe(false)
    expect(anchor.style.removeProperty).not.toHaveBeenCalled()
  })

  it("applies target video quality with fallback to YouTube player and updates localStorage", async () => {
    let storedPayload = ""
    const localStorageMock = {
      setItem: (key: string, val: string) => { if (key === "yt-player-quality") storedPayload = val },
      removeItem: vi.fn(),
    }

    let appliedQuality = ""
    const playerMock = {
      getAvailableQualityLevels: () => ["hd720", "large", "medium"],
      setPlaybackQualityRange: (q1: string) => { appliedQuality = q1 },
      setPlaybackQuality: vi.fn(),
    }

    const docMock = {
      getElementById: (id: string) => (id === "movie_player" ? playerMock : null),
      querySelector: () => null,
    }

    const winMock = {
      __zedVideoQualitySettings: { quality: "hd1080", fallback: "lower" },
      addEventListener: vi.fn(),
    }

    const res = await runInNewContext(script("applyVideoQuality"), {
      window: winMock,
      document: docMock,
      localStorage: localStorageMock,
      Date: { now: () => 1700000000000 },
      setTimeout: vi.fn(),
      Promise,
    })

    expect(res).toBe("hd720")
    expect(appliedQuality).toBe("hd720")
    expect(JSON.parse(storedPayload).data).toBe("hd1080")
  })

  it("never clicks Facebook controls or sends synthetic input", async () => {
    const input = vi.fn()
    const video = { tagName: "VIDEO", currentSrc: "blob:facebook", getBoundingClientRect: () => ({ left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360 }) }
    const settings = { click: input, dispatchEvent: input, getAttribute: () => "Settings", getBoundingClientRect: video.getBoundingClientRect }
    const win = {
      __zedVideoQualitySettings: { quality: "hd1080", fallback: "lower" },
      location: { hostname: "www.facebook.com" },
      innerWidth: 1280, innerHeight: 720, addEventListener: vi.fn(),
    }
    const result = runInNewContext(script("applyVideoQuality"), {
      window: win,
      document: {
        getElementById: () => null,
        querySelectorAll: (selector: string) => selector === "video" ? [video] : [settings],
        addEventListener: vi.fn(), dispatchEvent: input,
      },
      setTimeout: vi.fn(), clearTimeout: vi.fn(),
      MouseEvent: class {}, KeyboardEvent: class {},
    })
    expect(input).not.toHaveBeenCalled()
    await result
  })
})
