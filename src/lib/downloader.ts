export const DOWNLOADER_ENABLED = import.meta.env.VITE_VIDEO_DOWNLOADER !== "false"
export const DOWNLOADER_STATE_KEY = "directDownloaderState"
export type MediaSource = { url: string; label: string }
export type DownloaderState = {
  phase: "ready" | "reading" | "downloading" | "done" | "error"
  url?: string; error?: string; sources?: MediaSource[]; downloadId?: number
  pct?: number | null; downloaded?: number; total?: number; filename?: string
  cancelled?: boolean; seen?: boolean
}
export const EMPTY_DOWNLOADER: DownloaderState = { phase: "ready" }

export function validDownloadUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return value.length <= 8192 && !Array.from(value).some(c => c.charCodeAt(0) < 32) && ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}

export function mediaExtension(value: string) {
  try { return new URL(value).pathname.match(/\.(mp4|webm|mov|m4v|ogv|mp3|m4a|aac|wav|ogg|opus|flac)$/i)?.[1].toLowerCase() }
  catch { return undefined }
}

export function mediaFilename(url: string, type: string) {
  const extensions: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/opus": "opus", "audio/flac": "flac" }
  const extension = mediaExtension(url) ?? extensions[type]
  if (!extension) throw new Error("This media file type is not supported.")
  let name = "media"
  try { name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "media") } catch { /* Use a safe name for malformed URL encoding. */ }
  name = name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N}_ -]/gu, "_").replace(/^[ .]+|[ .]+$/g, "").slice(0, 100) || "media"
  return `Zed/${name}.${extension}`
}

export function downloadSize(size?: number, approximate = false) {
  if (!size) return "Size unknown"
  const unit = size >= 1024 ** 3 ? "GB" : "MB"
  return `${approximate ? "~" : ""}${(size / (unit === "GB" ? 1024 ** 3 : 1024 ** 2)).toFixed(1)} ${unit}`
}

export async function downloaderCommand(command: string, data: Record<string, unknown> = {}) {
  const result = await chrome.runtime.sendMessage({ type: "downloader:command", command, ...data })
  if (!result?.ok) throw new Error(result?.error || "The download could not be completed")
  return result.state as DownloaderState
}

// This function is serialized into the active page; keep it self-contained.
export function findPageMedia() {
  const urls = new Set<string>()
  for (const element of document.querySelectorAll<HTMLMediaElement>("video, audio")) {
    if (element.mediaKeys) continue
    for (const source of [element.currentSrc, element.src, ...Array.from(element.querySelectorAll("source"), source => source.src)]) {
      if (source) urls.add(source)
    }
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (/\.(mp4|webm|mov|m4v|ogv|mp3|m4a|aac|wav|ogg|opus|flac)(?:[?#]|$)/i.test(link.href)) urls.add(link.href)
  }
  return [...urls].filter(url => /^https?:\/\//i.test(url)).slice(0, 100)
}

export function instagramReelCode(value: string) {
  const url = URL.parse(value)
  if (!url || !["https://www.instagram.com", "https://instagram.com"].includes(url.origin)) return
  return url.pathname.match(/^\/reels?\/([A-Za-z0-9_-]+)\/?$/)?.[1]
}

// Chrome serializes this function before running it in the matching Reel tab.
export function findInstagramReelMedia(origin: string, code: string) {
  if (location.origin !== origin || ![`/reel/${code}`, `/reels/${code}`].includes(location.pathname.replace(/\/$/, ""))) return

  const players = Array.from(document.querySelectorAll<HTMLVideoElement>("video")).filter(video => {
    const box = video.getBoundingClientRect()
    return box.width > 0 && box.height > 0 && box.left < innerWidth && box.right > 0 && box.top < innerHeight && box.bottom > 0
  })
  if (players.some(video => video.mediaKeys)) return

  function directFile(value: unknown) {
    if (typeof value !== "string") return
    const url = URL.parse(value)
    if (url?.protocol === "https:" && /\.mp4$/i.test(url.pathname) &&
        !url.searchParams.has("bytestart") && !url.searchParams.has("byteend")) return value
  }

  // shortcut: use only inline JSON with a matching shortcode, expand if Instagram changes its page data.
  for (const script of document.querySelectorAll('script[type="application/json"]')) {
    const text = script.textContent
    if (!text?.includes(code) || !text.includes('"video_versions"')) continue
    let pending: unknown[]
    try { pending = [JSON.parse(text)] } catch { continue }
    while (pending.length) {
      const value = pending.pop()
      if (!value || typeof value !== "object") continue
      const entry = value as Record<string, unknown>
      if ((entry.code === code || entry.shortcode === code) && Array.isArray(entry.video_versions)) {
        for (const version of entry.video_versions) {
          const url = directFile(version?.url)
          if (url) return url
        }
      }
      for (const child of Object.values(entry)) {
        if (child && typeof child === "object") pending.push(child)
      }
    }
  }

  if (players.length === 1) return directFile(players[0].currentSrc || players[0].src)
}
