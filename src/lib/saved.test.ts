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
it("saves post permalinks without tracking or confusing profiles with posts", () => {
  expect(mediaUrl("https://instagram.com/p/Photo123/?igsh=tracking")).toBe("https://www.instagram.com/p/Photo123/")
  expect(mediaUrl("https://www.facebook.com/person/posts/pfbid123/?ref=feed")).toBe("https://www.facebook.com/person/posts/pfbid123/")
  expect(mediaUrl("https://facebook.com/groups/123/posts/456/?ref=feed")).toBe("https://www.facebook.com/groups/123/posts/456/")
  expect(mediaUrl("https://facebook.com/story.php?story_fbid=456&id=123&ref=feed")).toBe("https://www.facebook.com/permalink.php?story_fbid=456&id=123")
  expect(mediaUrl("https://facebook.com/share/p/ABC/?tracking=1")).toBe("https://www.facebook.com/share/p/ABC/")
  expect(mediaUrl("https://instagram.com/profile/")).toBeNull()
  expect(mediaUrl("https://facebook.com/profile.php?id=123")).toBeNull()
})

it("recognizes Facebook photo posts without saving their tracking parameters", () => {
  expect(mediaUrl("https://www.facebook.com/photo.php?fbid=123456&set=a.42&tracking=feed")).toBe("https://www.facebook.com/photo/?fbid=123456")
  expect(mediaUrl("https://facebook.com/photo/?fbid=123456")).toBe("https://www.facebook.com/photo/?fbid=123456")
  expect(mediaUrl("https://facebook.com/photo/?fbid=bad")).toBeNull()
})
it("normalizes group timestamp links and permanent post links to the same URL", () => {
  const expected = "https://www.facebook.com/groups/903875570211711/posts/2183355815597007/"
  expect(mediaUrl("https://www.facebook.com/groups/903875570211711/?multi_permalinks=2183355815597007&tracking=1")).toBe(expected)
  expect(mediaUrl("https://www.facebook.com/groups/903875570211711/permalink/2183355815597007/")).toBe(expected)
  expect(mediaUrl(expected)).toBe(expected)
  expect(mediaUrl("https://facebook.com/groups/123/?multi_permalinks=1,2")).toBeNull()
  expect(readSetting("savedButtonsEnabled", false, true)).toBe(false)
})
