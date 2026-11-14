import { expect, it } from "vitest"
import { findMediaTargets } from "./mediaTargets"

it("binds each media card to its own URL and deduplicates title/thumbnail links", () => {
  const first = {} as HTMLElement
  const second = {} as HTMLElement
  const short = {} as HTMLElement
  const link = (href: string, target: Element) => ({ href, closest: () => target })
  const anchors = [
    link("https://instagram.com/reel/First/", first),
    link("https://instagram.com/reel/First/?tracking=1", first),
    link("https://facebook.com/reel/123/", second),
    link("https://youtube.com/shorts/abc", short),
  ]
  const root = { querySelectorAll: (selector: string) => selector === "video" ? [] : selector.startsWith("a[") ? anchors : [] } as unknown as Document
  expect([...findMediaTargets(root, "https://instagram.com/")]).toEqual([
    [first, "https://www.instagram.com/reel/First/"],
    [second, "https://www.facebook.com/reel/123/"],
    [short, "https://www.youtube.com/watch?v=abc"],
  ])
})

it("does not assign the address-bar URL to unidentified videos in a feed", () => {
  const video = () => ({ closest: () => null, parentElement: null })
  const root = { querySelectorAll: (selector: string) => selector === "video" ? [video(), video()] : [] } as unknown as Document
  expect(findMediaTargets(root, "https://instagram.com/reel/Current/").size).toBe(0)
})

it("uses the active reel permalink despite hidden preloaded videos", () => {
  const visibleTarget = {} as HTMLElement
  const hiddenTarget = {} as HTMLElement
  const video = (target: HTMLElement, hidden: boolean) => ({
    parentElement: target,
    closest: (selector: string) => selector.startsWith("[hidden]") && hidden ? {} : null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 400, bottom: 700 }),
  })
  Object.assign(visibleTarget, { querySelectorAll: () => [], parentElement: null })
  Object.assign(hiddenTarget, { querySelectorAll: () => [], parentElement: null })
  const visible = video(visibleTarget, false)
  const hidden = video(hiddenTarget, true)
  const root = {
    querySelectorAll: (selector: string) => selector === "video" ? [hidden, visible] : [],
    defaultView: { innerWidth: 1280, innerHeight: 800, getComputedStyle: () => ({ visibility: "visible", display: "block" }) },
  } as unknown as Document
  expect([...findMediaTargets(root, "https://www.facebook.com/reel/2186094161976689")]).toEqual([
    [visibleTarget, "https://www.facebook.com/reel/2186094161976689/"],
  ])
})

it("keeps a save control on Facebook feed cards before a permalink is available", () => {
  const card = { parentElement: null, contains: () => false } as unknown as HTMLElement
  const root = { querySelectorAll: (selector: string) => selector.startsWith("article,") ? [card] : [] } as unknown as Document
  expect([...findMediaTargets(root, "https://www.facebook.com/")]).toEqual([[card, null]])
})

it("does not put post save controls on Facebook comment articles", () => {
  const post = {} as HTMLElement
  const comment = {} as HTMLElement
  const anchors = [
    { href: "https://facebook.com/CBCEgypt/posts/pfbid123/", closest: () => post },
    { href: "https://facebook.com/CBCEgypt/posts/pfbid123/?comment_id=42", closest: () => comment },
  ]
  const root = { querySelectorAll: (selector: string) => selector.startsWith("a[") ? anchors : [] } as unknown as Document
  expect([...findMediaTargets(root, "https://www.facebook.com/")]).toEqual([
    [post, "https://www.facebook.com/CBCEgypt/posts/pfbid123/"],
  ])
})

it("recognizes the timestamp format used by Facebook group feed posts", () => {
  const card = {} as HTMLElement
  const anchors = [{ href: "https://facebook.com/groups/903875570211711/?multi_permalinks=2183355815597007", closest: () => card }]
  const root = { querySelectorAll: (selector: string) => selector.startsWith("a[") ? anchors : [] } as unknown as Document
  expect([...findMediaTargets(root, "https://www.facebook.com/")]).toEqual([
    [card, "https://www.facebook.com/groups/903875570211711/posts/2183355815597007/"],
  ])
})

it("attaches to Facebook timestamps without relying on post wrappers", () => {
  const first = {} as HTMLElement
  const second = {} as HTMLElement
  const anchors = [
    { href: "https://facebook.com/person/posts/123/", textContent: "5 hours ago", closest: () => null, parentElement: first },
    { href: "https://facebook.com/#", textContent: "A few seconds ago", closest: () => null, parentElement: second },
    { href: "https://facebook.com/photo/?fbid=456", textContent: "", closest: () => null, parentElement: {} },
  ]
  const root = { querySelectorAll: (selector: string) => selector === "a[href]" ? anchors : [] } as unknown as Document
  expect([...findMediaTargets(root, "https://www.facebook.com/")]).toEqual([
    [first, "https://www.facebook.com/person/posts/123/"],
    [second, null],
  ])
})
