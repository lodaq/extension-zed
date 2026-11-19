import { afterEach, expect, it, vi } from "@/test/bun-test"
import { defaultDownloadFormat, downloadSize, validDownloadUrl } from "./advancedDownloader"
import { readSetting } from "./settings"

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

it("validates HTTP(S) URLs without accepting credentials, options or local files", () => {
  for (const value of ["", "example.com", "file:///tmp/video", "--exec=bad", "https://user:pass@example.com", "https://example.com/\nnext"]) expect(validDownloadUrl(value)).toBe(false)
  expect(validDownloadUrl("https://example.com/watch?name=$(safe-as-an-argument)")).toBe(true)
  expect(validDownloadUrl(" http://localhost/video ")).toBe(true)
})

it("selects compatibility/recommendation defaults and reports unknown or approximate sizes", () => {
  const rows = [{ id: "4k", tags: ["Best quality"] }, { id: "hd", tags: ["Most compatible"] }]
  expect(defaultDownloadFormat(rows as Parameters<typeof defaultDownloadFormat>[0])).toBe("hd")
  expect(defaultDownloadFormat([])).toBe("")
  expect(downloadSize(1024 ** 2, true)).toBe("~1.0 MB")
  expect(downloadSize(0)).toBe("Size unknown")
  const location = { tab: "Misc", detail: "advanced-downloader", settings: false }
  expect(readSetting<typeof location | null>("popupLocation", location, null)).toEqual(location)
})

function nativeMock() {
  const events: Record<string, (data?: unknown) => void> = {}
  const values: Record<string, unknown> = {}
  const postMessage = vi.fn()
  const connection = {
    postMessage,
    disconnect: vi.fn(),
    onMessage: { addListener: (fn: (value?: unknown) => void) => { events.message = fn } },
    onDisconnect: { addListener: (fn: () => void) => { events.disconnect = fn } },
  }
  const connectNative = vi.fn(() => connection)
  vi.stubGlobal("chrome", {
    runtime: { id: "zed", getURL: (p: string) => `chrome-extension://zed/${p}`, connectNative },
    storage: { session: { get: async () => values, set: async (patch: object) => { Object.assign(values, patch) } } },
  })
  return { events, values, connection, connectNative, postMessage }
}
const sender = { id: "zed", url: "chrome-extension://zed/index.html" }

it("rejects content scripts and malformed commands before opening a native connection", async () => {
  vi.resetModules()
  const { connectNative } = nativeMock()
  const { handleAdvancedDownloaderCommand } = await import("./advancedDownloaderWorker")
  await expect(handleAdvancedDownloaderCommand({ command: "ping" }, { ...sender, url: "https://example.com", tab: { id: 1 } } as chrome.runtime.MessageSender)).rejects.toThrow("denied")
  await expect(handleAdvancedDownloaderCommand({ command: "formats", url: "file:///tmp/a" }, sender)).rejects.toThrow("HTTP(S)")
  await expect(handleAdvancedDownloaderCommand({ command: "download", formatId: "hd+evil" }, sender)).rejects.toThrow("format")
  expect(connectNative).not.toHaveBeenCalled()
})

it("keeps download progress and completion in worker storage without a popup", async () => {
  vi.resetModules()
  const { events, postMessage } = nativeMock()
  const { handleAdvancedDownloaderCommand, readDownloaderState } = await import("./advancedDownloaderWorker")
  const result = handleAdvancedDownloaderCommand({ command: "ping" }, sender)
  expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ command: "ping" }))
  events.message({ id: "1", ok: true, state: { phase: "checking" } })
  await expect(result).resolves.toEqual({ ok: true, state: { phase: "checking" } })
  events.message({ event: "state", state: { phase: "downloading", pct: 42 } })
  expect(await readDownloaderState()).toMatchObject({ phase: "downloading", pct: 42 })
  events.message({ event: "state", state: { phase: "done", filename: "video.mp4", size: 123 } })
  expect(await readDownloaderState()).toMatchObject({ phase: "done", filename: "video.mp4" })
  await handleAdvancedDownloaderCommand({ command: "seen" }, sender)
  expect(await readDownloaderState()).toMatchObject({ phase: "done", seen: true })
})

it("reports missing helpers and interrupts state left by a terminated worker", async () => {
  vi.resetModules()
  const { events, values } = nativeMock()
  const { handleAdvancedDownloaderCommand, readDownloaderState } = await import("./advancedDownloaderWorker")
  values.downloaderState = { phase: "downloading", pct: 20 }
  expect(await readDownloaderState()).toMatchObject({ phase: "error", error: expect.stringContaining("disconnected") })
  const result = handleAdvancedDownloaderCommand({ command: "ping" }, sender)
  events.disconnect()
  await expect(result).rejects.toThrow("disconnected")
  expect(await readDownloaderState()).toMatchObject({ phase: "setup" })
})

it("disconnects on invalid native state instead of putting it into the popup", async () => {
  vi.resetModules()
  const { events, connection } = nativeMock()
  const { handleAdvancedDownloaderCommand } = await import("./advancedDownloaderWorker")
  const result = handleAdvancedDownloaderCommand({ command: "ping" }, sender)
  events.message({ event: "state", state: { phase: "downloading", pct: 999 } })
  await expect(result).rejects.toThrow("invalid response")
  expect(connection.disconnect).toHaveBeenCalled()
})

it("rejects downloader commands when the build flag disables the feature", async () => {
  vi.resetModules()
  vi.stubEnv("VITE_VIDEO_DOWNLOADER", "false")
  const { connectNative } = nativeMock()
  const { handleAdvancedDownloaderCommand } = await import("./advancedDownloaderWorker")
  await expect(handleAdvancedDownloaderCommand({ command: "ping" }, sender)).rejects.toThrow("denied")
  expect(connectNative).not.toHaveBeenCalled()
})

it("cleans up a silent native connection so Check again can reconnect", async () => {
  vi.resetModules()
  vi.useFakeTimers()
  const { events, connectNative, connection } = nativeMock()
  const { handleAdvancedDownloaderCommand, readDownloaderState } = await import("./advancedDownloaderWorker")
  const result = handleAdvancedDownloaderCommand({ command: "ping" }, sender)
  // Bun's `expect(promise).rejects` blocks when the promise depends on fake timers.
  const rejection = result.then(() => undefined, (error: Error) => error.message)
  await vi.advanceTimersByTimeAsync(15000)
  await expect(rejection).resolves.toContain("did not respond")
  expect(connection.disconnect).toHaveBeenCalled()
  expect(await readDownloaderState()).toMatchObject({ phase: "setup" })
  const retry = handleAdvancedDownloaderCommand({ command: "ping" }, sender)
  expect(connectNative).toHaveBeenCalledTimes(2)
  events.message({ id: "2", ok: true, state: { phase: "ready" } })
  await expect(retry).resolves.toMatchObject({ ok: true })
})

it("automatically connects once and preserves an existing download on repeated opens", async () => {
  vi.resetModules()
  const { events, connectNative } = nativeMock()
  const { handleAdvancedDownloaderCommand, readDownloaderState } = await import("./advancedDownloaderWorker")
  const result = handleAdvancedDownloaderCommand({ command: "connect" }, sender)
  await vi.waitFor(() => expect(connectNative).toHaveBeenCalledTimes(1))
  events.message({ id: "1", ok: true, state: { phase: "checking" } })
  await result
  events.message({ event: "state", state: { phase: "downloading", pct: 42 } })
  expect(await readDownloaderState()).toMatchObject({ phase: "downloading" })
  await expect(handleAdvancedDownloaderCommand({ command: "connect" }, sender)).resolves.toMatchObject({ state: { phase: "downloading", pct: 42 } })
  expect(connectNative).toHaveBeenCalledTimes(1)
})
