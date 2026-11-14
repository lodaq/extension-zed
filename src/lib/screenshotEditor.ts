const EDITOR_URL = "https://viliusle.github.io/miniPaint/"

// Injected into miniPaint's page context: keep this function self-contained.
export async function sendScreenshotToEditor(image: string): Promise<boolean> {
  if (location.origin !== "https://viliusle.github.io" || !location.pathname.startsWith("/miniPaint/")) return false
  const editor = window as Window & {
    FileOpen?: { file_open_data_url_handler: (image: string) => void }
    AppConfig?: { layers: { id: number; name: string; width: number; height: number }[] }
  }
  const deadline = Date.now() + 15_000
  const wait = () => new Promise((resolve) => setTimeout(resolve, 25))
  while (!editor.FileOpen || !editor.AppConfig?.layers) {
    if (Date.now() >= deadline) return false
    await wait()
  }
  const previous = new Set(editor.AppConfig.layers.map((layer) => layer.id))
  editor.FileOpen.file_open_data_url_handler(image)
  while (!editor.AppConfig.layers.some((layer) => !previous.has(layer.id) && layer.name === "Data URL" && layer.width > 0 && layer.height > 0)) {
    if (Date.now() >= deadline) return false
    await wait()
  }
  return true
}

export async function openScreenshotEditor(image: unknown) {
  // Stay below Chrome's extension message limit; never silently reduce image quality.
  if (typeof image !== "string" || image.length > 48 * 1024 * 1024 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    throw new Error("Could not send this image to the editor. Use Download to open it manually.")
  }
  const tab = await chrome.tabs.create({ url: EDITOR_URL })
  if (tab.id === undefined) throw new Error("Could not open miniPaint")
  const deadline = Date.now() + 15_000
  while ((await chrome.tabs.get(tab.id)).status !== "complete") {
    if (Date.now() >= deadline) throw new Error("miniPaint took too long to load. Try Edit again.")
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id }, world: "MAIN", func: sendScreenshotToEditor, args: [image],
  })
  if (!result?.result) throw new Error("miniPaint could not open the image. Try Edit again or use Download.")
}
