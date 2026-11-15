export const PLAYBACK_MIN = 0.1
export const PLAYBACK_MAX = 10

export function clampPlayback(rate: number): number {
  if (!Number.isFinite(rate)) return 1
  return Math.min(PLAYBACK_MAX, Math.max(PLAYBACK_MIN, rate))
}

export function nearestPreset(rate: number): number {
  return clampPlayback(Math.round(clampPlayback(rate) * 10) / 10)
}

export function stepPlayback(rate: number, delta: -1 | 1): number {
  return nearestPreset(nearestPreset(rate) + delta / 10)
}
