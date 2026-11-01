import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

it("reports keyboard failures per tab, clears them after success, and replies to popup requests", async () => {
  vi.resetModules()
  let command!: (name: string) => void
  let message!: (data: unknown, sender: { id: string }, reply: (result: unknown) => void) => void
  const values: Record<string, unknown> = {}
  const inject = vi.fn().mockRejectedValue(new Error("Restricted page"))
  const badge = vi.fn(async () => {})
  const title = vi.fn(async () => {})
  vi.stubGlobal("chrome", {
    storage: { local: {
      get: async () => ({ ...values }),
      set: async (patch: Record<string, unknown>) => { Object.assign(values, patch) },
    } },
    tabs: { query: async () => [{ id: 7 }] },
    scripting: { executeScript: inject },
    action: { setBadgeText: badge, setTitle: title },
    runtime: { id: "zed", onMessage: { addListener: (listener: typeof message) => { message = listener } } },
    commands: { onCommand: { addListener: (listener: typeof command) => { command = listener } } },
  })
  await import("./background")
  command("zed_inspect")
  await vi.waitFor(() => expect(badge).toHaveBeenCalledWith({ tabId: 7, text: "!" }))
  expect(title).toHaveBeenCalledWith({ tabId: 7, title: expect.stringContaining("Preference saved") })
  expect(values.inspectMode).toBe("on")
  inject.mockResolvedValue([{ frameId: 0 }])
  command("zed_inspect")
  await vi.waitFor(() => expect(badge).toHaveBeenLastCalledWith({ tabId: 7, text: "" }))
  expect(title).toHaveBeenLastCalledWith({ tabId: 7, title: "Extension Zed" })
  expect(values.inspectMode).toBe("off")
  const reply = vi.fn()
  message({ event: "hideMainScrollBar" }, { id: "zed" }, reply)
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true, saved: false, tabId: 7 }))
})
