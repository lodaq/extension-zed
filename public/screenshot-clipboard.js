const copy = document.querySelector("button")
let image
let parentOrigin
let imageData
let token

function report(message) {
  parent.postMessage({ type: "zed-screenshot-copy", message }, parentOrigin)
}
window.addEventListener("message", (event) => {
  if (event.source !== parent || event.data?.type !== "zed-screenshot-image" || image) return
  const data = event.data.image
  if (typeof data !== "string" || !data.startsWith("data:image/png;base64,") || data.length > 32 * 1024 * 1024) return
  try {
    const bytes = Uint8Array.from(atob(data.split(",")[1]), (char) => char.charCodeAt(0))
    document.documentElement.classList.toggle("dark", event.data.dark !== false)
    parentOrigin = event.origin
    imageData = data
    token = event.data.token
    // An image document uses Chrome's native image copy, outside Clipboard API policy.
    image = document.createElement("iframe")
    // display:none would copy only HTML, without the PNG image.
    image.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;border:0"
    image.tabIndex = -1
    image.setAttribute("aria-hidden", "true")
    image.onload = () => { copy.disabled = false }
    image.src = URL.createObjectURL(new Blob([bytes], { type: "image/png" }))
    document.body.append(image)
  } catch { /* Ignore malformed messages from the embedding page. */ }
})
copy.addEventListener("click", async (event) => {
  if (!event.isTrusted || !image || copy.disabled) return
  copy.disabled = true
  try {
    const result = await chrome.runtime.sendMessage({ type: "screenshot:copy", token, image: imageData })
    if (!result?.ok) throw new Error(result?.error || "Copy failed")
    if (result.nativeCopy) {
      image.contentWindow.focus()
      if (!image.contentDocument.execCommand("copy")) throw new Error("Copy failed")
    }
    report("Copied to clipboard")
  } catch (error) {
    report(`Clipboard copy failed: ${error.message || error}. Try again or use Download.`)
  } finally {
    copy.disabled = false
    copy.focus({ preventScroll: true })
  }
})
parent.postMessage({ type: "zed-screenshot-copy-ready" }, "*")

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && parentOrigin) {
    event.preventDefault()
    parent.postMessage({ type: "zed-screenshot-close" }, parentOrigin)
  }
})
