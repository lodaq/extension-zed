export const PLAYBACK_MIN = 0.1
export const PLAYBACK_MAX = 10

/** 0.1, 0.2, … 10.0 */
export const PLAYBACK_PRESETS = Object.freeze(
  Array.from({ length: 100 }, (_, i) => Number(((i + 1) / 10).toFixed(1)))
) as readonly number[]

export type PlaybackPreset = (typeof PLAYBACK_PRESETS)[number]

export function clampPlayback(rate: number): number {
  if (!Number.isFinite(rate)) return 1
  return Math.min(PLAYBACK_MAX, Math.max(PLAYBACK_MIN, rate))
}

export function nearestPreset(rate: number): PlaybackPreset {
  const c = clampPlayback(rate)
  const rounded = Math.round(c * 10) / 10
  const clamped = clampPlayback(rounded)
  return [...PLAYBACK_PRESETS].reduce((a, b) =>
    Math.abs(b - clamped) < Math.abs(a - clamped) ? b : a
  )
}

export function presetIndex(rate: number): number {
  const n = nearestPreset(rate)
  return PLAYBACK_PRESETS.indexOf(n)
}
