import { describe, expect, it } from "vitest"
import { accountUsage, isSiteBlocked, localDay, matchesSite, midnight, siteHost, type SiteLimit } from "./siteLimiter"
import { importSettings, resetSettings } from "./settings"
import { afterEach, vi } from "vitest"
const now = new Date(2026, 10, 14, 12).getTime()
const daily: SiteLimit = { id: 700000, host: "example.com", mode: "daily", minutes: 1, until: 0, day: localDay(now), used: 0 }
afterEach(() => vi.unstubAllGlobals())
describe("website limits", () => {
  it("normalizes URLs and rejects credentials and non-web schemes", () => {
    expect(siteHost("https://WWW.Example.com/path?q=1")).toBe("example.com")
    expect(siteHost("example.com")).toBe("example.com")
    for (const url of ["file:///tmp/test", "chrome://extensions", "https://user:pass@example.com", ""]) expect(() => siteHost(url)).toThrow()
  })
  it("matches only exact domains and their subdomains", () => {
    expect(matchesSite("https://a.example.com/x", "example.com")).toBe(true)
    expect(matchesSite("http://example.com:8080/", "example.com")).toBe(true)
    expect(matchesSite("https://example.com.attacker.com", "example.com")).toBe(false)
    expect(matchesSite("https://notexample.com", "example.com")).toBe(false)
  })
  it("accumulates usage, caps at the allowance and unlocks timed rules only at expiry", () => {
    const [first] = accountUsage([daily], "https://example.com", now - 30000, now)
    expect(first.used).toBe(30000)
    const [second] = accountUsage([first], "https://example.com", now, now + 40000)
    expect(second.used).toBe(60000)
    expect(isSiteBlocked(second, now + 40000)).toBe(true)
    const block = { ...daily, mode: "block" as const, until: now + 1000 }
    expect(isSiteBlocked(block, now)).toBe(true)
    expect(isSiteBlocked(block, now + 1000)).toBe(false)
    expect(accountUsage([block], "", now, now + 1000)).toEqual([])
  })
  it("does not charge background URLs or long sleeping gaps", () => {
    expect(accountUsage([daily], "https://other.com", now - 10000, now)[0].used).toBe(0)
    expect(accountUsage([{ ...daily, minutes: 10 }], "https://example.com", now - 3600000, now)[0].used).toBe(60000)
  })
  it("resets at local midnight and counts only the new day's portion", () => {
    const next = midnight(now)
    const [rule] = accountUsage([{ ...daily, used: 60000 }], "https://example.com", next - 10000, next + 10000)
    expect(rule.used).toBe(10000)
    expect(rule.day).toBe(localDay(next))
    expect(isSiteBlocked(rule, next + 10000)).toBe(false)
  })
  it("keeps limiter state outside settings reset and import", async () => {
    const stored: Record<string, unknown> = { siteLimiterV1: [daily], speed: "2" }
    vi.stubGlobal("chrome", { storage: { local: {
      get: async () => stored,
      remove: async (keys: string[]) => keys.forEach(key => delete stored[key]),
      set: async (values: object) => Object.assign(stored, values),
    } } })
    await resetSettings()
    await importSettings({ version: 1, settings: { siteLimiterV1: [] } })
    expect(stored.siteLimiterV1).toEqual([daily])
  })
})
