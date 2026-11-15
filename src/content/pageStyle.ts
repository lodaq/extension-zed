// Serialized by executeScript; this function must not capture module state.
export function applyPageStyle(id: string, css: string) {
  document.getElementById(id)?.remove()
  if (!css) return
  const style = document.createElement("style")
  style.id = id
  style.textContent = css
  ;(document.head || document.documentElement).appendChild(style)
}
