export const DOWNLOADER_ENABLED = import.meta.env.VITE_VIDEO_DOWNLOADER !== "false"
export const DOWNLOADER_STATE_KEY = "downloaderState"
export const DEFAULT_DOWNLOAD_DIRECTORY = "~/Downloads/Zed"
export type DownloadFormat = { id: string; label: string; meta: string; size: number; approximate: boolean; tags: string[] }
export type DownloadMedia = { title: string; uploader: string; host: string; duration: number; video: DownloadFormat[]; audio: DownloadFormat[] }
export type DownloaderState = {
  phase: "checking" | "setup" | "ready" | "reading" | "updating" | "results" | "downloading" | "done" | "error"
  version?: string; ffmpeg?: boolean; url?: string; media?: DownloadMedia; error?: string; directory?: string
  pct?: number | null; downloaded?: number; total?: number; speed?: number; eta?: number; stage?: string
  filename?: string; size?: number; summary?: string; cancelled?: boolean; seen?: boolean
}
export const EMPTY_DOWNLOADER: DownloaderState = { phase: "setup" }

export function validDownloadUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return value.length <= 8192 && !Array.from(value).some(c => c.charCodeAt(0) < 32) && ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password
  } catch { return false }
}

export function validDownloadName(value: string) {
  return value.length <= 120 && !Array.from(value).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
}

export function validDownloadDirectory(value: string) {
  const directory = value.trim()
  if (!directory || directory.length > 4096) return false
  if (Array.from(directory).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return false
  return directory === "~" ||
    /^~[\\/]/.test(directory) ||
    /^[\\/]/.test(directory) ||
    /^[A-Za-z]:[\\/]/.test(directory) ||
    /^\\\\[^\\]+\\/.test(directory)
}

export function defaultDownloadFormat(formats: DownloadFormat[]) {
  return (formats.find(f => f.tags.includes("Most compatible")) ?? formats.find(f => f.tags.includes("Recommended")) ?? formats[0])?.id ?? ""
}

export function downloadSize(size?: number, approximate = false) {
  if (!size) return "Size unknown"
  const unit = size >= 1024 ** 3 ? "GB" : "MB"
  return `${approximate ? "~" : ""}${(size / (unit === "GB" ? 1024 ** 3 : 1024 ** 2)).toFixed(1)} ${unit}`
}

export async function downloaderCommand(command: string, data: Record<string, unknown> = {}) {
  const result = await chrome.runtime.sendMessage({ type: "downloader:command", command, ...data })
  if (!result?.ok) throw new Error(result?.error || "The downloader helper is unavailable")
  return result.state as DownloaderState
}
