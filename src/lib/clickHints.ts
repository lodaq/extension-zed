const alphabet = "asdfghjklqwertyuiopzxcvbnm"
export function hintLabels(count: number): string[] {
  const width = Math.max(1, Math.ceil(Math.log(Math.max(1, count)) / Math.log(alphabet.length)))
  return Array.from({ length: count }, (_, index) => {
    let label = ""
    for (let digit = 0; digit < width; digit++) {
      label = alphabet[index % alphabet.length] + label
      index = Math.floor(index / alphabet.length)
    }
    return label
  })
}
export function showClickHints(): () => void {
  const targets = [...document.querySelectorAll<HTMLElement>('main button, main a[href], main input:not([type="hidden"]), main select, main textarea, main [role="switch"], main [role="checkbox"], main summary')].filter(node => {
    if (node.matches(':disabled, [aria-disabled="true"]') || node.closest('[inert], [hidden], .zed-tabbar')) return false
    const rect = node.getBoundingClientRect()
    if (!rect.width || !rect.height || getComputedStyle(node).visibility !== "visible") return false
    const x = Math.max(0, rect.left) + Math.min(rect.width, innerWidth - Math.max(0, rect.left)) / 2
    const y = Math.max(0, rect.top) + Math.min(rect.height, innerHeight - Math.max(0, rect.top)) / 2
    const top = document.elementFromPoint(x, y)
    return y > 0 && x > 0 && !!top && (node === top || node.contains(top))
  })
  const labels = hintLabels(targets.length)
  const overlay = document.createElement('div')
  overlay.className = 'zed-hints'
  overlay.setAttribute('aria-hidden', 'true')
  targets.forEach((node, index) => {
    const badge = document.createElement('kbd')
    badge.className = 'zed-key zed-hint'
    badge.textContent = labels[index]
    const rect = node.getBoundingClientRect()
    badge.style.left = `${Math.max(0, Math.min(rect.left, innerWidth - 48))}px`
    badge.style.top = `${Math.max(0, Math.min(rect.top, innerHeight - 24))}px`
    overlay.append(badge)
  })
  document.body.append(overlay)
  let prefix = ''
  const cleanup = () => {
    overlay.remove()
    window.removeEventListener('keydown', keydown, true)
    window.removeEventListener('scroll', cleanup, true)
    window.removeEventListener('resize', cleanup)
    window.removeEventListener('pointerdown', cleanup, true)
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.repeat) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.key === 'Escape' || event.ctrlKey || event.metaKey || event.altKey) { cleanup(); return }
    prefix += event.key.toLowerCase()
    const index = labels.indexOf(prefix)
    if (index >= 0) {
      cleanup()
      const target = targets[index]
      if (target.isConnected) { target.focus(); target.click() }
      return
    }
    if (!labels.some(label => label.startsWith(prefix))) { cleanup(); return }
    Array.from(overlay.children).forEach((badge, index) => { (badge as HTMLElement).hidden = !labels[index].startsWith(prefix) })
  }
  window.addEventListener('keydown', keydown, true)
  window.addEventListener('scroll', cleanup, true)
  window.addEventListener('resize', cleanup)
  window.addEventListener('pointerdown', cleanup, true)
  return cleanup
}
