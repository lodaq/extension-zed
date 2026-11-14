import { afterEach, expect, it, vi } from "vitest"
import type { SystemSiteLimit } from "./systemSiteLimiter"

afterEach(() => vi.unstubAllGlobals())
function setup(installType = "admin") {
  const native = vi.fn(async () => ({ ok: true, rules: [] as SystemSiteLimit[] }))
  const update = vi.fn(async () => {})
  const saved = vi.fn(async () => {})
  const query = vi.fn(async (): Promise<chrome.tabs.Tab[]> => [])
  vi.stubGlobal("chrome", {
    management: { getSelf: async () => ({ installType }) },
    runtime: { sendNativeMessage: native, getURL: (path: string) => `chrome-extension://zed/${path}` },
    storage: { local: { set: saved } },
    declarativeNetRequest: { getDynamicRules: async () => [{ id: 1 }, { id: 710003 }], updateDynamicRules: update },
    alarms: { create: vi.fn(async () => {}), clear: vi.fn(async () => {}) },
    tabs: { query, update: vi.fn(async () => {}) },
    windows: { getLastFocused: async () => ({ id: 7, focused: true }) },
    idle: { queryState: async () => "active" },
  })
  return { native, update, saved, query }
}

it("rejects ordinary or unpacked installs without creating weaker substitutes", async () => {
  vi.resetModules()
  const { native, update } = setup("development")
  const { systemSiteLimiter } = await import("./systemSiteLimiter")
  await expect(systemSiteLimiter("add", { url: "example.com", mode: "block", minutes: 30 })).rejects.toThrow("mandatory")
  expect(native).not.toHaveBeenCalled()
  expect(update).not.toHaveBeenCalled()
})

it("mirrors a service lock even when the daily allowance was not exhausted", async () => {
  vi.resetModules()
  const { native, update, saved } = setup()
  const rule: SystemSiteLimit = { id: 1, host: "example.com", mode: "daily", minutes: 30, until: 0, used: 0, day: "2026-11-14", locked: true, system: true }
  native.mockResolvedValue({ ok: true, rules: [rule] })
  const { systemSiteLimiter } = await import("./systemSiteLimiter")
  await systemSiteLimiter("status")
  expect(update).toHaveBeenCalledWith({ removeRuleIds: [710003], addRules: [expect.objectContaining({ id: 710000, condition: { requestDomains: ["example.com"], resourceTypes: ["main_frame"] } })] })
  expect(saved).toHaveBeenCalledWith({ systemSiteLimiterView: [rule] })
})

it("retains local mirror rules when the service cannot be reached", async () => {
  vi.resetModules()
  const { native, update, saved } = setup()
  native.mockRejectedValue(new Error("Host unavailable"))
  const { systemSiteLimiter } = await import("./systemSiteLimiter")
  await expect(systemSiteLimiter("status")).rejects.toThrow("Host unavailable")
  expect(update).not.toHaveBeenCalled()
  expect(saved).not.toHaveBeenCalled()
})

it("reports the focused tab but sends an empty URL when the computer is idle", async () => {
  vi.resetModules()
  const { native, query } = setup()
  query.mockResolvedValue([{ id: 1, url: "https://example.com", active: true, windowId: 7 } as chrome.tabs.Tab])
  const { reportSystemForeground } = await import("./systemSiteLimiter")
  await reportSystemForeground()
  expect(native).toHaveBeenLastCalledWith("com.extension_zed.limiter", { action: "report", url: "https://example.com" })
  chrome.idle.queryState = vi.fn(async () => "idle") as typeof chrome.idle.queryState
  await reportSystemForeground()
  expect(native).toHaveBeenLastCalledWith("com.extension_zed.limiter", { action: "report", url: "" })
})
