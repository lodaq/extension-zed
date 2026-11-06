import { describe, expect, it } from "vitest"
import { resolveQuality, QUALITY_OPTIONS, QUALITY_LEVEL_MAP } from "./videoQuality"

describe("videoQuality resolution", () => {
  it("exports valid quality options and level mapping", () => {
    expect(QUALITY_OPTIONS.length).toBeGreaterThan(5)
    expect(QUALITY_LEVEL_MAP.hd1080).toBe(1080)
    expect(QUALITY_LEVEL_MAP.hd720).toBe(720)
    expect(QUALITY_LEVEL_MAP.hd2160).toBe(2160)
  })

  it("returns target quality when directly available in video streams", () => {
    const available = ["highres", "hd1080", "hd720", "large", "auto"]
    expect(resolveQuality("hd1080", available, "higher")).toBe("hd1080")
    expect(resolveQuality("hd1080", available, "lower")).toBe("hd1080")
  })

  it("handles auto target quality", () => {
    const available = ["hd1080", "hd720"]
    expect(resolveQuality("auto", available, "higher")).toBe("auto")
    expect(resolveQuality("auto", available, "lower")).toBe("auto")
  })

  describe("when target quality does not exist", () => {
    const available = ["hd720", "large", "medium", "small"] // 720p, 480p, 360p, 240p

    it("prefers lower quality when target is 1080p and falls back to 720p", () => {
      // 1080p not available; lower options are 720, 480, 360, 240 -> chooses 720
      expect(resolveQuality("hd1080", available, "lower")).toBe("hd720")
    })

    it("prefers higher quality when target is 1080p and all available are lower", () => {
      // 1080p not available; nothing higher -> picks highest available (720)
      expect(resolveQuality("hd1080", available, "higher")).toBe("hd720")
    })

    it("prefers higher quality when target is 480p and available has 720p", () => {
      const streams = ["hd2160", "hd720", "medium"] // 4K, 720p, 360p
      // Target is large (480p). Higher options are 720p and 4K -> picks nearest higher (720p)
      expect(resolveQuality("large", streams, "higher")).toBe("hd720")
    })

    it("prefers lower quality when target is 480p and available has 360p", () => {
      const streams = ["hd2160", "hd720", "medium", "small"] // 4K, 720p, 360p, 240p
      // Target is large (480p). Lower options are 360p and 240p -> picks nearest lower (360p)
      expect(resolveQuality("large", streams, "lower")).toBe("medium")
    })

    it("handles target lower than all available when preferring lower quality", () => {
      const streams = ["hd1080", "hd720"] // only 1080p and 720p available
      // Target is tiny (144p). None lower -> picks lowest available (720p)
      expect(resolveQuality("tiny", streams, "lower")).toBe("hd720")
    })

    it("handles target higher than all available when preferring higher quality", () => {
      const streams = ["medium", "small"] // 360p, 240p
      // Target is 4K. None higher -> picks highest available (360p)
      expect(resolveQuality("hd2160", streams, "higher")).toBe("medium")
    })
  })

  it("handles empty or malformed available levels safely", () => {
    expect(resolveQuality("hd1080", [], "higher")).toBe("hd1080")
    expect(resolveQuality("hd1080", ["unknown_stream_format"], "lower")).toBe("unknown_stream_format")
  })
})
