import { describe, expect, it } from "vitest"
import { PLAYBACK_MAX, PLAYBACK_MIN, clampPlayback, nearestPreset, stepPlayback } from "./playbackPresets"

describe("playback presets", () => {
  it("clamps invalid and out-of-range rates", () => {
    expect(clampPlayback(Number.NaN)).toBe(1)
    expect(clampPlayback(0)).toBe(PLAYBACK_MIN)
    expect(clampPlayback(99)).toBe(PLAYBACK_MAX)
  })

  it("rounds rates to the nearest 0.1× preset", () => {
    expect(nearestPreset(1.24)).toBe(1.2)
    expect(nearestPreset(1.26)).toBe(1.3)
  })
})

it("steps every preset in both directions without floating-point drift", () => {
  for (let index = 1; index <= 100; index++) {
    expect(stepPlayback(index / 10, 1)).toBe(Math.min(100, index + 1) / 10)
    expect(stepPlayback(index / 10, -1)).toBe(Math.max(1, index - 1) / 10)
  }
})
