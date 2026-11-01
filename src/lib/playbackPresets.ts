export const PLAYBACK_MIN = 0.1
export const PLAYBACK_MAX = 10

export const PLAYBACK_PRESETS = Object.freeze(
  Array.from({ length: 100 }, (_, i) => Number(((i + 1) / 10).toFixed(1)))
) as readonly number[]

export type PlaybackPreset = (typeof PLAYBACK_PRESETS)[number]

export function clampPlayback(rate: number): number {
  if (!Number.isFinite(rate)) return 1
  return Math.min(PLAYBACK_MAX, Math.max(PLAYBACK_MIN, rate))
}

export function nearestPreset(rate: number): PlaybackPreset {
  return clampPlayback(Math.round(clampPlayback(rate) * 10) / 10)
}

export function presetIndex(rate: number): number {
  const n = nearestPreset(rate)
  return PLAYBACK_PRESETS.indexOf(n)
}

export function stepPlayback(rate: number, delta: -1 | 1): number {
  return PLAYBACK_PRESETS[Math.min(PLAYBACK_PRESETS.length - 1, Math.max(0, presetIndex(rate) + delta))]
}
