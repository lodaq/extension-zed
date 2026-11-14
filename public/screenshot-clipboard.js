const copy = document.querySelector("button")
const owner = window.opener || parent
const separateWindow = parent === window && !!window.opener
let image
let imageData
let parentOrigin
let copyWindow

function report(message) {
  owner.postMessage({ type: "zed-screenshot-copy", message }, parentOrigin)
}
function openCopyWindow() {
  copyWindow = window.open(chrome.runtime.getURL("screenshot-clipboard.html"), "zed-screenshot-copy", "popup,width=360,height=140")
  if (!copyWindow) report("Allow the copy window, then try Copy again.")
}
async function copyImage() {
  copy.disabled = true
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": image })])
    report("Copied to clipboard")
    if (separateWindow) window.close()
  } catch {
    if (!separateWindow) openCopyWindow()
    else report("Clipboard copy failed. Try again or use Download.")
  } finally { copy.disabled = false }
}
window.addEventListener("message", (event) => {
  if (copyWindow && event.source === copyWindow && event.origin === location.origin) {
    if (event.data?.type === "zed-screenshot-copy-ready") {
      copyWindow.postMessage({ type: "zed-screenshot-image", image: imageData, dark: document.documentElement.classList.contains("dark") }, location.origin)
    } else if (event.data?.type === "zed-screenshot-copy") report(event.data.message)
    return
  }
  if (event.source !== owner || event.data?.type !== "zed-screenshot-image" || image) return
  if (separateWindow && event.origin !== location.origin) return
  const data = event.data.image
  if (typeof data !== "string" || !data.startsWith("data:image/png;base64,") || data.length > 32 * 1024 * 1024) return
  try {
    const bytes = Uint8Array.from(atob(data.split(",")[1]), (char) => char.charCodeAt(0))
    document.documentElement.classList.toggle("dark", event.data.dark !== false)
    image = new Blob([bytes], { type: "image/png" })
    imageData = data
    parentOrigin = event.origin
    copy.disabled = false
    if (separateWindow) void copyImage()
  } catch { /* Ignore malformed messages from the embedding page. */ }
})
copy.addEventListener("click", (event) => {
  if (!event.isTrusted || !image) return
  if (!separateWindow && document.featurePolicy?.allowsFeature("clipboard-write") === false) openCopyWindow()
  else void copyImage()
})
owner.postMessage({ type: "zed-screenshot-copy-ready" }, "*")

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && parentOrigin) {
    event.preventDefault()
    if (separateWindow) window.close()
    else owner.postMessage({ type: "zed-screenshot-close" }, parentOrigin)
  }
})
