import type { MiscSectionId } from "./settings"

export function moveMiscSection(order: readonly MiscSectionId[], from: number, to: number) {
  const next = [...order]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next
  const [section] = next.splice(from, 1)
  next.splice(to, 0, section)
  return next
}
