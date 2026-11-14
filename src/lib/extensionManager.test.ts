import { afterEach, describe, expect, it, vi } from "vitest"
import {
  currentExtensionId,
  getExtensionSettingsUrl,
  isManagementCancellation,
  listExtensions,
  managementErrorMessage,
  openBraveExtensionsTab,
  openExtensionSettings,
  openTab,
  reloadExtension,
  setExtensionEnabled,
  subscribeToManagementEvents,
  toManagedExtensions,
  uninstallExtension,
} from "./extensionManager"

type Info = chrome.management.ExtensionInfo

function info(overrides: Partial<Info> & Pick<Info, "id" | "name">): Info {
  return {
    description: "",
    enabled: true,
    mayDisable: true,
    installType: "normal",
    type: "extension",
    version: "1.0.0",
    hostPermissions: [],
    permissions: [],
    offlineEnabled: false,
    optionsUrl: "",
    ...overrides,
  } as Info
}

afterEach(() => vi.unstubAllGlobals())

describe("managed extension list", () => {
  it("keeps extensions, drops apps and themes, and sorts by name", () => {
    const rows = toManagedExtensions(
      [
        info({ id: "b", name: "Beta" }),
        info({ id: "a", name: "alpha" }),
        info({ id: "app", name: "An app", type: "packaged_app" }),
        info({ id: "theme", name: "A theme", type: "theme" }),
      ],
      "self"
    )

    expect(rows.map((row) => row.name)).toEqual(["alpha", "Beta"])
  })

  it("hides the current extension from the list", () => {
    expect(toManagedExtensions([info({ id: "self", name: "Zed" })], "self")).toEqual([])
  })

  it("follows Chrome's mayDisable and mayEnable flags", () => {
    const rows = toManagedExtensions(
      [
        info({ id: "locked", name: "Locked", mayDisable: false }),
        info({ id: "disabled", name: "Disabled", enabled: false, mayEnable: true }),
        info({ id: "disabled-locked", name: "Disabled locked", enabled: false, mayEnable: false }),
      ],
      "self"
    )
    const locked = rows.find((row) => row.id === "locked")!
    const disabled = rows.find((row) => row.id === "disabled")!
    const disabledLocked = rows.find((row) => row.id === "disabled-locked")!

    expect(locked.canToggle).toBe(false)
    expect(locked.canUninstall).toBe(false)
    expect(disabled.canToggle).toBe(true)
    expect(disabled.canReload).toBe(false)
    expect(disabledLocked.canToggle).toBe(false)
  })

  it("picks a usable icon from the declared sizes", () => {
    const [row] = toManagedExtensions(
      [
        info({
          id: "one",
          name: "One",
          icons: [
            { size: 16, url: "chrome-extension://one/16.png" },
            { size: 32, url: "chrome-extension://one/32.png" },
            { size: 128, url: "chrome-extension://one/128.png" },
          ],
        }),
      ],
      "self"
    )

    expect(row.iconUrl).toBe("chrome-extension://one/32.png")
  })
})

describe("management actions", () => {
  it("subscribes only to available management events", () => {
    const refresh = vi.fn()
    const onEnabled = { addListener: vi.fn(), removeListener: vi.fn() }
    const unsubscribe = subscribeToManagementEvents({ onEnabled }, refresh)

    expect(onEnabled.addListener).toHaveBeenCalledWith(refresh)
    unsubscribe()
    expect(onEnabled.removeListener).toHaveBeenCalledWith(refresh)
  })

  it("loads every extension through the management API with default selfId", async () => {
    const getAll = vi.fn(async () => [info({ id: "my-id", name: "Alpha" })])
    vi.stubGlobal("chrome", {
      management: { getAll },
      runtime: { id: "my-id" },
    })

    expect(currentExtensionId()).toBe("my-id")
    await expect(listExtensions()).resolves.toEqual([])
    expect(getAll).toHaveBeenCalledOnce()
  })

  it("returns an empty string from currentExtensionId when chrome.runtime is missing", () => {
    vi.stubGlobal("chrome", {})
    expect(currentExtensionId()).toBe("")
  })

  it("forwards enable and disable requests", async () => {
    const setEnabled = vi.fn(async () => undefined)
    vi.stubGlobal("chrome", { management: { setEnabled } })

    await setExtensionEnabled("abc", false)
    expect(setEnabled).toHaveBeenCalledWith("abc", false)
  })

  it("reloads by disabling and then enabling", async () => {
    const setEnabled = vi.fn(async () => undefined)
    vi.stubGlobal("chrome", { management: { setEnabled } })

    await reloadExtension("abc")

    expect(setEnabled.mock.calls).toEqual([
      ["abc", false],
      ["abc", true],
    ])
  })

  it("reloads self via chrome.runtime.reload when available", async () => {
    const reload = vi.fn()
    vi.stubGlobal("chrome", {
      runtime: { id: "self-id", reload },
      management: { setEnabled: vi.fn() },
    })

    await reloadExtension("self-id")

    expect(reload).toHaveBeenCalledOnce()
    expect(chrome.management.setEnabled).not.toHaveBeenCalled()
  })

  it("forwards uninstall requests", async () => {
    const uninstall = vi.fn(async () => undefined)
    vi.stubGlobal("chrome", { management: { uninstall } })

    await uninstallExtension("abc")
    expect(uninstall).toHaveBeenCalledWith("abc")
  })

  it("reports a missing management API", async () => {
    vi.stubGlobal("chrome", {})
    await expect(listExtensions("self")).rejects.toThrow(/management is unavailable/i)
  })

  it("reports when the browser exposes management without getAll", async () => {
    vi.stubGlobal("chrome", { management: {} })
    await expect(listExtensions("self")).rejects.toThrow(/does not expose chrome\.management\.getAll/i)
  })
})

describe("management errors", () => {
  it("treats a dismissed confirmation as a cancellation", () => {
    expect(isManagementCancellation(new Error("Uninstall canceled by user"))).toBe(true)
    expect(isManagementCancellation(new Error("User cannot modify settings"))).toBe(false)
  })

  it("explains policy restrictions and keeps unknown errors", () => {
    expect(managementErrorMessage(new Error("User cannot modify settings"))).toMatch(/policy/i)
    expect(managementErrorMessage(new Error("Something else"))).toBe("Something else")
    expect(managementErrorMessage(undefined)).toBe("Chrome rejected the request.")
  })
})

describe("extension settings navigation", () => {
  it("extracts optionsUrl when present in ExtensionInfo", () => {
    const [row] = toManagedExtensions(
      [info({ id: "custom", name: "Custom", optionsUrl: "chrome-extension://custom/options.html" })],
      "self"
    )
    expect(row.optionsUrl).toBe("chrome-extension://custom/options.html")
  })

  it("determines settings URL prioritizing optionsUrl for enabled extensions", () => {
    expect(
      getExtensionSettingsUrl({
        id: "ext1",
        optionsUrl: "chrome-extension://ext1/options.html",
        enabled: true,
      })
    ).toBe("chrome-extension://ext1/options.html")

    expect(
      getExtensionSettingsUrl({
        id: "ext1",
        optionsUrl: "chrome-extension://ext1/options.html",
        enabled: false,
      })
    ).toBe("chrome://extensions/?id=ext1")

    expect(
      getExtensionSettingsUrl({
        id: "ext2",
        optionsUrl: "",
        enabled: true,
      })
    ).toBe("chrome://extensions/?id=ext2")
  })

  it("opens extension settings tab via chrome.tabs.create", async () => {
    const create = vi.fn((_opts, cb) => {
      if (cb) cb({ id: 10 })
      return Promise.resolve({ id: 10 })
    })
    vi.stubGlobal("chrome", { tabs: { create } })

    const [ext] = toManagedExtensions(
      [info({ id: "target", name: "Target", optionsUrl: "chrome-extension://target/options.html" })],
      "self"
    )

    await openExtensionSettings(ext)
    expect(create).toHaveBeenCalledWith(
      { url: "chrome-extension://target/options.html" },
      expect.any(Function)
    )
  })

  it("falls back to chrome://extensions details page if optionsUrl fails to open", async () => {
    let callCount = 0
    const create = vi.fn((_opts, cb) => {
      callCount++
      if (callCount === 1) {
        throw new Error("Cannot open chrome-extension URL")
      }
      if (cb) cb({ id: 20 })
      return Promise.resolve({ id: 20 })
    })
    vi.stubGlobal("chrome", { tabs: { create } })

    const [ext] = toManagedExtensions(
      [info({ id: "target", name: "Target", optionsUrl: "chrome-extension://target/options.html" })],
      "self"
    )

    await openExtensionSettings(ext)
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenLastCalledWith(
      { url: "chrome://extensions/?id=target" },
      expect.any(Function)
    )
  })

  it("opens browser settings for the host extension even when it has app options", async () => {
    const create = vi.fn((_opts, cb) => {
      cb({ id: 10 })
      return Promise.resolve({ id: 10 })
    })
    vi.stubGlobal("chrome", { tabs: { create } })

    const self = { id: "self", isSelf: true } as Parameters<typeof openExtensionSettings>[0]
    await openExtensionSettings(self)

    expect(create).toHaveBeenCalledWith(
      { url: "chrome://extensions/?id=self" },
      expect.any(Function)
    )
  })

  it("falls back to window.open when chrome.tabs is unavailable", async () => {
    vi.stubGlobal("chrome", {})
    const openMock = vi.fn()
    vi.stubGlobal("window", { open: openMock })

    await openTab("https://example.com")
    expect(openMock).toHaveBeenCalledWith("https://example.com", "_blank", "noopener,noreferrer")
  })

  it("opens brave://extensions/ via openBraveExtensionsTab", async () => {
    const create = vi.fn((_opts, cb) => {
      if (cb) cb({ id: 30 })
      return Promise.resolve({ id: 30 })
    })
    vi.stubGlobal("chrome", { tabs: { create } })

    await openBraveExtensionsTab()
    expect(create).toHaveBeenCalledWith(
      { url: "brave://extensions/" },
      expect.any(Function)
    )
  })

  it("falls back to chrome://extensions/ if brave://extensions/ fails", async () => {
    let callCount = 0
    const create = vi.fn((_opts, cb) => {
      callCount++
      if (callCount === 1) {
        throw new Error("Cannot open brave:// URL")
      }
      if (cb) cb({ id: 31 })
      return Promise.resolve({ id: 31 })
    })
    vi.stubGlobal("chrome", { tabs: { create } })

    await openBraveExtensionsTab()
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenLastCalledWith(
      { url: "chrome://extensions/" },
      expect.any(Function)
    )
  })
})
