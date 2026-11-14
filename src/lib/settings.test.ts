import { afterEach, describe, expect, it, vi } from "vitest"
import {
  exportSettings,
  importSettings,
  migrateSettings,
  readSetting,
  resetSettings,
  RESET_SETTINGS_KEYS,
} from "./settings"

afterEach(() => vi.unstubAllGlobals())

function storage(initial: Record<string, unknown>) {
  const values = { ...initial }
  const set = vi.fn(async (patch: Record<string, unknown>) => { Object.assign(values, patch) })
  const remove = vi.fn(async (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const k of list) delete values[k]
  })
  vi.stubGlobal("chrome", { storage: { local: { get: async () => ({ ...values }), set, remove } } })
  return { values, set, remove }
}

describe("settings transfer", () => {
  it("appends screenshots to legacy section orders in backups, reads, and partial imports", async () => {
    const order = ["modes", "password", "playback", "volume", "quality", "scrollbars"]
    storage({ miscSectionOrder: order })
    expect((await exportSettings()).settings.miscSectionOrder).toEqual([...order, "screenshot"])
    await importSettings({ version: 1, settings: { miscSectionOrder: order } })
    expect(readSetting("miscSectionOrder", order, [])).toEqual([...order, "screenshot"])
  })

  it("preserves the new screenshot section wherever the user placed it", async () => {
    const order = ["screenshot", "modes", "password", "playback", "volume", "quality", "scrollbars"]
    const p = storage({ miscSectionOrder: order })
    expect((await exportSettings()).settings.miscSectionOrder).toEqual(order)
    await importSettings({ version: 1, settings: { miscSectionOrder: order } })
    expect(p.values.miscSectionOrder).toEqual(order)
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
    ["password", "playback", "volume", "quality", "scrollbars", "password"],
    ["password", "playback", "volume", "quality", "scrollbars", "unknown"],
  ].map(order => ({ order })))(`rejects invalid section orders before writing: %j`, async ({ order }) => {
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
    const p = storage({
      speed: "1.36",
      darkTheme: true,
      inspectMode: "off",
      videoQuality: "hd1080",
      videoQualityFallback: "higher",
      unused: 42,
    })
    const backup = await exportSettings()
    expect(backup.settings).not.toHaveProperty("unused")
    expect(backup.settings.videoQuality).toBe("hd1080")
    expect(backup.settings.videoQualityFallback).toBe("higher")
    await importSettings(backup)
    expect(p.values.speed).toBe("1.36")
    expect(p.values.videoQuality).toBe("hd1080")
    expect(p.values.videoQualityFallback).toBe("higher")
  })

  it("merges partial imports, ignores unknown keys, and preserves theme", async () => {
    const p = storage({ darkTheme: true, speed: "2" })
    await importSettings({ version: 1, settings: { speed: "3", unused: "ignored" } })
    expect(p.values).toEqual({ darkTheme: true, speed: "3" })
  })

  it.each([
    { version: 2, settings: {} },
    { version: 1, settings: { inspectMode: true } },
    { version: 1, settings: { darkTheme: "false" } },
    { version: 1, settings: { speed: "Infinity" } },
    { version: 1, settings: { volumeBoost: 2001 } },
    { version: 1, settings: { popupActiveTab: "unknown" } },
    { version: 1, settings: { videoQuality: "super_ultra_fake" } },
    { version: 1, settings: { videoQualityFallback: "sideways" } },
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
    expect(readSetting("videoQuality", "invalid", "hd1080")).toBe("hd1080")
    expect(readSetting("videoQualityFallback", "invalid", "lower")).toBe("lower")
  })

  it("migrates valid schema versions and rejects future or missing versions", () => {
    expect(migrateSettings({ version: 1, settings: { darkTheme: true } })).toEqual({
      version: 1,
      settings: { darkTheme: true },
    })
    expect(() => migrateSettings(null)).toThrow("Unsupported settings file")
    expect(() => migrateSettings({ version: 0, settings: {} })).toThrow("missing or invalid schema version")
    expect(() => migrateSettings({ version: 99, settings: {} })).toThrow("schema version 99 is not supported")
  })

  it("resets recognized settings", async () => {
    const p = storage({
      darkTheme: false,
      speed: "2.5",
      videoQuality: "hd1440",
      videoQualityFallback: "higher",
      "ytMarkers:abcd1234ef": [{ id: "m1", time: 120, label: "Intro" }],
      unrelatedUserData: "leave-alone",
    })
    await resetSettings()
    expect(p.remove).toHaveBeenCalled()
    expect(p.values).toEqual({
      unrelatedUserData: "leave-alone",
    })
    expect(RESET_SETTINGS_KEYS).toContain("darkTheme")
    expect(RESET_SETTINGS_KEYS).toContain("speed")
    expect(RESET_SETTINGS_KEYS).toContain("videoQuality")
    expect(RESET_SETTINGS_KEYS).toContain("videoQualityFallback")
  })
})

it("exports, validates, imports and resets the website grayscale preference", async () => {
  const saved = storage({ blackAndWhite: true })
  expect((await exportSettings()).settings.blackAndWhite).toBe(true)
  await expect(importSettings({ version: 1, settings: { blackAndWhite: "true" } })).rejects.toThrow("blackAndWhite")
  await importSettings({ version: 1, settings: { blackAndWhite: false } })
  expect(saved.values.blackAndWhite).toBe(false)
  await resetSettings()
  expect(saved.values.blackAndWhite).toBeUndefined()
})
