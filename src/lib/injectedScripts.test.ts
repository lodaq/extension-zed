import { ACTION_REGISTRY, type ActionExecution } from "./actionRegistry"
import { applyPageStyle } from "../content/pageStyle"
/// <reference types="node" />
import { readFileSync } from "node:fs"
import { runInNewContext as runContext, type Context } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const script = (name: string) => readFileSync(new URL(`../../public/scripts/${name}.js`, import.meta.url), "utf8")
const runInNewContext = (source: string, context: Context) => runContext(source, { setTimeout, clearTimeout, ...context })

describe("injected script completion", () => {
  it.each([
    "inspectMode",
    "volumeBoost",
    "arabicRtlMode",
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

  it.each([
    ["applyCustomScrollbar", "zed-custom-scrollbar"],
  ])("%s injects its style and reset removes it", (apply, id) => {
    const style = { id: "", appendChild: vi.fn(), remove: vi.fn() }
    const appendChild = vi.fn()
    runInNewContext(script(apply), { document: {
      getElementById: () => null,
      createElement: () => style,
      createTextNode: (text: string) => text,
      head: { appendChild },
    } })
    expect(style.id).toBe(id)
    expect(appendChild).toHaveBeenCalledWith(style)
    runInNewContext(`(${applyPageStyle.toString()})("${id}", "")`, { document: { getElementById: (key: string) => key === id ? style : null } })
    expect(style.remove).toHaveBeenCalledOnce()
  })

  it.each([
    ["hideMainScrollBar", "resetMainScrollBar", "html::-webkit-scrollbar"],
    ["hideAllScrollBars", "resetAllScrollBars", "*::-webkit-scrollbar"],
    ["hideYoutubeProgressBar", null, ".ytp-progress-bar-container"],
    ["hideYoutubeDuration", null, ".ytp-time-duration"],
    ["hideYoutubeTimestamps", null, "ytd-thumbnail-overlay-time-status-renderer"],
    ["hideAllYoutubeTimestamps", null, "a[href*=\"&t=\"]"],
    ["youtubeHalfScreen", null, "ytd-watch-flexy"],
    ["hideYoutubeControls", null, ".ytp-chrome-bottom"],
  ] as const)("%s applies and resets its style", (name, reset, selector) => {
    const definition = ACTION_REGISTRY[name] as Extract<ActionExecution, { type: "style" }>
    const style = { id: "", textContent: "", remove: vi.fn() }
    const appendChild = vi.fn()
    const document = {
      getElementById: (id: string) => id === style.id ? style : null,
      createElement: () => style,
      head: { appendChild },
    }
    const run = (css: string) => runInNewContext(`(${applyPageStyle.toString()})(${JSON.stringify(definition.id)}, ${JSON.stringify(css)})`, { document })
    run(definition.css)
    expect(style.id).toBe(definition.id)
    expect(style.textContent).toContain(selector)
    expect(appendChild).toHaveBeenCalledWith(style)
    run(definition.css)
    expect(style.remove).toHaveBeenCalledOnce()
    run(reset ? (ACTION_REGISTRY[reset] as Extract<ActionExecution, { type: "style" }>).css : "")
    expect(style.remove).toHaveBeenCalledTimes(2)
    expect(appendChild).toHaveBeenCalledTimes(2)
  })

  it("hides timestamps across YouTube player, thumbnails, comments, chapters, and transcripts", () => {
    const definition = ACTION_REGISTRY.hideAllYoutubeTimestamps as Extract<ActionExecution, { type: "style" }>
    for (const selector of [
      ".ytp-time-display",
      ".ytp-tooltip-progress-bar-pill-time-stamp",
      ".ytp-tooltip-progress-bar-pill:not(:has(",
      "yt-thumbnail-badge-view-model",
      ".ytInlinePlayerControlsTimeDisplay",
      "a[href*=\"&t=\"]",
      "ytd-macro-markers-list-item-renderer #time",
      ".segment-timestamp",
      ".ytwTranscriptSegmentViewModelTimestamp",
    ]) {
      expect(definition.css).toContain(selector)
    }

    const thumbnails = ACTION_REGISTRY.hideYoutubeTimestamps as Extract<ActionExecution, { type: "style" }>
    expect(thumbnails.css).toContain(".ytInlinePlayerControlsTimeDisplay")
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

    const fullscreenEvents = new Map<string, () => void>()
    const doc = {
      fullscreenElement: null as object | null,
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
      querySelector: (sel: string) => ((sel.includes("player") || sel.includes("anchor")) ? anchor : null),
      querySelectorAll: () => [],
      createElement: () => ({ id: "", textContent: "" }),
      addEventListener: (type: string, listener: () => void) => fullscreenEvents.set(type, listener),
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

    doc.fullscreenElement = {}
    fullscreenEvents.get("fullscreenchange")!()
    expect(classList.has("extension-zed-yt-focus-lock")).toBe(false)
    expect(attributes.get("data-zed-focus-fs-suspended")).toBe("1")
    doc.fullscreenElement = null
    fullscreenEvents.get("webkitfullscreenchange")!()
    expect(classList.has("extension-zed-yt-focus-lock")).toBe(true)
    expect(attributes.has("data-zed-focus-fs-suspended")).toBe(false)

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

it("applies grayscale on load and removes it when disabled or reset", async () => {
  const style = { textContent: "", remove: vi.fn() }
  const append = vi.fn()
  let change!: (changes: Record<string, { newValue?: unknown }>, area: string) => void
  runInNewContext(script("blackAndWhite"), {
    document: { createElement: () => style, documentElement: { append } },
    chrome: { storage: {
      local: { get: async () => ({ blackAndWhite: true }) },
      onChanged: { addListener: (listener: typeof change) => { change = listener } },
    } },
  })
  await Promise.resolve()
  expect(style.textContent).toContain("grayscale(1)")
  expect(append).toHaveBeenCalledWith(style)
  change({ blackAndWhite: { newValue: false } }, "local")
  change({ blackAndWhite: {} }, "local")
  expect(style.remove).toHaveBeenCalledTimes(2)
  change({ blackAndWhite: { newValue: true } }, "local")
  expect(append).toHaveBeenCalledTimes(2)
})

it("installs the grayscale listener only once when reinjected", () => {
  const addListener = vi.fn()
  const context = { globalThis: {}, document: { createElement: () => ({ remove() {} }), documentElement: {} }, chrome: { storage: { local: { get: async () => ({}) }, onChanged: { addListener } } } }
  runInNewContext(script("blackAndWhite"), context)
  runInNewContext(script("blackAndWhite"), context)
  expect(addListener).toHaveBeenCalledTimes(1)
})
