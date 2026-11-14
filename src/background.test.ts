import { afterEach, expect, it, vi } from "vitest"

afterEach(() => vi.unstubAllGlobals())

it("replies to runtime messages, reports failure badge, and clears badge on success", async () => {
  vi.resetModules()
  let message!: (data: unknown, sender: { id: string }, reply: (result: unknown) => void) => void
  const values: Record<string, unknown> = {}
  const inject = vi.fn().mockRejectedValue(new Error("Restricted page"))
  const badge = vi.fn(async () => {})
  const title = vi.fn(async () => {})
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async () => ({ ...values }),
        set: async (patch: Record<string, unknown>) => { Object.assign(values, patch) },
      },
    },
    tabs: { query: async () => [{ id: 7 }] },
    scripting: { executeScript: inject },
    action: { setBadgeText: badge, setTitle: title },
    contextMenus: { onClicked: { addListener: vi.fn() } },
    runtime: { onInstalled: { addListener: vi.fn() }, id: "zed", onMessage: { addListener: (listener: typeof message) => { message = listener } } },
  })
  await import("./background")

  // Message with injection failure
  const failReply = vi.fn()
  message({ event: "inspectModeApply", value: true }, { id: "zed" }, failReply)
  await vi.waitFor(() => expect(badge).toHaveBeenCalledWith({ tabId: 7, text: "!" }))
  expect(title).toHaveBeenCalledWith({ tabId: 7, title: expect.stringContaining("Preference saved") })
  expect(failReply).toHaveBeenCalledWith(expect.objectContaining({ ok: false, saved: true, tabId: 7 }))

  // Message with injection success
  inject.mockResolvedValue([{ frameId: 0 }])
  const successReply = vi.fn()
  message({ event: "hideMainScrollBar" }, { id: "zed" }, successReply)
  await vi.waitFor(() => expect(badge).toHaveBeenLastCalledWith({ tabId: 7, text: "" }))
  expect(title).toHaveBeenLastCalledWith({ tabId: 7, title: "Extension Zed" })
  expect(successReply).toHaveBeenCalledWith({ ok: true, saved: false, tabId: 7 })
})
