import { openScreenshotEditor } from "./screenshotEditor"
import { captureFullPage } from "./nativeScreenshot"
import themeCss from "../theme.css?inline"
import scrollbarCss from "../scrollbar.css?inline"
import { runScreenshot } from "../content/screenshot"
import { SCREENSHOT_MODES, type ScreenshotMode } from "./screenshotModes"

// Chrome allows two captureVisibleTab calls per second, across all tabs.
let frames: Promise<unknown> = Promise.resolve()
let lastFrame = 0

export async function handleScreenshotMessage(
  data: { type: string; mode?: unknown; token?: unknown; image?: unknown },
  sender: Pick<chrome.runtime.MessageSender, "url" | "frameId"> & { tab?: Pick<chrome.tabs.Tab, "id" | "windowId"> },
): Promise<Record<string, unknown>> {
  if (data.type === "screenshot:start") {
    if (sender.tab || sender.url !== chrome.runtime.getURL("index.html")) {
      throw new Error("Start screenshots from the Zed popup")
    }
    if (!SCREENSHOT_MODES.includes(data.mode as ScreenshotMode)) throw new Error("Invalid capture mode")
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id === undefined) throw new Error("No active tab is available")
    const key = `screenshot:${tab.id}`
    const token = crypto.randomUUID()
    const { darkTheme = true } = await chrome.storage.local.get("darkTheme")
    await chrome.storage.session.set({ [key]: { token } })
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: runScreenshot, args: [data.mode as ScreenshotMode, token, themeCss + scrollbarCss, darkTheme !== false] })
    } catch {
      await chrome.storage.session.remove(key)
      throw new Error("This page does not allow screenshot selection or previews. Open a regular webpage and try again.")
    }
    return { ok: true }
  }

  const clipboardFrame = data.type === "screenshot:copy" && sender.url === chrome.runtime.getURL("screenshot-clipboard.html")
  if (sender.tab?.id === undefined || (sender.frameId !== 0 && !clipboardFrame) || typeof data.token !== "string") {
    throw new Error("Invalid screenshot sender")
  }
  const tab = sender.tab
  const key = `screenshot:${tab.id}`
  const stored = await chrome.storage.session.get<Record<string, { token: string }>>(key)
  if (stored[key]?.token !== data.token) throw new Error("Screenshot session expired. Start a new capture.")

  if (data.type === "screenshot:copy") {
    if (typeof data.image !== "string" || !data.image.startsWith("data:image/png;base64,") || data.image.length > 32 * 1024 * 1024) throw new Error("Invalid clipboard image")
    // Chrome 157+ supports clipboard writes in extension service workers.
    if (!navigator.clipboard?.write) return { ok: true, nativeCopy: true }
    const bytes = Uint8Array.from(atob(data.image.split(",")[1]), (char) => char.charCodeAt(0))
    await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([bytes], { type: "image/png" }) })])
    return { ok: true }
  }

  if (data.type === "screenshot:edit") {
    await openScreenshotEditor(data.image)
    return { ok: true }
  }
  if (data.type === "screenshot:end") {
    await chrome.storage.session.remove(key)
    return { ok: true }
  }
  if (data.type === "screenshot:full") {
    if (!(await chrome.permissions.contains({ permissions: ["debugger"] }))) throw new Error("Reload Zed and accept its browser capture permission to use Full page")
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId })
    if (active?.id !== tab.id) throw new Error("Keep the captured tab active until capture finishes")
    const image = await captureFullPage(tab.id!)
    return { ok: true, image }
  }
  if (data.type === "screenshot:frame") {
    const work = frames.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 550 - (Date.now() - lastFrame))))
      const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId })
      const window = await chrome.windows.get(tab.windowId)
      if (active?.id !== tab.id || !window.focused) throw new Error("Keep the captured tab active until capture finishes")
      // A queued request must still belong to the current capture.
      const current = await chrome.storage.session.get<Record<string, { token: string }>>(key)
      if (current[key]?.token !== data.token) throw new Error("Screenshot session expired")
      lastFrame = Date.now()
      const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" })
      const [after] = await chrome.tabs.query({ active: true, windowId: tab.windowId })
      if (after?.id !== tab.id) throw new Error("The active tab changed during capture")
      return { ok: true, image }
    })
    frames = work.catch(() => {})
    return work
  }
  throw new Error("Unknown screenshot request")
}
