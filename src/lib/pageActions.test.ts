import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { handlePageAction } from "./pageActions"

let values: Record<string, unknown>
let set: ReturnType<typeof vi.fn>
let inject: ReturnType<typeof vi.fn>
beforeEach(() => {
  values = { speed: "1.36" }
  set = vi.fn(async (patch: Record<string, unknown>) => { Object.assign(values, patch) })
  inject = vi.fn(async () => [{ frameId: 0, result: { ok: true } }])
  vi.stubGlobal("chrome", {
    storage: { local: { get: async () => ({ ...values }), set } },
    tabs: { query: async () => [{ id: 7 }], get: async () => ({ url: "https://example.com/page" } as unknown as chrome.tabs.Tab) },
    scripting: { executeScript: inject },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("page actions", () => {
  it("handles playback faster", async () => {
    expect(await handlePageAction({ event: "playbackFaster" })).toMatchObject({ ok: true })
    expect(values.speed).toBe("1.5")
  })

  it("handles playback slower and direct playback rate apply", async () => {
    values.speed = "1.5"
    expect(await handlePageAction({ event: "playbackSlower" })).toMatchObject({ ok: true })
    expect(values.speed).toBe("1.4")

    expect(await handlePageAction({ event: "playbackRateApply", value: 2 })).toMatchObject({ ok: true })
    expect(values.speed).toBe("2")
  })

  it("does not inject after a storage failure", async () => {
    set.mockRejectedValueOnce(new Error("Storage unavailable"))
    expect(await handlePageAction({ event: "designMode", value: true })).toMatchObject({ ok: false, saved: false, error: "Storage unavailable" })
    expect(inject).not.toHaveBeenCalled()
  })

  it("normalizes Chrome protected URL errors into clean user messages", async () => {
    inject.mockRejectedValue(new Error("Cannot access a chrome:// URL"))
    const result = await handlePageAction({ event: "designMode", value: true })
    expect(result).toMatchObject({ ok: false, saved: true })
    expect(result.error).toContain("This page is protected by Chrome and cannot be modified.")
  })

  it("normalizes extension gallery and scripting restriction errors", async () => {
    inject.mockRejectedValue(new Error("The extensions gallery cannot be scripted"))
    const result = await handlePageAction({ event: "hideMainScrollBar" })
    expect(result).toMatchObject({ ok: false })
    expect(result.error).toContain("This page is protected by Chrome and cannot be modified.")
  })

  it("retains saved preferences and reports application failure", async () => {
    inject.mockRejectedValue(new Error("Restricted page"))
    const result = await handlePageAction({ event: "inspectModeApply", value: true })
    expect(result).toMatchObject({ ok: false, saved: true })
    expect(result.error).toContain("saved")
    expect(values.inspectMode).toBe("on")
  })

  it("rejects missing tabs, invalid actions, and invalid values before writing", async () => {
    for (const request of [
      { event: "unknown" },
      { event: "designMode", value: "yes" },
      { event: "volumeBoost", value: 9999 },
      { event: "volumeBoost", value: 50 },
      { event: "changeBackgroundColor", value: "not-a-color" },
      { event: "designMode", tabId: -1 },
    ]) {
      expect(await handlePageAction(request)).toMatchObject({ ok: false })
    }
    chrome.tabs.query = vi.fn(async () => [])
    expect(await handlePageAction({ event: "designMode", value: true })).toMatchObject({ ok: false })
    expect(set).not.toHaveBeenCalled()
  })

  it("applies and resets page colors on valid URLs and blocks non-HTTP pages", async () => {
    expect(await handlePageAction({ event: "changeBackgroundColor", value: "#123456" })).toMatchObject({ ok: true })
    expect(values["pageColors:https://example.com"]).toMatchObject({ background: "#123456" })

    expect(await handlePageAction({ event: "changeColor", value: "#abcdef" })).toMatchObject({ ok: true })
    expect(values["pageColors:https://example.com"]).toEqual({ background: "#123456", text: "#abcdef" })

    await handlePageAction({ event: "resetTextColorOnly" })
    expect(values["pageColors:https://example.com"]).toEqual({ background: "#123456", text: "" })

    await handlePageAction({ event: "resetBackgroundOnly" })
    expect(values["pageColors:https://example.com"]).toEqual({ background: "", text: "" })

    // Non-HTTP page
    chrome.tabs.get = vi.fn(async () => ({ url: "chrome://extensions" } as unknown as chrome.tabs.Tab))
    const nonHttpResult = await handlePageAction({ event: "changeBackgroundColor", value: "#111111" })
    expect(nonHttpResult.ok).toBe(false)
    expect(nonHttpResult.error).toContain("Page colors require an HTTP or HTTPS page")
  })

  it("handles scrollbar toggle, custom style, and reset actions", async () => {
    expect(await handlePageAction({ event: "hideMainScrollBar" })).toMatchObject({ ok: true })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/hideMainScrollBar.js"] }))

    expect(await handlePageAction({ event: "resetMainScrollBar" })).toMatchObject({ ok: true })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/resetMainScrollBar.js"] }))

    expect(await handlePageAction({ event: "hideAllScrollBars" })).toMatchObject({ ok: true })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/hideAllScrollBars.js"] }))

    expect(await handlePageAction({ event: "resetAllScrollBars" })).toMatchObject({ ok: true })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/resetAllScrollBars.js"] }))

    expect(await handlePageAction({ event: "applyCustomScrollbar" })).toMatchObject({ ok: true })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/applyCustomScrollbar.js"] }))

    expect(await handlePageAction({ event: "resetCustomScrollbar" })).toMatchObject({ ok: true })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/resetCustomScrollbar.js"] }))
  })

  it("handles YouTube focus mode toggle and boolean options", async () => {
    expect(await handlePageAction({ event: "youtubeFocus", value: true })).toMatchObject({ ok: true })
    expect(values.youtubeFocus).toBe(true)

    expect(await handlePageAction({ event: "youtubeFocus", value: false })).toMatchObject({ ok: true })
    expect(values.youtubeFocus).toBe(false)

    expect(await handlePageAction({ event: "hideYoutubeProgressBar", value: true })).toMatchObject({ ok: true })
    expect(values.youtubeHideProgress).toBe(true)

    expect(await handlePageAction({ event: "hideYoutubeControls", value: true })).toMatchObject({ ok: true })
    expect(values.youtubeHideControls).toBe(true)

    expect(await handlePageAction({ event: "hideYoutubeDuration", value: true })).toMatchObject({ ok: true })
    expect(values.youtubeHideDuration).toBe(true)

    expect(await handlePageAction({ event: "youtubeHalfScreen", value: true })).toMatchObject({ ok: true })
    expect(values.youtubeHalfScreen).toBe(true)
  })

  it("handles applyVideoQuality action", async () => {
    values.videoQuality = "hd1440"
    values.videoQualityFallback = "higher"
    inject.mockResolvedValue([{ frameId: 0, result: "2160p" }])
    expect(await handlePageAction({ event: "applyVideoQuality" })).toMatchObject({ ok: true, message: "Player quality set to 2160p" })
    expect(inject).toHaveBeenCalledWith(expect.objectContaining({ files: ["scripts/applyVideoQuality.js"] }))
  })

  it("reports unsupported quality instead of claiming the saved preference was applied", async () => {
    values.videoQuality = "tiny"
    inject.mockResolvedValue([{ frameId: 0, result: null }])
    expect(await handlePageAction({ event: "applyVideoQuality" })).toMatchObject({ ok: false, saved: true, error: expect.stringContaining("No controllable video is ready") })
  })

  it("reports readable quality from a supported frame even when other frames are unsupported", async () => {
    inject.mockResolvedValue([{ frameId: 0, result: null }, { frameId: 1, result: "hd720" }])
    expect(await handlePageAction({ event: "applyVideoQuality" })).toMatchObject({ ok: true, message: "Player quality set to 720p" })
  })

  it("handles modes toggle and volume boost apply", async () => {
    expect(await handlePageAction({ event: "arabicRtlMode", value: true })).toMatchObject({ ok: true })
    expect(values.arabicRtlMode).toBe("on")

    expect(await handlePageAction({ event: "arabicRtlMode", value: false })).toMatchObject({ ok: true })
    expect(values.arabicRtlMode).toBe("off")

    expect(await handlePageAction({ event: "volumeBoost", value: 300 })).toMatchObject({ ok: true })
    expect(values.volumeBoost).toBe(300)
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
