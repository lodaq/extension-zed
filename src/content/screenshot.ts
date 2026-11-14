import type { ScreenshotMode } from "../lib/screenshotModes"

// Injected with executeScript: keep runtime helpers inside this function.
export function runScreenshot(mode: ScreenshotMode, token: string, scrollbarCss: string, dark = true) {
  type Rect = { x: number; y: number; width: number; height: number }
  const state = window as Window & { __zedScreenshotClose?: () => void }
  state.__zedScreenshotClose?.()
  const controller = new AbortController()
  const { signal } = controller
  const previousFocus = document.activeElement
  const host = document.createElement("div")
  host.style.cssText = "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;"
  host.classList.toggle("dark", dark)
  const shadow = host.attachShadow({ mode: "closed" })
  const style = document.createElement("style")
  style.textContent = scrollbarCss + `
    *{box-sizing:border-box;border-radius:0!important;animation:none!important;transition:none!important}
    dialog{pointer-events:auto;color:var(--card-foreground);background:var(--card);border:1px solid var(--border);font:14px/1.5 var(--font-sans);padding:20px;box-shadow:0 2px 6px #0008}
    dialog::backdrop{background:#0005}
    .preview{width:min(760px,calc(100vw - 32px));max-width:none;max-height:min(640px,80dvh);margin:auto;overflow:hidden}
    .preview[open]{display:flex;flex-direction:column}
    .header{flex-shrink:0;display:flex;align-items:start;justify-content:space-between;gap:20px;margin-bottom:16px}
    h2{font:inherit;font-size:16px;font-weight:600;margin:0}
    button,a{font:inherit;cursor:pointer;padding:8px 16px;border:1px solid var(--input);color:var(--foreground);background:transparent;text-decoration:none}
    button:hover:not(:disabled),a:hover{background:var(--accent);color:var(--accent-foreground)}
    button:focus-visible,a:focus-visible{outline:2px solid var(--ring);outline-offset:3px}
    button:disabled{opacity:.6;cursor:default}
    .close{border:0;padding:0 4px;color:var(--muted-foreground);line-height:1}
    .download{background:var(--primary);color:var(--primary-foreground)}
    .download:hover{opacity:.9}
    .image{max-height:min(460px,calc(80dvh - 180px));overflow:auto;background:var(--muted);min-height:0;flex:1 1 auto}
    img{display:block;width:100%;height:auto}
    .footer{flex-shrink:0;display:flex;flex-wrap:wrap;gap:8px;justify-content:end;align-items:center;margin-top:16px}
    .status{flex-shrink:0;font-size:14px;margin:8px 0 0}
    .picker{pointer-events:auto;position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;background:transparent;border:0;border-radius:0;cursor:crosshair;box-shadow:none;overflow:hidden}
    .picker::backdrop{background:transparent}
    .hint{position:absolute;top:12px;left:50%;transform:translateX(-50%);max-width:90vw;padding:8px 14px;background:var(--card);color:var(--card-foreground);border:1px solid var(--border);font-size:14px;pointer-events:none}
    .box{position:fixed;border:2px solid var(--ring);background:transparent;pointer-events:none}
  `
  shadow.append(style)
  document.documentElement.append(host)
  let capturing = false
  let selecting = false
  let previewUrl: string | undefined

  async function message(type: string, extra: Record<string, unknown> = {}) {
    const result = await chrome.runtime.sendMessage({ type: `screenshot:${type}`, token, ...extra })
    if (!result?.ok) throw new Error(result?.error || "Screenshot failed")
    return result
  }
  function close() {
    controller.abort()
    host.remove()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (state.__zedScreenshotClose === close) delete state.__zedScreenshotClose
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
    void message("end").catch(() => {})
  }
  state.__zedScreenshotClose = close
  window.addEventListener("pagehide", close, { once: true, signal })
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopImmediatePropagation()
      close()
    }
    if (capturing && [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) event.preventDefault()
  }, { capture: true, signal })
  for (const name of ["wheel", "touchmove"] as const) {
    window.addEventListener(name, (event) => { if (capturing || selecting) event.preventDefault() }, { passive: false, capture: true, signal })
  }
  function check() {
    if (signal.aborted) throw new Error("Capture cancelled")
    if (document.visibilityState !== "visible") throw new Error("Keep this tab visible during capture")
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  function button(label: string, className = "") {
    const result = document.createElement("button")
    result.type = "button"
    result.textContent = label
    result.className = className
    return result
  }
  function dialog(title: string) {
    const result = document.createElement("dialog")
    result.className = "preview"
    result.setAttribute("aria-label", title)
    const header = document.createElement("div")
    header.className = "header"
    const heading = document.createElement("h2")
    heading.textContent = title
    const dismiss = button("×", "close")
    dismiss.setAttribute("aria-label", "Close screenshot preview")
    dismiss.onclick = close
    header.append(heading, dismiss)
    result.append(header)
    result.addEventListener("cancel", (event) => { event.preventDefault(); close() })
    shadow.append(result)
    result.showModal()
    return result
  }
  function showError(error: unknown) {
    if (signal.aborted) return
    shadow.querySelectorAll("dialog").forEach((node) => node.remove())
    const panel = dialog("Screenshot failed")
    const text = document.createElement("p")
    text.setAttribute("role", "alert")
    text.textContent = error instanceof Error ? error.message : String(error)
    panel.append(text)
  }
  function documentRect(element: Element): Rect {
    const box = element.getBoundingClientRect()
    return { x: box.left + scrollX, y: box.top + scrollY, width: box.width, height: box.height }
  }

  async function select(): Promise<Rect> {
    const { screenshotArea } = mode === "area" ? await chrome.storage.local.get<{ screenshotArea?: Rect }>("screenshotArea") : {}
    check()
    selecting = true
    return new Promise((resolve, reject) => {
      const picker = document.createElement("div")
      picker.popover = "manual"
      picker.setAttribute("role", "dialog")
      picker.className = "picker"
      picker.tabIndex = 0
      const hint = document.createElement("div")
      hint.className = "hint"
      hint.id = "instructions"
      hint.textContent = mode === "area"
        ? "Drag an area. Keyboard: arrows move, Shift+arrows resize, Enter captures. Escape cancels."
        : "Click an element. Keyboard: ↑ parent, ↓ child, ←/→ siblings, Enter captures. Escape cancels."
      picker.setAttribute("aria-label", mode === "area" ? "Select screenshot area" : "Select screenshot element")
      picker.setAttribute("aria-describedby", hint.id)
      const box = document.createElement("div")
      box.className = "box"
      let rect: Rect = { x: Math.round(innerWidth / 4), y: Math.round(innerHeight / 4), width: Math.round(innerWidth / 2), height: Math.round(innerHeight / 2) }
      if (screenshotArea && (["x", "y", "width", "height"] as const).every((key) => typeof screenshotArea[key] === "number" && Number.isFinite(screenshotArea[key])) && screenshotArea.width > 0 && screenshotArea.height > 0) {
        rect.width = Math.min(innerWidth, screenshotArea.width)
        rect.height = Math.min(innerHeight, screenshotArea.height)
        rect.x = Math.max(0, Math.min(innerWidth - rect.width, screenshotArea.x))
        rect.y = Math.max(0, Math.min(innerHeight - rect.height, screenshotArea.y))
      }
      let element: Element = document.body
      let start: { x: number; y: number } | undefined
      function draw() {
        Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` })
      }
      function point(event: PointerEvent) {
        return { x: Math.max(0, Math.min(innerWidth, event.clientX)), y: Math.max(0, Math.min(innerHeight, event.clientY)) }
      }
      function pick(x: number, y: number) {
        picker.style.visibility = "hidden"
        const target = document.elementFromPoint(x, y)
        picker.style.visibility = "visible"
        if (target && target !== host) element = target
        const bounds = element.getBoundingClientRect()
        rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        draw()
      }
      async function finish() {
        if (rect.width < 1 || rect.height < 1) return
        if (mode === "area") {
          try { await chrome.storage.local.set({ screenshotArea: rect }) }
          catch (error) { reject(error); return }
          if (signal.aborted) return
        }
        selecting = false
        picker.hidePopover()
        picker.remove()
        resolve(mode === "element" ? documentRect(element) : { ...rect, x: rect.x + scrollX, y: rect.y + scrollY })
      }
      signal.addEventListener("abort", () => reject(new Error("Capture cancelled")), { once: true })
      picker.addEventListener("cancel", (event) => { event.preventDefault(); close() })
      picker.addEventListener("pointerdown", (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (event.button !== 0) return
        if (mode === "element") { pick(event.clientX, event.clientY); return }
        start = point(event)
        picker.setPointerCapture(event.pointerId)
        rect = { ...start, width: 0, height: 0 }
        draw()
      })
      picker.addEventListener("pointermove", (event) => {
        if (mode === "element") { pick(event.clientX, event.clientY); return }
        if (!start) return
        const end = point(event)
        rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
        draw()
      })
      picker.addEventListener("pointerup", (event) => {
        if (event.button !== 0) return
        if (mode === "element" || start) finish()
      })
      picker.addEventListener("keydown", (event) => {
        if (event.key === "Tab") { event.preventDefault(); return }
        if (event.key === "Enter") { event.preventDefault(); finish(); return }
        if (!event.key.startsWith("Arrow")) return
        event.preventDefault()
        if (mode === "element") {
          element = (event.key === "ArrowUp" ? element.parentElement : event.key === "ArrowDown" ? element.firstElementChild : event.key === "ArrowLeft" ? element.previousElementSibling : element.nextElementSibling) || element
          const bounds = element.getBoundingClientRect()
          rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
        } else {
          const dx = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0
          const dy = event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0
          if (event.shiftKey) {
            rect.width = Math.max(1, Math.min(innerWidth - rect.x, rect.width + dx))
            rect.height = Math.max(1, Math.min(innerHeight - rect.y, rect.height + dy))
          } else {
            rect.x = Math.max(0, Math.min(innerWidth - rect.width, rect.x + dx))
            rect.y = Math.max(0, Math.min(innerHeight - rect.height, rect.y + dy))
          }
        }
        draw()
      })
      picker.append(box, hint)
      shadow.append(picker)
      picker.showPopover()
      picker.focus()
      if (mode === "element") pick(innerWidth / 2, innerHeight / 2)
      else draw()
    })
  }

  async function capture(rect: Rect): Promise<HTMLCanvasElement> {
    check()
    capturing = true
    const original = { x: scrollX, y: scrollY }
    const viewport = { width: innerWidth, height: innerHeight, scale: devicePixelRatio }
    const canvas = document.createElement("canvas")
    const pixelWidth = Math.round(rect.width * viewport.scale)
    const pixelHeight = Math.round(rect.height * viewport.scale)
    if (!pixelWidth || !pixelHeight || pixelWidth > 32767 || pixelHeight > 32767 || pixelWidth * pixelHeight > 64_000_000) {
      capturing = false
      throw new Error("This capture exceeds the browser's image size limit. Select a smaller area or element.")
    }
    canvas.width = pixelWidth
    canvas.height = pixelHeight
    const context = canvas.getContext("2d")
    if (!context) { capturing = false; throw new Error("The browser could not allocate the screenshot image") }
    const restore: (() => void)[] = []
    function change(element: HTMLElement | SVGElement, property: string, value: string) {
      const old = element.style.getPropertyValue(property)
      const priority = element.style.getPropertyPriority(property)
      element.style.setProperty(property, value, "important")
      restore.push(() => old ? element.style.setProperty(property, old, priority) : element.style.removeProperty(property))
    }
    try {
      if (mode === "element") {
        for (const element of [document.documentElement, document.body]) {
          change(element, "scroll-behavior", "auto")
          change(element, "scroll-snap-type", "none")
          change(element, "overflow-anchor", "none")
        }
      }
      for (let y = rect.y; y < rect.y + rect.height; y += viewport.height) {
        for (let x = rect.x; x < rect.x + rect.width; x += viewport.width) {
          check()
          if (mode === "element") window.scrollTo({ left: x, top: y, behavior: "instant" as ScrollBehavior })
          await wait(100)
          check()
          if (innerWidth !== viewport.width || innerHeight !== viewport.height || devicePixelRatio !== viewport.scale) throw new Error("The viewport changed during capture. Try again.")
          host.style.setProperty("visibility", "hidden", "important")
          const result = await message("frame")
          check()
          const bytes = Uint8Array.from(atob(result.image.split(",")[1]), (char) => char.charCodeAt(0))
          const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
          try {
            const width = Math.min(viewport.width, rect.x + rect.width - x)
            const height = Math.min(viewport.height, rect.y + rect.height - y)
            const current = { x: scrollX, y: scrollY }
            if (x < current.x - 1 || y < current.y - 1 || x + width > current.x + viewport.width + 1 || y + height > current.y + viewport.height + 1) {
              throw new Error("The page cannot scroll to the selected content. Capture its visible area instead.")
            }
            const sx = bitmap.width / innerWidth
            const sy = bitmap.height / innerHeight
            const sourceX = x - current.x
            const sourceY = y - current.y
            const left = Math.round((x - rect.x) * viewport.scale)
            const top = Math.round((y - rect.y) * viewport.scale)
            const right = Math.round((x - rect.x + width) * viewport.scale)
            const bottom = Math.round((y - rect.y + height) * viewport.scale)
            context.drawImage(bitmap, sourceX * sx, sourceY * sy, width * sx, height * sy, left, top, right - left, bottom - top)
          } finally { bitmap.close() }
        }
      }
      return canvas
    } finally {
      if (mode === "element") window.scrollTo({ left: original.x, top: original.y, behavior: "instant" as ScrollBehavior })
      for (const undo of restore.reverse()) undo()
      host.style.removeProperty("visibility")
      capturing = false
    }
  }

  function preview(dataUrl: string) {
    check()
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (char) => char.charCodeAt(0))
    const blob = new Blob([bytes], { type: "image/png" })
    previewUrl = URL.createObjectURL(blob)
    const panel = dialog("Screenshot preview")
    const image = document.createElement("div")
    image.className = "image"
    image.tabIndex = 0
    image.setAttribute("aria-label", "Screenshot image. Scroll to inspect the full capture.")
    const screenshot = document.createElement("img")
    screenshot.onerror = () => showError(new Error("Could not load screenshot preview"))
    screenshot.src = previewUrl
    screenshot.alt = "Captured screenshot"
    image.append(screenshot)
    const footer = document.createElement("div")
    footer.className = "footer"
    const status = document.createElement("p")
    status.className = "status"
    status.setAttribute("role", "status")
    // An extension-origin button can write PNGs on HTTP pages as well as HTTPS.
    const copy = document.createElement("iframe")
    copy.src = chrome.runtime.getURL("screenshot-clipboard.html")
    copy.title = "Copy screenshot to clipboard"
    copy.allow = "clipboard-write *"
    copy.style.cssText = "width:180px;height:44px;border:0;max-width:100%"
    const copyOrigin = new URL(copy.src).origin
    window.addEventListener("message", (event) => {
      if (event.source !== copy.contentWindow || event.origin !== copyOrigin) return
      if (event.data?.type === "zed-screenshot-copy-ready") {
        if (blob.size > 24 * 1024 * 1024) {
          status.textContent = "Image is too large to copy. Use Download instead."
          return
        }
        copy.contentWindow?.postMessage({ type: "zed-screenshot-image", dark, image: dataUrl }, copyOrigin)
      } else if (event.data?.type === "zed-screenshot-close") {
        close()
      } else if (event.data?.type === "zed-screenshot-copy" && typeof event.data.message === "string") {
        status.textContent = event.data.message
      }
    }, { signal })
    const download = document.createElement("a")
    download.className = "download"
    download.textContent = "Download"
    download.href = previewUrl
    download.download = `zed-screenshot-${new Date().toISOString().replace(/[:.]/g, "-")}.png`
    const edit = button("Edit")
    edit.setAttribute("aria-label", "Edit screenshot in miniPaint (opens a new tab)")
    edit.onclick = async () => {
      edit.disabled = true
      status.textContent = "Opening miniPaint…"
      try {
        if (blob.size > 36 * 1024 * 1024 - 32) throw new Error("This image is too large to send to miniPaint. Use Download to open it manually.")
        await message("edit", { image: dataUrl })
        status.textContent = "Image opened in miniPaint"
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Could not open miniPaint. Try again."
      } finally { edit.disabled = false }
    }
    footer.append(copy, edit, download)
    panel.append(image, footer, status)
  }

  // The popup must close before selection or the first visible-area capture.
  void wait(250).then(async () => {
    check()
    let rect: Rect
    if (mode === "area" || mode === "element") rect = await select()
    else if (mode === "full") {
      const result = await message("full")
      preview(result.image)
      return
    } else rect = { x: scrollX, y: scrollY, width: innerWidth, height: innerHeight }
    preview((await capture(rect)).toDataURL("image/png"))
  }).catch(showError)
}
