export { DOWNLOADER_ENABLED, downloadSize, validDownloadUrl } from "./downloader"
export const DOWNLOADER_STATE_KEY = "downloaderState"
export type DownloadFormat = { id: string; label: string; meta: string; size: number; approximate: boolean; tags: string[] }
export type DownloadMedia = { title: string; uploader: string; host: string; duration: number; video: DownloadFormat[]; audio: DownloadFormat[] }
export type DownloaderState = {
  phase: "checking" | "setup" | "ready" | "reading" | "updating" | "results" | "downloading" | "done" | "error"
  version?: string; ffmpeg?: boolean; url?: string; media?: DownloadMedia; error?: string
  pct?: number | null; downloaded?: number; total?: number; speed?: number; eta?: number; stage?: string
  filename?: string; size?: number; summary?: string; cancelled?: boolean; seen?: boolean
}
export const EMPTY_DOWNLOADER: DownloaderState = { phase: "setup" }

export function defaultDownloadFormat(formats: DownloadFormat[]) {
  return (formats.find(f => f.tags.includes("Most compatible")) ?? formats.find(f => f.tags.includes("Recommended")) ?? formats[0])?.id ?? ""
}

export async function downloaderCommand(command: string, data: Record<string, unknown> = {}) {
  const result = await chrome.runtime.sendMessage({ type: "advanced-downloader:command", command, ...data })
  if (!result?.ok) throw new Error(result?.error || "The downloader helper is unavailable")
  return result.state as DownloaderState
}
