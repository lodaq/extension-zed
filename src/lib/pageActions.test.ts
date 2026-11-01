import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { handlePageAction, requestForCommand } from "./pageActions"

let values: Record<string, unknown>
let set: ReturnType<typeof vi.fn>
let inject: ReturnType<typeof vi.fn>
beforeEach(() => {
  values = { speed: "1.36" }
  set = vi.fn(async (patch: Record<string, unknown>) => { Object.assign(values, patch) })
  inject = vi.fn(async () => [{ frameId: 0, result: { ok: true } }])
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({ ...values }), set } },
    tabs: { query: async () => [{ id: 7 }], get: async () => ({ url: "https://example.com/page" }) },
    scripting: { executeScript: inject },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("page actions", () => {
  it("uses the same playback action for popup and keyboard", async () => {
    expect(await handlePageAction({ event: "playbackFaster" })).toMatchObject({ ok: true })
    expect(values.speed).toBe("1.5")
    values.speed = "1.36"
    expect(await handlePageAction(requestForCommand("zed_playback_faster"))).toMatchObject({ ok: true })
    expect(values.speed).toBe("1.5")
  })

  it("does not inject after a storage failure", async () => {
    set.mockRejectedValueOnce(new Error("Storage unavailable"))
    expect(await handlePageAction({ event: "designMode", value: true })).toMatchObject({ ok: false, saved: false, error: "Storage unavailable" })
    expect(inject).not.toHaveBeenCalled()
  })

  it("retains saved preferences and reports application failure", async () => {
    inject.mockRejectedValue(new Error("Restricted page"))
    const result = await handlePageAction({ event: "inspectModeApply", value: true })
    expect(result).toMatchObject({ ok: false, saved: true })
    expect(result.error).toContain("saved")
    expect(values.inspectMode).toBe("on")
  })

  it("rejects missing tabs, invalid actions, and invalid values before writing", async () => {
    for (const request of [{ event: "unknown" }, { event: "designMode", value: "yes" }, { event: "volumeBoost", value: 9999 }, { event: "designMode", tabId: -1 }]) {
      expect(await handlePageAction(request)).toMatchObject({ ok: false })
    }
    chrome.tabs.query = vi.fn(async () => [])
    expect(await handlePageAction({ event: "designMode", value: true })).toMatchObject({ ok: false })
    expect(set).not.toHaveBeenCalled()
  })

  it("clears stored colors for reset shortcuts and preserves unrelated color settings", async () => {
    values["pageColors:https://example.com"] = { background: "#000000", text: "#ffffff" }
    await handlePageAction({ event: "resetBackgroundOnly" })
    expect(values["pageColors:https://example.com"]).toEqual({ background: "", text: "#ffffff" })
    await handlePageAction(requestForCommand("zed_reset_page_colors"))
    expect(values["pageColors:https://example.com"]).toEqual({ background: "", text: "" })
  })

  it("awaits injected work before reporting success", async () => {
    let finish!: (value: unknown[]) => void
    inject.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    let completed = false
    const pending = handlePageAction({ event: "hideMainScrollBar" }).then((result) => { completed = true; return result })
    await vi.waitFor(() => expect(inject).toHaveBeenCalled())
    expect(completed).toBe(false)
    finish([{ frameId: 0 }])
    expect(await pending).toMatchObject({ ok: true })
  })

  it("captures each target tab before waiting behind an earlier action", async () => {
    let finish!: (value: unknown[]) => void
    chrome.tabs.query = vi.fn().mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 8 }])
    inject.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const first = handlePageAction({ event: "hideMainScrollBar" })
    await vi.waitFor(() => expect(inject).toHaveBeenCalled())
    const second = handlePageAction({ event: "hideAllScrollBars" })
    await vi.waitFor(() => expect(chrome.tabs.query).toHaveBeenCalledTimes(2))
    finish([{ frameId: 0 }])
    expect(await first).toMatchObject({ ok: true, tabId: 7 })
    expect(await second).toMatchObject({ ok: true, tabId: 8 })
  })
})
