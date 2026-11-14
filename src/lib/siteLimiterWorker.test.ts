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
