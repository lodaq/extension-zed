import { afterEach, describe, expect, it, vi } from "vitest"
import { exportSettings, importSettings, readSetting } from "./settings"

afterEach(() => vi.unstubAllGlobals())

function storage(initial: Record<string, unknown>) {
  const values = { ...initial }
  const set = vi.fn(async (patch: Record<string, unknown>) => { Object.assign(values, patch) })
  vi.stubGlobal("chrome", { storage: { local: { get: async () => ({ ...values }), set } } })
  return { values, set }
}

describe("settings transfer", () => {
  it("preserves section order in backups and partial imports", async () => {
    const order = ["modes", "password", "playback", "volume", "colors", "scrollbars"]
    storage({ miscSectionOrder: order })
    expect((await exportSettings()).settings.miscSectionOrder).toEqual(order)
    await importSettings({ version: 1, settings: { miscSectionOrder: order } })
    expect(readSetting("miscSectionOrder", order, [])).toEqual(order)
  })

  it("preserves expanded sections in backups and partial imports", async () => {
    const expanded = ["modes", "playback"]
    storage({ miscExpandedSections: expanded })
    expect((await exportSettings()).settings.miscExpandedSections).toEqual(expanded)
    await importSettings({ version: 1, settings: { miscExpandedSections: expanded } })
    expect(readSetting("miscExpandedSections", expanded, [])).toEqual(expanded)
  })

  it.each([
    null,
    "password",
    [],
    ["password", "playback", "volume", "colors", "scrollbars", "password"],
    ["password", "playback", "volume", "colors", "scrollbars", "unknown"],
  ].map(order => ({ order })))("rejects invalid section orders before writing: %j", async ({ order }) => {
    const p = storage({ darkTheme: true })
    await expect(importSettings({ version: 1, settings: { miscSectionOrder: order } })).rejects.toThrow("Invalid setting")
    expect(p.set).not.toHaveBeenCalled()
    expect(readSetting("miscSectionOrder", order, ["fallback"])).toEqual(["fallback"])
  })

  it.each([
    null,
    "password",
    ["password", "password"],
    ["unknown"],
  ])("rejects invalid expanded sections: %j", (expanded) => {
    expect(readSetting("miscExpandedSections", expanded, ["fallback"])).toEqual(["fallback"])
  })

  it("round-trips recognized settings without exporting unrelated keys", async () => {
    const p = storage({ speed: "1.36", darkTheme: true, inspectMode: "off", "pageColors:https://example.com": { text: "#aabbcc", background: "" }, unused: 42 })
    const backup = await exportSettings()
    expect(backup.settings).not.toHaveProperty("unused")
    await importSettings(backup)
    expect(p.values.speed).toBe("1.36")
    expect(p.values["pageColors:https://example.com"]).toEqual({ text: "#aabbcc", background: "" })
  })

  it("merges partial imports, ignores unknown keys, and preserves theme", async () => {
    const p = storage({ darkTheme: true, speed: "2" })
    await importSettings({ version: 1, settings: { speed: "3", unused: "ignored" } })
    expect(p.values).toEqual({ darkTheme: true, speed: "3" })
  })

  it("preserves omitted colors within a partial origin setting", async () => {
    const p = storage({ "pageColors:https://example.com": { background: "#112233", text: "#ffffff" } })
    await importSettings({ version: 1, settings: { "pageColors:https://example.com": { text: "#aabbcc" } } })
    expect(p.values["pageColors:https://example.com"]).toEqual({ background: "#112233", text: "#aabbcc" })
  })

  it.each([
    { version: 2, settings: {} },
    { version: 1, settings: { inspectMode: true } },
    { version: 1, settings: { darkTheme: "false" } },
    { version: 1, settings: { speed: "Infinity" } },
    { version: 1, settings: { volumeBoost: 2001 } },
    { version: 1, settings: { popupActiveTab: "unknown" } },
    { version: 1, settings: { "pageColors:https://example.com": { text: "red; } body { display:none" } } },
    { version: 1, settings: { "pageColors:not-an-origin": { text: "#ffffff" } } },
  ])("rejects invalid recognized data before writing: %j", async (backup) => {
    const p = storage({ darkTheme: true })
    await expect(importSettings(backup)).rejects.toThrow()
    expect(p.set).not.toHaveBeenCalled()
    expect(p.values).toEqual({ darkTheme: true })
  })

  it("uses safe defaults for malformed stored values", () => {
    expect(readSetting("inspectMode", 42, "off")).toBe("off")
    expect(readSetting("darkTheme", "no", true)).toBe(true)
    expect(readSetting("volumeBoost", {}, 100)).toBe(100)
  })
})
