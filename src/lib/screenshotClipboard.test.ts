import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"

const script = readFileSync(new URL("../../public/screenshot-clipboard.js", import.meta.url), "utf8")
const origin = "chrome-extension://zed"
const data = "data:image/png;base64,cG5n"

function setup(separate = false) {
  const messages: Record<string, (event: Record<string, unknown>) => void> = {}
  const click: { handler?: (event: { isTrusted: boolean }) => void } = {}
  const owner = { postMessage: vi.fn() }
  const popup = { postMessage: vi.fn() }
  const button = { disabled: true, addEventListener: (_name: string, handler: typeof click.handler) => { click.handler = handler } }
  const write = vi.fn(async () => {})
  const win = {
    opener: separate ? owner : null,
    addEventListener: (name: string, handler: typeof messages[string]) => { messages[name] = handler },
    open: vi.fn(() => popup), close: vi.fn(),
  }
  runInNewContext(script, {
    window: win, parent: separate ? win : owner, location: { origin },
    chrome: { runtime: { getURL: (path: string) => `${origin}/${path}` } },
    document: {
      querySelector: () => button,
      documentElement: { classList: { toggle: vi.fn(), contains: () => true } },
      featurePolicy: { allowsFeature: () => false },
    },
    navigator: { clipboard: { write } },
    ClipboardItem: class { constructor(public types: unknown) {} }, Blob, atob,
  })
  return { messages, click, owner, popup, button, write, win }
}

it("opens a copy window only on a trusted click and relays its result", () => {
  const s = setup()
  s.messages.message({ source: s.owner, origin: "https://claude.ai", data: { type: "zed-screenshot-image", image: data } })
  s.click.handler!({ isTrusted: false })
  expect(s.win.open).not.toHaveBeenCalled()
  s.click.handler!({ isTrusted: true })
  expect(s.win.open).toHaveBeenCalledTimes(1)
  expect(s.write).not.toHaveBeenCalled()
  s.messages.message({ source: s.popup, origin, data: { type: "zed-screenshot-copy-ready" } })
  expect(s.popup.postMessage).toHaveBeenCalledWith({ type: "zed-screenshot-image", image: data, dark: true }, origin)
  s.messages.message({ source: s.popup, origin, data: { type: "zed-screenshot-copy", message: "Copied to clipboard" } })
  expect(s.owner.postMessage).toHaveBeenCalledWith({ type: "zed-screenshot-copy", message: "Copied to clipboard" }, "https://claude.ai")
})

it("rejects website-origin images in the top-level copy window, then copies the extension image and closes", async () => {
  const s = setup(true)
  s.messages.message({ source: s.owner, origin: "https://untrusted.example", data: { type: "zed-screenshot-image", image: data } })
  expect(s.write).not.toHaveBeenCalled()
  s.messages.message({ source: s.owner, origin, data: { type: "zed-screenshot-image", image: data } })
  await vi.waitFor(() => expect(s.win.close).toHaveBeenCalledOnce())
  expect(s.write).toHaveBeenCalledOnce()
  expect(s.owner.postMessage).toHaveBeenCalledWith({ type: "zed-screenshot-copy", message: "Copied to clipboard" }, origin)
})

it("keeps the copy window usable when the clipboard write fails", async () => {
  const s = setup(true)
  s.write.mockRejectedValueOnce(new Error("Blocked"))
  s.messages.message({ source: s.owner, origin, data: { type: "zed-screenshot-image", image: data } })
  await vi.waitFor(() => expect(s.button.disabled).toBe(false))
  expect(s.win.close).not.toHaveBeenCalled()
  expect(s.owner.postMessage).toHaveBeenCalledWith({ type: "zed-screenshot-copy", message: "Clipboard copy failed. Try again or use Download." }, origin)
})
