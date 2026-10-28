import { describe, expect, it } from "vitest"
import { PLAYBACK_MAX, PLAYBACK_MIN, clampPlayback, nearestPreset, presetIndex } from "./playbackPresets"

describe("playback presets", () => {
  it("clamps invalid and out-of-range rates", () => {
    expect(clampPlayback(Number.NaN)).toBe(1)
    expect(clampPlayback(0)).toBe(PLAYBACK_MIN)
    expect(clampPlayback(99)).toBe(PLAYBACK_MAX)
  })

  it("rounds rates to the nearest 0.1× preset", () => {
    expect(nearestPreset(1.24)).toBe(1.2)
    expect(nearestPreset(1.26)).toBe(1.3)
    expect(presetIndex(1)).toBe(9)
  })
})
