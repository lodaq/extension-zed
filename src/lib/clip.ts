import { type DownloadFormat } from "./downloader"

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`
}

export function formatTimeForFile(seconds: number): string {
  return formatTime(seconds).replace(/:/g, "-")
}

export function parseTime(input: string): number | null {
  const value = input.trim()
  const parts = value.split(":")
  if (parts.length === 2) {
    const [mStr, sStr] = parts
    if (!/^\d+$/.test(mStr) || !/^[0-5]\d$/.test(sStr)) return null
    return Number(mStr) * 60 + Number(sStr)
  }
  if (parts.length === 3) {
    const [hStr, mStr, sStr] = parts
    if (!/^\d+$/.test(hStr) || !/^[0-5]\d$/.test(mStr) || !/^[0-5]\d$/.test(sStr)) return null
    return Number(hStr) * 3600 + Number(mStr) * 60 + Number(sStr)
  }
  return null
}

export function clampClipRange(start: number, end: number, duration: number): { start: number; end: number } {
  const max = Math.max(1, Math.floor(duration))
  const safeStart = Math.min(Math.max(0, Math.floor(start)), max - 1)
  const safeEnd = Math.min(Math.max(safeStart + 1, Math.floor(end)), max)
  return { start: safeStart, end: safeEnd }
}

export function defaultClipRange(duration: number, currentTime?: number | null): { start: number; end: number } {
  const max = Math.max(1, Math.floor(duration))
  const start = currentTime != null && Number.isFinite(currentTime)
    ? Math.min(Math.max(0, Math.floor(currentTime)), max - 1)
    : 0
  const end = Math.min(Math.max(start + 1, start + 60), max)
  return { start, end }
}

export function validateClipTimeInput(
  which: "start" | "end",
  text: string,
  start: number,
  end: number,
  duration: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const parsed = parseTime(text)
  if (parsed === null) {
    return { ok: false, error: "Use m:ss, for example 1:05." }
  }
  if (which === "start") {
    if (parsed >= end) return { ok: false, error: "Start must be before the end." }
    return { ok: true, value: parsed }
  }
  if (parsed <= start) return { ok: false, error: "End must be after the start." }
  if (parsed > Math.floor(duration)) return { ok: false, error: `End can’t be past ${formatTime(duration)}.` }
  return { ok: true, value: parsed }
}

export function trimmerPosition(value: number, duration: number): string {
  const ratio = duration > 0 ? Math.min(1, Math.max(0, value / duration)) : 0
  const pct = (ratio * 100).toFixed(4)
  const px = ((0.5 - ratio) * 16).toFixed(2)
  return `calc(${pct}% + ${px}px)`
}

export function estimateClipSize(format: DownloadFormat | undefined, clipSeconds: number, duration: number): number {
  if (!format || clipSeconds <= 0) return 0
  if (format.bitrate && format.bitrate > 0) {
    return Math.round((format.bitrate * 1000 / 8) * clipSeconds)
  }
  if (format.size > 0 && duration > 0) {
    return Math.round(format.size * (clipSeconds / duration))
  }
  return 0
}

export function defaultClipFilename(title: string, start: number, end: number): string {
  const suffix = ` [${formatTimeForFile(start)} to ${formatTimeForFile(end)}]`
  const baseTitle = (title.trim() || "Clip").slice(0, Math.max(1, 120 - suffix.length)).trimEnd()
  return `${baseTitle}${suffix}`
}
