import { afterEach, beforeEach, describe, expect, it, vi } from "@/test/bun-test"

type StoredStyle = {
  id: string
  textContent: string
  isConnected: boolean
  remove: ReturnType<typeof vi.fn>
}

function setupGlobals(cache?: Record<string, boolean>, stored: Record<string, unknown> = {}) {
  const values = new Map<string, string>()
  if (cache) values.set("zed.youtubeStyles", JSON.stringify(cache))
  const styles = new Map<string, StoredStyle>()
  const appended: StoredStyle[] = []
  const root = {
    appendChild: vi.fn((style: StoredStyle) => {
      style.isConnected = true
      styles.set(style.id, style)
      appended.push(style)
    }),
  }
  const document = {
    head: root,
    documentElement: root,
    createElement: vi.fn(() => {
      const style: StoredStyle = {
        id: "",
        textContent: "",
        isConnected: false,
        remove: vi.fn(() => {
          style.isConnected = false
          styles.delete(style.id)
        }),
      }
      return style
    }),
    getElementById: (id: string) => styles.get(id) ?? null,
  }
  let onChanged: (changes: Record<string, { newValue?: unknown }>, area: string) => void = () => {}
  const get = vi.fn(async () => stored)
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  vi.stubGlobal("document", document)
  vi.stubGlobal("localStorage", localStorage)
  vi.stubGlobal("chrome", {
    storage: {
      local: { get },
      onChanged: { addListener: (listener: typeof onChanged) => { onChanged = listener } },
    },
  })
  return { appended, document, get, onChanged: (...args: Parameters<typeof onChanged>) => onChanged(...args), values }
}

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

describe("YouTube style persistence", () => {
  it("applies cached styles synchronously before storage resolves", async () => {
    const setup = setupGlobals({ youtubeHideAllTimestamps: true })
    setup.get.mockImplementation(() => new Promise(() => {}))

    await import("./youtubeStyles")

    expect(setup.appended).toHaveLength(1)
    expect(setup.appended[0].textContent).toContain(".ytp-time-display")
    expect(setup.appended[0].textContent).toContain(".ytInlinePlayerControlsTimeDisplay")
    expect(setup.appended[0].textContent).toContain('a[href*="&t="]')
  })

  it("updates and removes styles when stored settings change", async () => {
    const setup = setupGlobals(undefined, { youtubeHideAllTimestamps: false })
    await import("./youtubeStyles")
    await vi.waitFor(() => expect(setup.values.has("zed.youtubeStyles")).toBe(true))
    expect(setup.appended).toHaveLength(0)

    setup.onChanged({ youtubeHideTimestamps: { newValue: true } }, "local")
    expect(setup.appended).toHaveLength(1)
    expect(setup.appended[0].textContent).toContain("ytd-thumbnail-overlay-time-status-renderer")
    expect(JSON.parse(setup.values.get("zed.youtubeStyles") ?? "{}")).toMatchObject({ youtubeHideTimestamps: true })

    setup.onChanged({ youtubeHideTimestamps: { newValue: false } }, "local")
    expect(setup.appended[0].isConnected).toBe(false)
    expect(JSON.parse(setup.values.get("zed.youtubeStyles") ?? "{}")).toMatchObject({ youtubeHideTimestamps: false })
  })

  it("does not react to session storage or unrelated keys", async () => {
    const setup = setupGlobals(undefined, {})
    await import("./youtubeStyles")
    await vi.waitFor(() => expect(setup.values.has("zed.youtubeStyles")).toBe(true))

    setup.onChanged({ youtubeHideTimestamps: { newValue: true } }, "session")
    setup.onChanged({ unrelated: { newValue: true } }, "local")

    expect(setup.appended).toHaveLength(0)
    expect(setup.document.createElement).not.toHaveBeenCalled()
  })
})
