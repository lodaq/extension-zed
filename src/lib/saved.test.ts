import { readSetting } from "./settings"
import { afterEach, expect, it, vi } from "vitest"
import { changeSaved, mediaUrl, SAVED_KEY } from "./saved"
afterEach(() => vi.unstubAllGlobals())
it("recognizes supported media and strips tracking", () => {
  expect(mediaUrl("https://www.instagram.com/reels/ABC-12/?igsh=x")).toBe("https://www.instagram.com/reel/ABC-12/")
  expect(mediaUrl("https://m.facebook.com/reel/123/?x=1")).toBe("https://www.facebook.com/reel/123/")
  expect(mediaUrl("https://www.youtube.com/watch?v=abc-123&t=9")).toBe("https://www.youtube.com/watch?v=abc-123")
  expect(mediaUrl("https://youtube.com/shorts/abc")).toBe("https://www.youtube.com/watch?v=abc")
  for (const url of ["https://instagram.com/", "https://facebook.com/reels/", "https://youtube.com.evil/watch?v=x", "javascript:alert(1)"]) expect(mediaUrl(url)).toBeNull()
})
it("serializes concurrent saves, deduplicates, and removes", async () => {
  const values: Record<string, unknown> = {}
  vi.stubGlobal("chrome", { storage: { local: {
    get: async () => ({ ...values }),
    set: async (patch: object) => { Object.assign(values, patch) },
  } } })
  await Promise.all([
    changeSaved({ type: "saved:add", url: "https://youtube.com/watch?v=a" }),
    changeSaved({ type: "saved:add", url: "https://youtube.com/watch?v=a&t=1" }),
    changeSaved({ type: "saved:text", text: "Selected text", url: "https://example.com" }),
  ])
  const items = values[SAVED_KEY] as { id: string }[]
  expect(items).toHaveLength(2)
  expect(readSetting(SAVED_KEY, values[SAVED_KEY], [])).toEqual(items)
  expect(readSetting(SAVED_KEY, [{ url: "javascript:alert(1)" }], [])).toEqual([])
  await changeSaved({ type: "saved:remove", id: items[0].id })
  expect(values[SAVED_KEY]).toHaveLength(1)
  await expect(changeSaved({ type: "saved:add", url: "https://example.com" })).rejects.toThrow()
})
