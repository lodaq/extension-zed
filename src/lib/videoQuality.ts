export interface QualityOption {
  id: string
  label: string
  height: number
}

export const QUALITY_OPTIONS: QualityOption[] = [
  { id: "highres", label: "4320p (8K)", height: 4320 },
  { id: "hd2160", label: "2160p (4K)", height: 2160 },
  { id: "hd1440", label: "1440p (2K)", height: 1440 },
  { id: "hd1080", label: "1080p (HD)", height: 1080 },
  { id: "hd720", label: "720p", height: 720 },
  { id: "large", label: "480p", height: 480 },
  { id: "medium", label: "360p", height: 360 },
  { id: "small", label: "240p", height: 240 },
  { id: "tiny", label: "144p", height: 144 },
]

export const QUALITY_LEVEL_MAP: Record<string, number> = Object.fromEntries(
  QUALITY_OPTIONS.map((q) => [q.id, q.height])
)

export type VideoQualityFallback = "higher" | "lower"

export function resolveQuality(
  targetQuality: string,
  availableLevels: string[],
  fallback: VideoQualityFallback
): string {
  if (!availableLevels || availableLevels.length === 0) return targetQuality
  if (targetQuality === "auto") return "auto"
  if (availableLevels.includes(targetQuality)) return targetQuality

  const targetHeight = QUALITY_LEVEL_MAP[targetQuality]
  if (!targetHeight) return availableLevels[0] || targetQuality

  const validAvailable = availableLevels
    .filter((lvl) => Object.prototype.hasOwnProperty.call(QUALITY_LEVEL_MAP, lvl))
    .map((lvl) => ({ id: lvl, height: QUALITY_LEVEL_MAP[lvl] }))
    .sort((a, b) => a.height - b.height)

  if (validAvailable.length === 0) return availableLevels[0] || targetQuality

  if (fallback === "higher") {
    // Find smallest available level with height > targetHeight
    const higher = validAvailable.find((q) => q.height > targetHeight)
    if (higher) return higher.id
    // If none higher, pick the highest available level
    return validAvailable[validAvailable.length - 1].id
  } else {
    // fallback === "lower"
    // Find largest available level with height < targetHeight
    const lower = [...validAvailable].reverse().find((q) => q.height < targetHeight)
    if (lower) return lower.id
    // If none lower, pick the lowest available level
    return validAvailable[0].id
  }
}
