import { isRestrictedPage } from "./withActiveTab"

export type YoutubeTabVideo = {
  url: string
  videoId: string
  title: string
  currentTime: number
  duration: number
  isLive: boolean
}

export function extractYoutubeVideoId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    const host = parsed.hostname.toLowerCase()
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0]
      return id || null
    }
    if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return null
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v") || null
    const match = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([^/?#]+)/)
    return match?.[1] || null
  } catch {
    return null
  }
}

export function isSameYoutubeVideo(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false
  const idA = extractYoutubeVideoId(a)
  const idB = extractYoutubeVideoId(b)
  return Boolean(idA && idB && idA === idB)
}

function readYoutubePlayerInPage(): Omit<YoutubeTabVideo, "videoId"> | null {
  const video = document.querySelector<HTMLVideoElement>("video.html5-main-video") ?? document.querySelector<HTMLVideoElement>("video")
  if (!video) return null
  const isLive = video.duration === Infinity || Boolean(document.querySelector(".html5-video-player .ytp-time-display.ytp-live"))
  const duration = Number.isFinite(video.duration) && video.duration > 0 ? Math.floor(video.duration) : 0
  const currentTime = Number.isFinite(video.currentTime) && video.currentTime >= 0 ? Math.floor(video.currentTime) : 0
  const heading = document.querySelector("ytd-watch-metadata h1 yt-formatted-string, #title h1 yt-formatted-string, h1.ytd-video-primary-info-renderer")?.textContent?.trim()
  const title = heading || document.title.replace(/\s*-\s*YouTube\s*$/, "").trim() || "YouTube video"
  return { url: location.href, title, currentTime, duration, isLive }
}

export async function readActiveYoutubeTab(): Promise<YoutubeTabVideo | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url || isRestrictedPage(tab.url)) return null
    const videoId = extractYoutubeVideoId(tab.url)
    if (!videoId) return null
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readYoutubePlayerInPage,
    })
    const result = results?.[0]?.result
    if (!result) return null
    const resolvedId = extractYoutubeVideoId(result.url) ?? videoId
    return { ...result, videoId: resolvedId }
  } catch {
    return null
  }
}
