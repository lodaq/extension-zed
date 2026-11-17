import { describe, expect, it } from "vitest"
import { hintLabels } from "./clickHints"

describe("click hint labels", () => {
  it.each([0, 1, 26, 27, 1000])("gives every one of %i targets a unique unambiguous label", count => {
    const labels = hintLabels(count)
    expect(labels).toHaveLength(count)
    expect(new Set(labels).size).toBe(count)
    expect(new Set(labels.map(label => label.length)).size).toBe(count ? 1 : 0)
    expect(labels.every(label => /^[a-z]+$/.test(label))).toBe(true)
  })
})
