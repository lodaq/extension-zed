import { afterEach, describe, expect, it, vi } from "@/test/bun-test"
import { isFeatureInstalled, isValidInstalledFeatures, readInstalledFeatures } from "./features"
import { syncFeatureContentScripts } from "./featureContentScripts"
import { readSetting, importSettings, exportSettings } from "./settings"
import { handlePageAction } from "./pageActions"
import { executeShortcut } from "./shortcutExecution"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe("feature store registry", () => {
  it("normalizes installedFeatures by filtering unknown and duplicate entries", () => {
    expect(readInstalledFeatures(undefined)).toEqual([])
    expect(readInstalledFeatures("playback")).toEqual([])
    expect(readInstalledFeatures(["playback", "unknown", "playback", "modes"])).toEqual(["playback", "modes"])
    expect(isFeatureInstalled(["playback"], "playback")).toBe(true)
    expect(isFeatureInstalled(["playback"], "modes")).toBe(false)
  })

  it("validates installedFeatures in settings import/export and allows store detail", async () => {
    const values: Record<string, unknown> = { installedFeatures: ["password", "capture"] }
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: async () => ({ ...values }),
          set: async (patch: Record<string, unknown>) => { Object.assign(values, patch) },
        },
      },
    })

    expect(isValidInstalledFeatures(["password", "capture"])).toBe(true)
    expect(isValidInstalledFeatures(["password", "password"])).toBe(false)
    expect(isValidInstalledFeatures(["unknown"])).toBe(false)

    const backup = await exportSettings()
    expect(backup.settings.installedFeatures).toEqual(["password", "capture"])

    await importSettings({ version: 1, settings: { installedFeatures: ["playback"] } })
    expect(values.installedFeatures).toEqual(["playback"])

    await expect(importSettings({ version: 1, settings: { installedFeatures: ["playback", "playback"] } })).rejects.toThrow("Invalid setting")
    const storeLocation = { tab: "Misc", detail: "store", settings: false }
    expect(readSetting<typeof storeLocation | null>("popupLocation", storeLocation, null)).toEqual(storeLocation)
  })
})

describe("dynamic content scripts & feature isolation", () => {
  it("registers content scripts only for installed features and unregisters removed ones", async () => {
    let registered: { id: string }[] = [{ id: "zed-feature-modes-rtl" }]
    const registerContentScripts = vi.fn(async (scripts: { id: string }[]) => {
      registered = [...registered, ...scripts]
    })
    const unregisterContentScripts = vi.fn(async ({ ids }: { ids: string[] }) => {
      registered = registered.filter((entry) => !ids.includes(entry.id))
    })
    vi.stubGlobal("chrome", {
      scripting: {
        getRegisteredContentScripts: vi.fn(async () => registered),
        registerContentScripts,
        unregisterContentScripts,
      },
    })

    await syncFeatureContentScripts(["playback"])
    expect(unregisterContentScripts).toHaveBeenCalledWith({ ids: ["zed-feature-modes-rtl"] })
    expect(registerContentScripts).toHaveBeenCalledWith([
      expect.objectContaining({ id: "zed-feature-playback", js: ["scripts/playbackRatePersist.js"] }),
    ])

    registerContentScripts.mockClear()
    unregisterContentScripts.mockClear()
    await syncFeatureContentScripts([])
    expect(unregisterContentScripts).toHaveBeenCalledWith({ ids: ["zed-feature-playback"] })
    expect(registerContentScripts).not.toHaveBeenCalled()
  })

  it("rejects uninstalled Misc page actions without touching storage or scripting, while keeping YouTube active", async () => {
    const values: Record<string, unknown> = { installedFeatures: [] }
    const set = vi.fn(async (patch: Record<string, unknown>) => { Object.assign(values, patch) })
    const executeScript = vi.fn(async () => [{ frameId: 0 }])
    vi.stubGlobal("chrome", {
      storage: { local: { get: async () => ({ ...values }), set } },
      tabs: { query: async () => [{ id: 7 }] },
      scripting: { executeScript },
    })

    const denied = await handlePageAction({ event: "playbackFaster" })
    expect(denied).toMatchObject({ ok: false, saved: false, error: "Playback speed is not installed" })
    expect(set).not.toHaveBeenCalled()
    expect(executeScript).not.toHaveBeenCalled()

    const ytAllowed = await handlePageAction({ event: "youtubeFocus", value: true })
    expect(ytAllowed).toMatchObject({ ok: true, saved: true })
  })

  it("rejects uninstalled Misc shortcuts", async () => {
    vi.stubGlobal("chrome", {
      storage: { local: { get: async () => ({ installedFeatures: [], keyboardShortcuts: { action0: "Alt+Shift+→" } }), set: vi.fn() } },
      tabs: { get: vi.fn() },
    })
    await expect(executeShortcut("action0", 7)).rejects.toThrow("Playback speed is not installed")
  })

  it("does not initialize site limiter or accept limiter/downloader/screenshot messages when uninstalled", async () => {
    vi.resetModules()
    let message!: (data: unknown, sender: unknown, reply: (result: unknown) => void) => boolean | undefined
    const alarmAddListener = vi.fn()
    const dnrUpdate = vi.fn(async () => {})
    vi.stubGlobal("chrome", {
      contextMenus: { removeAll: vi.fn((cb: () => void) => cb()), create: vi.fn(), onClicked: { addListener: vi.fn() } },
      alarms: { onAlarm: { addListener: alarmAddListener }, clear: vi.fn(async () => true) },
      declarativeNetRequest: { getDynamicRules: vi.fn(async () => []), updateDynamicRules: dnrUpdate },
      runtime: {
        id: "zed",
        getURL: (path: string) => `chrome-extension://zed/${path}`,
        onMessage: { addListener: (listener: typeof message) => { message = listener } },
        onInstalled: { addListener: vi.fn() },
        onStartup: { addListener: vi.fn() },
      },
      tabs: { onActivated: { addListener: vi.fn() }, onUpdated: { addListener: vi.fn() }, query: async () => [] },
      scripting: { executeScript: vi.fn(async () => []) },
      storage: { onChanged: { addListener: vi.fn() }, local: { get: async () => ({ installedFeatures: [] }), set: vi.fn() } },
    })

    await import("../background")
    expect(alarmAddListener).not.toHaveBeenCalled()

    const dlReply = vi.fn()
    expect(message({ type: "downloader:command", command: "status" }, { id: "zed" }, dlReply)).toBe(true)
    await vi.waitFor(() => expect(dlReply).toHaveBeenCalledWith({ ok: false, error: "Video downloader is not installed" }))

    const limReply = vi.fn()
    expect(message({ type: "limiter:list" }, { id: "zed", url: "chrome-extension://zed/index.html" }, limReply)).toBe(true)
    await vi.waitFor(() => expect(limReply).toHaveBeenCalledWith({ ok: false, error: expect.stringContaining("Site limiter is not installed") }))

    const shotReply = vi.fn()
    expect(message({ type: "screenshot:start", mode: "visible" }, { id: "zed" }, shotReply)).toBe(true)
    await vi.waitFor(() => expect(shotReply).toHaveBeenCalledWith({ ok: false, error: "Capture screenshot is not installed" }))
  })
})
