import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "@/test/bun-test"
import { TimelineTrimmer } from "@/design-system/components"
import VideoDownloader from "./VideoDownloader"
import type { DownloadMedia, DownloaderState } from "@/lib/downloader"

const sampleMedia: DownloadMedia = {
  title: "How dark interfaces stay readable",
  uploader: "Design Notes",
  host: "youtube.com",
  duration: 768,
  isLive: false,
  video: [
    { id: "video:1080", label: "1080p", meta: "MP4 · H.264 · 30 fps", size: 214_000_000, approximate: false, bitrate: 4000, tags: ["Most compatible"] },
  ],
  audio: [
    { id: "audio:aac", label: "M4A · AAC", meta: "M4A · AAC · 128 kbps", size: 5_000_000, approximate: true, bitrate: 128, tags: ["Recommended"] },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TimelineTrimmer and merged VideoDownloader markup", () => {
  it("renders accessible timeline handles with expected positions and raised start handle when close", () => {
    const html = renderToStaticMarkup(
      createElement(TimelineTrimmer, { duration: 100, start: 49, end: 50, onChange: () => {} })
    )
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Clip range"')
    expect(html).toContain('aria-label="Clip start"')
    expect(html).toContain('aria-valuetext="0:49"')
    expect(html).toContain('aria-label="Clip end"')
    expect(html).toContain('aria-valuetext="0:50"')
    expect(html).toContain("zed-trim-range--raised")
    expect(html).toContain("0:00")
    expect(html).toContain("1:40")
  })

  it("renders Full video and Clip range controls on results, and disables Clip for live streams", () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: { get: async () => ({}), set: async () => {} },
        onChanged: { addListener: () => {}, removeListener: () => {} },
      },
    })
    const resultsHtml = renderToStaticMarkup(
      createElement(VideoDownloader, {
        state: { phase: "results", ffmpeg: true, capabilities: ["clip"], url: "https://youtube.com/watch?v=abc", media: sampleMedia },
      })
    )
    expect(resultsHtml).toContain("Full video")
    expect(resultsHtml).toContain("Clip")
    expect(resultsHtml).not.toContain("Live streams and videos with unknown duration")

    const liveHtml = renderToStaticMarkup(
      createElement(VideoDownloader, {
        state: { phase: "results", ffmpeg: true, url: "https://youtube.com/watch?v=live", media: { ...sampleMedia, isLive: true } },
      })
    )
    expect(liveHtml).toContain("Live streams and videos with unknown duration can’t be clipped.")
  })

  it("renders clip downloading and clip saved states cleanly", () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: { get: async () => ({}), set: async () => {} },
        onChanged: { addListener: () => {}, removeListener: () => {} },
      },
    })
    const downloadingState: DownloaderState = {
      phase: "downloading",
      ffmpeg: true,
      url: "https://youtube.com/watch?v=abc",
      media: sampleMedia,
      pct: 64,
      downloaded: 38_000_000,
      total: 59_000_000,
      speed: 3_200_000,
      eta: 7,
      stage: "Downloading clip…",
      summary: "1080p · MP4 · H.264 · 30 fps",
      section: { start: 65, end: 130 },
      precise: true,
    }
    const downloadingHtml = renderToStaticMarkup(createElement(VideoDownloader, { state: downloadingState }))
    expect(downloadingHtml).toContain("Clip 1:05–2:10")
    expect(downloadingHtml).toContain("Downloading clip…")
    expect(downloadingHtml).toContain("64%")

    const doneHtml = renderToStaticMarkup(
      createElement(VideoDownloader, {
        state: {
          ...downloadingState,
          phase: "done",
          pct: 100,
          filename: "How dark interfaces stay readable [1-05 to 2-10].mp4",
          size: 59_000_000,
          directory: "~/Downloads/Zed",
        },
      })
    )
    expect(doneHtml).toContain("Clip saved")
    expect(doneHtml).toContain("1:05 clip")
    expect(doneHtml).toContain("Show in folder")
    expect(doneHtml).toContain("Open file")
    expect(doneHtml).toContain("Clip another part")
    expect(doneHtml).toContain("New download")
  })
})
