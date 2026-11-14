import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"

const script = readFileSync(new URL("../../public/screenshot-clipboard.js", import.meta.url), "utf8")
const data = "data:image/png;base64,cG5n"

function setup() {
  const messages: Record<string, (event: Record<string, unknown>) => void> = {}
  const click: { handler?: (event: { isTrusted: boolean }) => Promise<void> } = {}
  const owner = { postMessage: vi.fn() }
  const button = { disabled: true, focus: vi.fn(), addEventListener: (_name: string, handler: typeof click.handler) => { click.handler = handler } }
  const sendMessage = vi.fn(async () => ({ ok: true, nativeCopy: true }))
  const execCommand = vi.fn(() => true)
  const image = { contentWindow: { focus: vi.fn() }, contentDocument: { execCommand }, style: {}, setAttribute: vi.fn(), onload: () => {} }
  const append = vi.fn()
  runInNewContext(script, {
    window: { addEventListener: (name: string, handler: typeof messages[string]) => { messages[name] = handler } },
    parent: owner,
    chrome: { runtime: { sendMessage } },
    document: {
      querySelector: () => button,
      createElement: () => image,
      body: { append },
      documentElement: { classList: { toggle: vi.fn() } },
    },
    URL: { createObjectURL: () => "blob:screenshot" }, Blob, atob,
  })
  const load = () => {
    messages.message({ source: owner, origin: "https://example.com", data: { type: "zed-screenshot-image", token: "valid", image: data } })
    image.onload()
  }
  return { messages, click, owner, button, execCommand, image, append, load, sendMessage }
}

it("copies the PNG image document on a trusted click without opening a window", async () => {
  const s = setup()
  s.messages.message({ source: s.owner, origin: "https://example.com", data: { type: "zed-screenshot-image", image: data } })
  await s.click.handler!({ isTrusted: true })
  expect(s.execCommand).not.toHaveBeenCalled()
  s.image.onload()
  await s.click.handler!({ isTrusted: false })
  expect(s.execCommand).not.toHaveBeenCalled()
  await s.click.handler!({ isTrusted: true })
  expect(s.execCommand).toHaveBeenCalledWith("copy")
  expect(s.image.contentWindow.focus.mock.invocationCallOrder[0]).toBeLessThan(s.execCommand.mock.invocationCallOrder[0])
  expect(s.button.focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(s.owner.postMessage).toHaveBeenCalledWith({ type: "zed-screenshot-copy", message: "Copied to clipboard" }, "https://example.com")
})

it("reports worker failures without claiming success or trying native copy", async () => {
  const s = setup()
  s.load()
  s.sendMessage.mockRejectedValueOnce(new Error("Clipboard unavailable"))
  await s.click.handler!({ isTrusted: true })
  expect(s.execCommand).not.toHaveBeenCalled()
  expect(s.button.disabled).toBe(false)
  expect(s.owner.postMessage).toHaveBeenLastCalledWith({ type: "zed-screenshot-copy", message: "Clipboard copy failed: Clipboard unavailable. Try again or use Download." }, "https://example.com")
})

it("ignores images from other frames and malformed PNG messages", () => {
  const s = setup()
  for (const [source, image] of [[{}, data], [s.owner, "not a PNG"], [s.owner, "data:image/png;base64,!"]]) {
    s.messages.message({ source, origin: "https://example.com", data: { type: "zed-screenshot-image", image } })
  }
  expect(s.append).not.toHaveBeenCalled()
  expect(s.button.disabled).toBe(true)
})

it.each([false, new Error("Blocked")])("reports copy failure and allows retry: %s", async (result) => {
  const s = setup()
  s.load()
  if (result instanceof Error) s.execCommand.mockImplementationOnce(() => { throw result })
  else s.execCommand.mockReturnValueOnce(result)
  await s.click.handler!({ isTrusted: true })
  expect(s.owner.postMessage).toHaveBeenCalledWith({ type: "zed-screenshot-copy", message: `Clipboard copy failed: ${result instanceof Error ? result.message : "Copy failed"}. Try again or use Download.` }, "https://example.com")
  expect(s.button.focus).toHaveBeenCalledWith({ preventScroll: true })
  await s.click.handler!({ isTrusted: true })
  expect(s.owner.postMessage).toHaveBeenLastCalledWith({ type: "zed-screenshot-copy", message: "Copied to clipboard" }, "https://example.com")
})

it("uses the background clipboard without accessing the isolated image document", async () => {
  const s = setup()
  s.load()
  s.sendMessage.mockResolvedValueOnce({ ok: true, nativeCopy: false })
  await s.click.handler!({ isTrusted: true })
  expect(s.sendMessage).toHaveBeenCalledWith({ type: "screenshot:copy", token: "valid", image: data })
  expect(s.execCommand).not.toHaveBeenCalled()
  expect(s.owner.postMessage).toHaveBeenLastCalledWith({ type: "zed-screenshot-copy", message: "Copied to clipboard" }, "https://example.com")
})
