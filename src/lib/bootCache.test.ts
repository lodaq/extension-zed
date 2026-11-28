import { describe, expect, it, beforeEach } from "@/test/bun-test"
import {
  flushStoredScrollPositions,
  getStoredScrollPosition,
  saveStoredScrollPosition,
  readBootState,
  updateBootState,
  mirrorBootValue,
  _resetBootStateForTesting,
} from "@/lib/bootCache"

describe("Scroll position preservation and storage", () => {
  beforeEach(() => {
    _resetBootStateForTesting()
  })

  it("returns 0 when no scroll position is stored", () => {
    expect(getStoredScrollPosition("misc")).toBe(0)
    expect(getStoredScrollPosition("youtube")).toBe(0)
  })

  it("stores and retrieves scroll positions for multiple keys independently", () => {
    saveStoredScrollPosition("misc", 250)
    saveStoredScrollPosition("youtube", 42)

    expect(getStoredScrollPosition("misc")).toBe(250)
    expect(getStoredScrollPosition("youtube")).toBe(42)
    expect(getStoredScrollPosition("settings")).toBe(0)
  })

  it("clamps negative values to 0 and rounds fractional values", () => {
    saveStoredScrollPosition("misc", -10)
    expect(getStoredScrollPosition("misc")).toBe(0)

    saveStoredScrollPosition("misc", 123.7)
    expect(getStoredScrollPosition("misc")).toBe(124)
  })

  it("persists scroll positions across updateBootState calls", () => {
    saveStoredScrollPosition("misc", 310)
    updateBootState({ dark: false })

    const state = readBootState()
    expect(state.scrollPositions?.misc).toBe(310)
    expect(state.dark).toBe(false)
  })

  it("preserves tool order across boot cache mirrors", () => {
    mirrorBootValue("miscSectionOrder", ["playback", "quality", "password", "volume", "scrollbars", "modes", "screenshot"])
    const state = readBootState()
    expect(state.order).toEqual(["playback", "quality", "password", "volume", "scrollbars", "modes", "screenshot"])
  })
})

it("validates cached preferences, migrates legacy order, and ignores obsolete cache fields", () => {
  _resetBootStateForTesting()
  const storage = new Map<string, string>()
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } })
  try {
    storage.set("zed.boot", JSON.stringify({ dark: false, order: ["modes", "password", "playback", "volume", "quality", "scrollbars"], tab: "youtube", expanded: ["modes"] }))
    expect(readBootState()).toMatchObject({ dark: false, order: ["modes", "password", "playback", "volume", "quality", "scrollbars", "screenshot"] })
    expect(readBootState()).not.toHaveProperty("expanded")
    storage.set("zed.boot", JSON.stringify({ dark: "invalid", order: ["invalid"], scrollPositions: { misc: "invalid" } }))
    expect(readBootState().dark).toBe(false)
    expect(readBootState().order).toContain("screenshot")
    expect(getStoredScrollPosition("misc")).toBe(0)
    storage.set("zed.boot", "broken JSON")
    expect(readBootState().dark).toBe(false)
    saveStoredScrollPosition("library", 100)
    saveStoredScrollPosition("library", 200)
    expect(getStoredScrollPosition("library")).toBe(200)
    expect(storage.get("zed.boot")).toBe("broken JSON")
    flushStoredScrollPositions()
    expect(JSON.parse(storage.get("zed.boot")!)).toMatchObject({ scrollPositions: { library: 200 } })
    saveStoredScrollPosition("misc", Number.NaN)
    expect(getStoredScrollPosition("misc")).toBe(0)
  } finally {
    _resetBootStateForTesting()
    if (original) Object.defineProperty(globalThis, "localStorage", original)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
})
