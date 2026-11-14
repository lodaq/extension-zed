import { afterEach, expect, it, vi } from "vitest"
import { LIMITER_KEY } from "./siteLimiter"
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
it("persists locked rules, installs domain blocks, closes open pages, rejects replacement and expires automatically", async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  const local: Record<string, unknown> = {}
  const session: Record<string, unknown> = {}
  let dynamic: { id: number }[] = [{ id: 1 }]
  const updateRules = vi.fn(async (input: { removeRuleIds: number[]; addRules: { id: number }[] }) => {
    dynamic = [...dynamic.filter(rule => !input.removeRuleIds.includes(rule.id)), ...input.addRules]
  })
  const updateTab = vi.fn(async () => {})
  const alarms = { create: vi.fn(async () => {}), clear: vi.fn(async () => {}) }
  const area = (values: Record<string, unknown>) => ({ get: async () => ({ ...values }), set: async (patch: object) => Object.assign(values, patch) })
  vi.stubGlobal("chrome", {
    storage: { local: area(local), session: area(session) },
    declarativeNetRequest: { getDynamicRules: async () => dynamic, updateDynamicRules: updateRules },
    tabs: { query: async () => [{ id: 2, url: "https://sub.example.com", active: true, windowId: 1 }], update: updateTab },
    windows: { getLastFocused: async () => ({ id: 1, focused: true }) },
    idle: { queryState: async () => "active" },
    runtime: { getURL: (path: string) => `chrome-extension://zed/${path}` },
    alarms,
  })
  const { updateSiteLimiter } = await import("./siteLimiterWorker")
  await updateSiteLimiter({ url: "example.com", mode: "block", minutes: 1 })
  expect(local[LIMITER_KEY]).toEqual([expect.objectContaining({ host: "example.com", mode: "block" })])
  expect(updateRules).toHaveBeenLastCalledWith(expect.objectContaining({ addRules: [expect.objectContaining({ condition: { requestDomains: ["example.com"], resourceTypes: ["main_frame"] } })] }))
  expect(updateTab).toHaveBeenCalledWith(2, { url: "chrome-extension://zed/site-blocked.html" })
  await expect(updateSiteLimiter({ url: "example.com", mode: "daily", minutes: 100 })).rejects.toThrow("cannot be changed")
  vi.advanceTimersByTime(60000)
  await updateSiteLimiter()
  expect(local[LIMITER_KEY]).toEqual([])
  expect(dynamic).toEqual([{ id: 1 }])
  expect(alarms.clear).toHaveBeenCalled()
})
it("resumes daily tracking after a worker restart without opening the popup", async () => {
  vi.resetModules()
  vi.useFakeTimers()
  const now = new Date(2026, 10, 14, 12).getTime()
  vi.setSystemTime(now)
  const local: Record<string, unknown> = {}
  const session: Record<string, unknown> = {}
  const area = (values: Record<string, unknown>) => ({ get: async () => ({ ...values }), set: async (patch: object) => Object.assign(values, patch) })
  const alarmListeners: Array<(alarm: { name: string }) => void> = []
  const event = () => ({ addListener: vi.fn() })
  const updateTab = vi.fn(async () => {})
  const updateRules = vi.fn(async () => {})
  vi.stubGlobal("chrome", {
    storage: { local: area(local), session: area(session) },
    declarativeNetRequest: { getDynamicRules: async () => [], updateDynamicRules: updateRules },
    tabs: {
      query: async () => [{ id: 2, url: "https://example.com", active: true, windowId: 1 }],
      update: updateTab, onActivated: event(), onUpdated: event(), onRemoved: event(),
    },
    windows: { getLastFocused: async () => ({ id: 1, focused: true }), onFocusChanged: event() },
    idle: { queryState: async () => "active", onStateChanged: event() },
    runtime: { getURL: (path: string) => `chrome-extension://zed/${path}`, onStartup: event(), onInstalled: event() },
    alarms: { create: vi.fn(async () => {}), clear: vi.fn(async () => {}), onAlarm: { addListener: (listener: (alarm: { name: string }) => void) => alarmListeners.push(listener) } },
  })
  const firstWorker = await import("./siteLimiterWorker")
  await firstWorker.updateSiteLimiter({ url: "example.com", mode: "daily", minutes: 1 })
  vi.advanceTimersByTime(30_000)
  vi.resetModules()
  const restartedWorker = await import("./siteLimiterWorker")
  restartedWorker.installSiteLimiter()
  await restartedWorker.updateSiteLimiter()
  expect(local[LIMITER_KEY]).toEqual([expect.objectContaining({ used: 30_000 })])
  vi.advanceTimersByTime(30_000)
  alarmListeners[0]({ name: "zed-site-limiter" })
  // Wait behind the alarm's queued update to inspect its persisted result.
  await restartedWorker.updateSiteLimiter()
  expect(local[LIMITER_KEY]).toEqual([expect.objectContaining({ used: 60_000 })])
  expect(updateRules).toHaveBeenLastCalledWith(expect.objectContaining({ addRules: [expect.objectContaining({ condition: { requestDomains: ["example.com"], resourceTypes: ["main_frame"] } })] }))
  expect(updateTab).toHaveBeenCalledWith(2, { url: "chrome-extension://zed/site-blocked.html" })
})
