import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { vi } from "@/test/bun-test"
import { describe, expect, it } from "@/test/bun-test"
import { QUALITY_OPTIONS, QUALITY_LEVEL_MAP } from "./videoQuality"

describe("videoQuality resolution", () => {
  it("exports valid quality options and level mapping", () => {
    expect(QUALITY_OPTIONS.length).toBeGreaterThan(5)
    expect(QUALITY_LEVEL_MAP).toMatchObject({ hd1080: 1080, hd720: 720, hd2160: 2160 })
  })

  it.each([
    ["hd1080", ["highres", "hd1080", "hd720", "large", "auto"], "higher", "hd1080"],
    ["hd1080", ["highres", "hd1080", "hd720", "large", "auto"], "lower", "hd1080"],
    ["auto", ["hd1080", "hd720"], "higher", "auto"],
    ["auto", ["hd1080", "hd720"], "lower", "auto"],
    ["hd1080", ["hd720", "large", "medium", "small"], "lower", "hd720"],
    ["hd1080", ["hd720", "large", "medium", "small"], "higher", "hd720"],
    ["large", ["hd2160", "hd720", "medium"], "higher", "hd720"],
    ["large", ["hd2160", "hd720", "medium", "small"], "lower", "medium"],
    ["tiny", ["hd1080", "hd720"], "lower", "hd720"],
    ["hd2160", ["medium", "small"], "higher", "medium"],
    ["hd1080", [], "higher", null],
    ["hd1080", ["unknown_stream_format"], "lower", null],
  ] as const)("resolves %s from %j preferring %s to %s", async (target, available, fallback, expected) => {
    const player = { getAvailableQualityLevels: () => available, setPlaybackQuality: vi.fn() }
    const result = await runInNewContext(readFileSync(new URL("../../public/scripts/applyVideoQuality.js", import.meta.url), "utf8"), {
      window: { __zedVideoQualitySettings: { quality: target, fallback } },
      document: { getElementById: () => player, querySelectorAll: () => [] },
      setTimeout: vi.fn(), clearTimeout: vi.fn(),
    })
    expect(result).toBe(expected)
  })
})
