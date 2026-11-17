import { readSetting } from "./settings"
import { afterEach, expect, it, vi } from "vitest"
import { changeSaved, mediaUrl, SAVED_KEY } from "./saved"
afterEach(() => vi.unstubAllGlobals())
it("rejects malformed runtime payloads before accessing storage", async () => {
  const get = vi.fn()
  vi.stubGlobal("chrome", { storage: { local: { get } } })
  for (const data of [null, {}, { type: "saved:remove" }, { type: "saved:add", url: {} },
    { type: "saved:text", url: "https://example.com", text: [] },
    { type: "saved:add", url: "x".repeat(16385) },
    { type: "saved:text", url: "https://example.com", text: "x".repeat(65537) }]) {
    await expect(changeSaved(data as Parameters<typeof changeSaved>[0])).rejects.toThrow("Invalid saved item request")
  }
  expect(get).not.toHaveBeenCalled()
})
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

it("normalizes LinkedIn share links and rejects unrelated or unsafe URLs", () => {
  const expected = "https://www.linkedin.com/feed/update/urn:li:activity:123456789/"
  for (const url of [
    expected + "?utm_source=share#comments",
    "https://linkedin.com/posts/alex_some-topic-activity-123456789-Ab_c?utm_medium=member_desktop",
    "https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A123456789/",
  ]) expect(mediaUrl(url)).toBe(expected)
  expect(mediaUrl("https://linkedin.com/feed/update/urn:li:ugcPost:123/")).toBe("https://www.linkedin.com/feed/update/urn:li:ugcPost:123/")
  for (const url of [
    "https://linkedin.com/in/alex/", "https://linkedin.com/feed/",
    "https://linkedin.com.evil/feed/update/urn:li:activity:123/",
    "http://linkedin.com/feed/update/urn:li:activity:123/",
    "https://linkedin.com/feed/update/urn:li:activity:bad/",
    "https://linkedin.com/feed/update/%ZZ/",
  ]) expect(mediaUrl(url)).toBeNull()
})

it("creates collections and moves existing saves without losing their content", async () => {
  const values: Record<string, unknown> = {}
  vi.stubGlobal("chrome", { storage: { local: {
    get: async () => ({ ...values }),
    set: async (patch: object) => { Object.assign(values, patch) },
  } } })
  await changeSaved({ type: "saved:text", text: "Funny", url: "https://example.com" })
  const original = (values[SAVED_KEY] as { id: string }[])[0]
  expect(original).not.toHaveProperty("collection")
  await changeSaved({ type: "saved:collection", collection: " Work " })
  await changeSaved({ type: "saved:collection", collection: "Work" })
  expect(values.savedCollections).toEqual(["Work"])
  await changeSaved({ type: "saved:move", id: original.id, collection: "Work" })
  expect(values[SAVED_KEY]).toEqual([{ ...original, collection: "Work" }])
  await expect(changeSaved({ type: "saved:move", id: original.id, collection: "Missing" })).rejects.toThrow("Collection not found")
  await changeSaved({ type: "saved:move", id: original.id, collection: "" })
  expect(values[SAVED_KEY]).toEqual([{ ...original, collection: "" }])
  await expect(changeSaved({ type: "saved:collection", collection: " " })).rejects.toThrow()
  await expect(changeSaved({ type: "saved:move", collection: "Work" })).rejects.toThrow()
})

it("renames and deletes collections while preserving saved items", async () => {
  const item = { id: "a", kind: "text", text: "Keep me", url: "https://example.com", createdAt: 1, collection: "Work" }
  const other = { ...item, id: "b", collection: "Funny" }
  const values: Record<string, unknown> = { savedCollections: ["Work", "Funny"], savedItems: [item, other] }
  vi.stubGlobal("chrome", { storage: { local: {
    get: async () => ({ ...values }),
    set: async (patch: object) => { Object.assign(values, patch) },
  } } })
  await expect(changeSaved({ type: "saved:rename", collection: "Work", name: "Funny" })).rejects.toThrow("already exists")
  await expect(changeSaved({ type: "saved:rename", collection: "Work", name: " " })).rejects.toThrow("Invalid collection")
  await expect(changeSaved({ type: "saved:delete-collection", collection: "" })).rejects.toThrow("Invalid collection")
  await changeSaved({ type: "saved:rename", collection: "Work", name: " Office " })
  expect(values.savedCollections).toEqual(["Office", "Funny"])
  expect(values.savedItems).toEqual([{ ...item, collection: "Office" }, other])
  await changeSaved({ type: "saved:delete-collection", collection: "Office" })
  expect(values.savedCollections).toEqual(["Funny"])
  expect(values.savedItems).toEqual([{ ...item, collection: "" }, other])
  await expect(changeSaved({ type: "saved:delete-collection", collection: "Office" })).rejects.toThrow("not found")
})
