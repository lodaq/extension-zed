export const LIMITER_KEY = "siteLimiterV1"
export type SiteLimit = { id: number; host: string; mode: "block" | "daily"; minutes: number; until: number; day: string; used: number }
export function siteHost(input: unknown): string {
  if (typeof input !== "string" || !input.trim() || input.length > 2048) throw new Error("Enter a website URL")
  const url = new URL(input.includes("://") ? input.trim() : `https://${input.trim()}`)
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error("Use an HTTP or HTTPS website URL without credentials")
  return url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "")
}
export function matchesSite(url: string, host: string): boolean {
  try { const candidate = new URL(url); return ["http:", "https:"].includes(candidate.protocol) && (candidate.hostname.replace(/\.$/, "") === host || candidate.hostname.replace(/\.$/, "").endsWith(`.${host}`)) } catch { return false }
}
export function localDay(now: number): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
export function midnight(now: number): number {
  const date = new Date(now)
  date.setHours(24, 0, 0, 0)
  return date.getTime()
}
export function isSiteBlocked(rule: SiteLimit, now: number): boolean {
  return rule.mode === "block" ? now < rule.until : rule.day === localDay(now) && rule.used >= rule.minutes * 60_000
}
export function accountUsage(rules: SiteLimit[], url: string, from: number, now: number): SiteLimit[] {
  return rules.filter(rule => rule.mode === "daily" || rule.until > now).map(rule => {
    if (rule.mode !== "daily") return rule
    const day = localDay(now)
    // A sleeping machine or a stopped worker must not accrue hours of phantom usage.
    const start = Math.max(from, now - 60_000, new Date(new Date(now).setHours(0, 0, 0, 0)).getTime())
    return { ...rule, day, used: Math.min(rule.minutes * 60_000, (rule.day === day ? rule.used : 0) + (matchesSite(url, rule.host) ? Math.max(0, now - start) : 0)) }
  })
}
