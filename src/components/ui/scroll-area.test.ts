import { describe, expect, it, beforeEach } from "vitest"
import {
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

  it("preserves expanded misc sections across boot cache mirrors", () => {
    mirrorBootValue("miscExpandedSections", ["playback", "quality", "scrollbars"])
    const state = readBootState()
    expect(state.expanded).toEqual(["playback", "quality", "scrollbars"])
  })
})
