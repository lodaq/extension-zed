import { afterEach, describe, expect, it, vi } from "vitest"
import { generatePassword, type PasswordOptions } from "./passwordGenerator"

const options: PasswordOptions = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true }
afterEach(() => vi.unstubAllGlobals())

describe("password generator", () => {
  it("uses the requested length and includes every selected character type", () => {
    for (const length of [4, 20, 38, 128]) {
      const password = generatePassword({ ...options, length })
      expect(password).toHaveLength(length)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[^A-Za-z0-9]/)
      expect(password).not.toMatch(/\s/)
    }
  })

  it.each([
    ["uppercase", /^[A-Z]+$/],
    ["lowercase", /^[a-z]+$/],
    ["numbers", /^[0-9]+$/],
    ["symbols", /^[^A-Za-z0-9\s]+$/],
  ] as const)("supports %s alone and excludes disabled types", (category, pattern) => {
    const selected = { length: 128, uppercase: false, lowercase: false, numbers: false, symbols: false, [category]: true }
    expect(generatePassword(selected)).toMatch(pattern)
  })

  it("rejects an empty character selection", () => {
    expect(() => generatePassword({ length: 20, uppercase: false, lowercase: false, numbers: false, symbols: false })).toThrow("Select at least one character type")
  })

  it.each([0, 3, 129, 4.5, Number.NaN, Infinity])("rejects invalid length %s", (length) => {
    expect(() => generatePassword({ ...options, length })).toThrow()
  })

  it("rejects biased random samples instead of applying modulo directly", () => {
    const samples = [0xffffffff, 1]
    const random = vi.fn((array: Uint32Array) => {
      array[0] = samples.shift() ?? 0
      return array
    })
    vi.stubGlobal("crypto", { getRandomValues: random })
    const password = generatePassword({ length: 4, uppercase: true, lowercase: false, numbers: false, symbols: false })
    expect(password).toContain("B")
    expect(random).toHaveBeenCalledTimes(8)
  })
})
