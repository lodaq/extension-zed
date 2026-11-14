type CaptureState = { x: number; y: number; panel?: HTMLElement; left: number; top: number }
type CaptureWindow = Window & { __zedNativeCapture?: CaptureState }

// Self-contained because executeScript serializes the function into the tab.
export async function measureFullPage() {
  const state: CaptureState = { x: scrollX, y: scrollY, left: 0, top: 0 }
  const viewport = { width: innerWidth, height: innerHeight, scale: devicePixelRatio, expandedHeight: 0 }
  if (document.documentElement.scrollHeight <= innerHeight + 1) {
    let area = 0
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      if (element.clientHeight < innerHeight / 2 || element.clientWidth < innerWidth / 2 || element.scrollHeight <= element.clientHeight + 1) continue
      const css = getComputedStyle(element)
      if (!/^(auto|scroll)$/.test(css.overflowY) || css.visibility === "hidden") continue
      const box = element.getBoundingClientRect()
      if (box.top < -1 || box.left < -1 || box.bottom > innerHeight + 1 || box.right > innerWidth + 1) continue
      const visibleArea = element.clientWidth * element.clientHeight
      if (visibleArea <= area) continue
      area = visibleArea
      state.panel = element
      state.left = element.scrollLeft
      state.top = element.scrollTop
      viewport.expandedHeight = Math.ceil(innerHeight + element.scrollHeight - element.clientHeight)
    }
  }
  const target = window as CaptureWindow
  target.__zedNativeCapture = state
  // Native clips place fixed headers at the current scroll offset in the document image.
  if (state.x !== 0 || state.y !== 0) {
    window.scrollTo({ left: 0, top: 0, behavior: "instant" as ScrollBehavior })
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 250)
      requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve() }))
    })
  }
  return viewport
}

export async function restoreFullPage() {
  const target = window as CaptureWindow
  const state = target.__zedNativeCapture
  delete target.__zedNativeCapture
  if (!state) return
  // Clearing emulation completes before the page has necessarily laid out at its original size.
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 250)
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve() }))
  })
  if (state.panel?.isConnected && (state.panel.scrollLeft !== state.left || state.panel.scrollTop !== state.top)) {
    state.panel.scrollTo({ left: state.left, top: state.top, behavior: "instant" as ScrollBehavior })
  }
  if (scrollX !== state.x || scrollY !== state.y) window.scrollTo({ left: state.x, top: state.y, behavior: "instant" as ScrollBehavior })
}

export async function captureFullPage(tabId: number): Promise<string> {
  const target = { tabId }
  try {
    await chrome.debugger.attach(target, "1.3")
  } catch {
    throw new Error("Cannot start browser capture. Close DevTools or another debugger on this tab and try again.")
  }
  let expanded = false
  try {
    const [measurement] = await chrome.scripting.executeScript({ target, func: measureFullPage })
    const viewport = measurement?.result
    if (!viewport) throw new Error("Could not measure the page")
    const { scale } = viewport
    const zoom = await chrome.tabs.getZoom(tabId)
    function validateSize(width: number, height: number) {
      const w = Math.ceil(width * scale)
      const h = Math.ceil(height * scale)
      if (w <= 0 || h <= 0 || w > 32767 || h > 32767 || w * h > 64_000_000) {
        throw new Error("This page exceeds the browser's image size limit. Select a smaller area or element.")
      }
    }
    if (viewport.expandedHeight > viewport.height) {
      validateSize(viewport.width, viewport.expandedHeight)
      expanded = true
      await chrome.debugger.sendCommand(target, "Emulation.setDeviceMetricsOverride", {
        width: Math.round(viewport.width * zoom), height: Math.round(viewport.expandedHeight * zoom),
        deviceScaleFactor: viewport.scale / zoom, mobile: false, dontSetVisibleSize: true,
      })
    }
    const metrics = await chrome.debugger.sendCommand(target, "Page.getLayoutMetrics") as { cssContentSize?: { width: number; height: number } }
    const size = metrics.cssContentSize
    if (!size) throw new Error("Could not measure the full page")
    validateSize(size.width, size.height)
    const width = Math.ceil(size.width)
    async function captureStrip(y: number, height: number) {
      const image = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
        format: "png", fromSurface: true, captureBeyondViewport: true, optimizeForSpeed: true,
        clip: { x: 0, y: y * zoom, width: width * zoom, height: height * zoom, scale: 1 },
      }) as { data?: string }
      if (!image.data) throw new Error("The browser returned an empty screenshot")
      return image.data
    }
    const height = Math.ceil(size.height)
    // Headful Brave can repeat pixels in viewport-sized clips; leave room for browser UI resizing.
    const stripSize = Math.max(1, Math.floor(viewport.height / 2))
    if (height <= stripSize) return `data:image/png;base64,${await captureStrip(0, height)}`

    const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale))
    try {
      const context = canvas.getContext("2d")
      if (!context) throw new Error("Could not allocate screenshot image")
      for (let y = 0; y < height; y += stripSize) {
        const stripHeight = Math.min(stripSize, height - y)
        const data = await captureStrip(y, stripHeight)
        const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }))
        try {
          const top = Math.round(y * scale)
          const bottom = y + stripHeight === height ? canvas.height : Math.round((y + stripHeight) * scale)
          context.drawImage(bitmap, 0, top, canvas.width, bottom - top)
        } finally { bitmap.close() }
      }
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer())
      let binary = ""
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
      return `data:image/png;base64,${btoa(binary)}`
    } finally {
      canvas.width = canvas.height = 0
    }
  } finally {
    if (expanded) await chrome.debugger.sendCommand(target, "Emulation.clearDeviceMetricsOverride").catch(() => {})
    await chrome.scripting.executeScript({ target, func: restoreFullPage }).catch(() => {})
    await chrome.debugger.detach(target).catch(() => {})
  }
}
