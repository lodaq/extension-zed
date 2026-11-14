import { accountUsage, isSiteBlocked, LIMITER_KEY, localDay, matchesSite, midnight, siteHost, type SiteLimit } from "./siteLimiter"
const ALARM = "zed-site-limiter"
const SESSION = "siteLimiterCheckpoint"
const FIRST_ID = 700_000
// Serialize read/modify/write operations across tab, alarm and popup events.
let pending: Promise<unknown> = Promise.resolve()
export function updateSiteLimiter(input?: { url?: unknown; mode?: unknown; minutes?: unknown }) {
  const task = pending.then(async () => {
    const now = Date.now()
    const stored = await chrome.storage.local.get(LIMITER_KEY)
    const checkpoint = (await chrome.storage.session.get(SESSION))[SESSION] as { url: string; at: number } | undefined
    let rules = accountUsage((stored[LIMITER_KEY] ?? []) as SiteLimit[], checkpoint?.url ?? "", checkpoint?.at ?? now, now)
    if (input) {
      const host = siteHost(input.url)
      if (input.mode !== "block" && input.mode !== "daily") throw new Error("Choose a blocking mode")
      if (typeof input.minutes !== "number" || !Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > (input.mode === "daily" ? 1440 : 525600)) throw new Error("Enter a valid number of minutes (daily: 1–1440; block: 1–525600)")
      if (rules.some(rule => rule.host === host)) throw new Error("This website already has an active rule; it cannot be changed")
      if (rules.length >= 500) throw new Error("The maximum of 500 website rules has been reached")
      const ids = new Set(rules.map(rule => rule.id))
      let id = FIRST_ID
      while (ids.has(id)) id++
      rules.push({ id, host, mode: input.mode, minutes: input.minutes, until: now + input.minutes * 60_000, day: localDay(now), used: 0 })
    }
    await chrome.storage.local.set({ [LIMITER_KEY]: rules })
    const blocked = rules.filter(rule => isSiteBlocked(rule, now))
    const current = await chrome.declarativeNetRequest.getDynamicRules()
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: current.filter(rule => rule.id >= FIRST_ID && rule.id < FIRST_ID + 1000).map(rule => rule.id),
      addRules: blocked.map(rule => ({ id: rule.id, priority: 1, action: { type: "block" as chrome.declarativeNetRequest.RuleActionType }, condition: { requestDomains: [rule.host], resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType] } })),
    })
    const tabs = await chrome.tabs.query({})
    await Promise.all(tabs.filter(tab => tab.id !== undefined && blocked.some(rule => matchesSite(tab.url ?? "", rule.host))).map(async tab => {
      try { await chrome.tabs.update(tab.id!, { url: chrome.runtime.getURL("site-blocked.html") }) } catch { /* Tab may have closed. */ }
    }))
    const window = await chrome.windows.getLastFocused()
    const active = tabs.find(tab => tab.active && tab.windowId === window.id)
    const idle = await chrome.idle.queryState(60)
    const url = window.focused && idle === "active" && !blocked.some(rule => matchesSite(active?.url ?? "", rule.host)) ? active?.url ?? "" : ""
    await chrome.storage.session.set({ [SESSION]: { url, at: now } })
    if (!rules.length) {
      await chrome.alarms.clear(ALARM)
      return rules
    }
    let next = midnight(now)
    for (const rule of rules) {
      if (rule.mode === "block") next = Math.min(next, rule.until)
      else if (url && matchesSite(url, rule.host) && !isSiteBlocked(rule, now)) next = Math.min(next, now + Math.max(1, rule.minutes * 60_000 - rule.used))
    }
    await chrome.alarms.create(ALARM, { when: Math.max(now + 1000, Math.min(next, now + 30_000)) })
    return rules
  })
  pending = task.catch(() => {})
  return task
}
export function installSiteLimiter() {
  const refresh = () => { void updateSiteLimiter().catch(console.error) }
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) refresh() })
  chrome.tabs.onActivated.addListener(refresh)
  chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url || change.status === "complete") refresh() })
  chrome.tabs.onRemoved.addListener(refresh)
  chrome.windows.onFocusChanged.addListener(refresh)
  chrome.idle.onStateChanged.addListener(refresh)
  chrome.runtime.onStartup.addListener(refresh)
  chrome.runtime.onInstalled.addListener(refresh)
  refresh()
}
