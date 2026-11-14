import { isSiteBlocked, matchesSite, type SiteLimit } from "./siteLimiter"

export const SYSTEM_LIMITER_VIEW = "systemSiteLimiterView"
export const SYSTEM_LIMITER_ALARM = "zed-system-site-limiter"
const HOST = "com.extension_zed.limiter"
const FIRST_RULE = 710_000
export type SystemSiteLimit = SiteLimit & { locked?: boolean; system: true }
type Response = { ok: boolean; rules?: SystemSiteLimit[]; error?: string }
let pending: Promise<unknown> = Promise.resolve()

export function systemSiteLimiter(action: "status" | "add" | "report", input: { url?: unknown; mode?: unknown; minutes?: unknown } = {}) {
  const task = pending.then(async () => {
    // Unpacked or ordinary installs cannot provide mandatory foreground tracking.
    const self = await chrome.management.getSelf()
    if (self.installType !== "admin") throw new Error("Administrator setup required. Ask your administrator to install the mandatory Zed browser component and companion service.")
    const response: Response = await chrome.runtime.sendNativeMessage(HOST, { ...input, action })
    if (!response?.ok || !Array.isArray(response.rules)) throw new Error(response?.error || "Administrator service is unavailable")
    const rules = response.rules.map(rule => ({ ...rule, system: true as const }))
    const now = Date.now()
    const current = await chrome.declarativeNetRequest.getDynamicRules()
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: current.filter(rule => rule.id >= FIRST_RULE && rule.id < FIRST_RULE + 1000).map(rule => rule.id),
      addRules: rules.flatMap((rule, index) => isSiteBlocked(rule, now) || rule.locked ? [{
        id: FIRST_RULE + index, priority: 1,
        action: { type: "block" as chrome.declarativeNetRequest.RuleActionType },
        condition: { requestDomains: [rule.host], resourceTypes: ["main_frame" as chrome.declarativeNetRequest.ResourceType] },
      }] : []),
    })
    await chrome.storage.local.set({ [SYSTEM_LIMITER_VIEW]: rules })
    const blocked = rules.filter(rule => isSiteBlocked(rule, now) || rule.locked)
    if (blocked.length) {
      const tabs = await chrome.tabs.query({})
      await Promise.all(tabs.filter(tab => tab.id !== undefined && blocked.some(rule => matchesSite(tab.url ?? "", rule.host))).map(async tab => {
        try { await chrome.tabs.update(tab.id!, { url: chrome.runtime.getURL("site-blocked.html") }) } catch { /* Tab closed. */ }
      }))
    }
    if (rules.length) await chrome.alarms.create(SYSTEM_LIMITER_ALARM, { when: now + 30_000 })
    else await chrome.alarms.clear(SYSTEM_LIMITER_ALARM)
    return rules
  })
  pending = task.catch(() => {})
  return task
}

export async function reportSystemForeground() {
  const window = await chrome.windows.getLastFocused()
  const [tab] = window.focused ? await chrome.tabs.query({ active: true, windowId: window.id }) : []
  const idle = await chrome.idle.queryState(60)
  return systemSiteLimiter("report", { url: window.focused && idle === "active" ? tab?.url ?? "" : "" })
}

export function installSystemSiteLimiter() {
  // Probe once per worker start; unavailable services never downgrade existing rules.
  const refresh = () => { void reportSystemForeground().catch(() => {}) }
  chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === SYSTEM_LIMITER_ALARM) refresh() })
  chrome.tabs.onActivated.addListener(refresh)
  chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url) refresh() })
  chrome.windows.onFocusChanged.addListener(refresh)
  chrome.idle.onStateChanged.addListener(refresh)
  refresh()
}
