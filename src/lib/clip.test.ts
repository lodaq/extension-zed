import { describe, expect, it } from "@/test/bun-test"
import {
  clampClipRange,
  defaultClipFilename,
  defaultClipRange,
  estimateClipSize,
  formatTime,
  formatTimeForFile,
  parseTime,
  trimmerPosition,
  validateClipTimeInput,
} from "./clip"
import { extractYoutubeVideoId, isSameYoutubeVideo } from "./youtubeTab"

describe("clip utilities", () => {
  it("formats and parses m:ss and h:mm:ss timestamps", () => {
    expect(formatTime(0)).toBe("0:00")
    expect(formatTime(65)).toBe("1:05")
    expect(formatTime(3661)).toBe("1:01:01")
    expect(formatTimeForFile(3661)).toBe("1-01-01")

    expect(parseTime("1:05")).toBe(65)
    expect(parseTime("12:00")).toBe(720)
    expect(parseTime("1:01:01")).toBe(3661)
    expect(parseTime("1:65")).toBeNull()
    expect(parseTime("abc")).toBeNull()
    expect(parseTime("10")).toBeNull()
  })

  it("clamps ranges to at least 1 second within duration", () => {
    expect(clampClipRange(-5, 999, 120)).toEqual({ start: 0, end: 120 })
    expect(clampClipRange(119, 119, 120)).toEqual({ start: 119, end: 120 })
    expect(clampClipRange(130, 140, 120)).toEqual({ start: 119, end: 120 })
    expect(defaultClipRange(120)).toEqual({ start: 0, end: 60 })
    expect(defaultClipRange(120, 95)).toEqual({ start: 95, end: 120 })
    expect(defaultClipRange(45, null)).toEqual({ start: 0, end: 45 })
  })

  it("validates typed clip boundaries with exact messages", () => {
    expect(validateClipTimeInput("start", "bad", 10, 60, 120)).toEqual({ ok: false, error: "Use m:ss, for example 1:05." })
    expect(validateClipTimeInput("start", "1:00", 10, 60, 120)).toEqual({ ok: false, error: "Start must be before the end." })
    expect(validateClipTimeInput("end", "0:10", 10, 60, 120)).toEqual({ ok: false, error: "End must be after the start." })
    expect(validateClipTimeInput("end", "2:30", 10, 60, 120)).toEqual({ ok: false, error: "End can’t be past 2:00." })
    expect(validateClipTimeInput("end", "1:30", 10, 60, 120)).toEqual({ ok: true, value: 90 })
  })

  it("computes trimmer handle positions at 0%, 50%, and 100%", () => {
    expect(trimmerPosition(0, 100)).toBe("calc(0.0000% + 8.00px)")
    expect(trimmerPosition(50, 100)).toBe("calc(50.0000% + 0.00px)")
    expect(trimmerPosition(100, 100)).toBe("calc(100.0000% + -8.00px)")
  })

  it("estimates clip sizes from bitrate or full size and builds safe filenames", () => {
    const withBitrate = { id: "video:1080", label: "1080p", meta: "MP4", size: 200_000_000, approximate: false, tags: [], bitrate: 4000 }
    expect(estimateClipSize(withBitrate, 30, 100)).toBe(15_000_000)
    const withoutBitrate = { id: "video:720", label: "720p", meta: "MP4", size: 100_000_000, approximate: false, tags: [] }
    expect(estimateClipSize(withoutBitrate, 25, 100)).toBe(25_000_000)

    const longTitle = "A".repeat(120)
    const name = defaultClipFilename(longTitle, 65, 130)
    expect(name.endsWith(" [1-05 to 2-10]")).toBe(true)
    expect(name.length).toBeLessThanOrEqual(120)
  })

  it("extracts and matches YouTube video IDs across URL formats", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ")
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    expect(extractYoutubeVideoId("https://www.youtube.com/shorts/abc123")).toBe("abc123")
    expect(extractYoutubeVideoId("https://example.com/watch?v=abc")).toBeNull()
    expect(isSameYoutubeVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s", "https://youtu.be/dQw4w9WgXcQ")).toBe(true)
    expect(isSameYoutubeVideo("https://www.youtube.com/watch?v=aaa", "https://www.youtube.com/watch?v=bbb")).toBe(false)
  })
})
