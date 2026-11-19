import { afterEach, describe, expect, it, vi } from "@/test/bun-test"
import { findInstagramReelMedia, instagramReelCode, mediaExtension, mediaFilename, validDownloadUrl } from "./downloader"

describe("direct media links", () => {
  it("accepts HTTP(S) and rejects credentials, control characters and browser-only URLs", () => {
    expect(validDownloadUrl("https://example.test/a.mp4?token=abc")).toBe(true)
    for (const url of ["https://user:pass@example.test/a.mp4", "https://exa\nmple.test/a.mp4", "blob:https://example.test/id", "file:///a.mp4"]) {
      expect(validDownloadUrl(url)).toBe(false)
    }
  })

  it("keeps filenames inside Zed and recognizes direct media despite query strings", () => {
    expect(mediaExtension("https://example.test/a.MP4?token=abc")).toBe("mp4")
    expect(mediaFilename("https://example.test/x%2Fdemo", "audio/mpeg")).toBe("Zed/x_demo.mp3")
    expect(() => mediaFilename("https://example.test/watch", "text/html")).toThrow()
  })
})

describe("Instagram Reel links", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("matches the copied link and browser URL by Reel code", () => {
    expect(instagramReelCode("https://www.instagram.com/reel/DfzcZNYgZ3s/?share=1")).toBe("DfzcZNYgZ3s")
    expect(instagramReelCode("https://www.instagram.com/reels/DfzcZNYgZ3s/")).toBe("DfzcZNYgZ3s")
    expect(instagramReelCode("https://www.instagram.com.example.test/reel/DfzcZNYgZ3s/")).toBeUndefined()
  })

  it("uses the matching Reel's full file even when several Reels are in the page data", () => {
    vi.stubGlobal("location", new URL("https://www.instagram.com/reels/target/"))
    const full = "https://cdn.example.test/target.mp4?signature=123"
    const entries = [
      { code: "target", video_versions: [{ url: full + "&bytestart=0&byteend=123" }, { url: full }] },
      { code: "neighbor", video_versions: [{ url: "https://cdn.example.test/neighbor.mp4" }] },
    ]
    vi.stubGlobal("document", {
      querySelectorAll: (selector: string) => selector === "video" ? [] : [{ textContent: JSON.stringify(entries) }],
    })
    expect(findInstagramReelMedia("https://www.instagram.com", "target")).toBe(full)
    expect(findInstagramReelMedia("https://www.instagram.com", "neighbor")).toBeUndefined()
  })
})
