const alphabet = "adfghjklqwertyuiopzxcvbnm"
export const HINT_MODES = [
  { id: "always", label: "Always show keyboard hints", description: "Hints appear whenever a screen opens." },
  { id: "shortcut", label: "Show when F is pressed", description: "Press F to show click hints." },
  { id: "off", label: "Disabled (never shown)", description: "Hints never appear, even when F is pressed." },
] as const
export type HintMode = (typeof HINT_MODES)[number]["id"]
export const DEFAULT_HINT_MODE: HintMode = "shortcut"
export const isHintMode = (value: unknown): value is HintMode => HINT_MODES.some(mode => mode.id === value)

export function hintLabels(count: number): string[] {
  const width = Math.max(1, Math.ceil(Math.log(Math.max(1, count)) / Math.log(alphabet.length)))
  return Array.from({ length: count }, (_, index) => {
    let label = ""
    for (let digit = 0; digit < width; digit++) { label = alphabet[index % alphabet.length] + label; index = Math.floor(index / alphabet.length) }
    return label
  })
}

function hintTargets(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('main button, main a[href], main input:not([type="hidden"]), main select, main textarea, main [role="switch"], main [role="checkbox"], main summary')].filter(node => {
    if (node.matches(':disabled, [aria-disabled="true"]') || node.closest('[inert], [hidden], .zed-tabbar, .zed-settings')) return false
    const rect = node.getBoundingClientRect()
    if (!rect.width || !rect.height || getComputedStyle(node).visibility !== "visible") return false
    const x = Math.max(0, rect.left) + Math.min(rect.width, innerWidth - Math.max(0, rect.left)) / 2
    const y = Math.max(0, rect.top) + Math.min(rect.height, innerHeight - Math.max(0, rect.top)) / 2
    const top = document.elementFromPoint(x, y)
    return y > 0 && x > 0 && !!top && (node === top || node.contains(top))
  })
}

const VOID_ELEMENTS = new Set(["INPUT", "SELECT", "TEXTAREA", "IMG", "VIDEO", "AUDIO", "CANVAS", "IFRAME", "OBJECT", "EMBED", "BR", "HR", "SOURCE", "TRACK", "WBR"])

function positionHint(element: HTMLElement, target: HTMLElement) {
  element.style.left = "auto"
  element.style.transform = ""
  if (getComputedStyle(target).position !== "static") {
    Object.assign(element.style, { position: "absolute", top: "0", right: "0" })
    return
  }
  const rect = target.getBoundingClientRect()
  const parent = target.offsetParent as HTMLElement | null
  if (!parent) {
    Object.assign(element.style, { position: "fixed", top: `${rect.top}px`, right: `${Math.max(0, innerWidth - rect.right)}px` })
    return
  }
  const parentRect = parent.getBoundingClientRect()
  Object.assign(element.style, { position: "absolute", top: `${rect.top - parentRect.top - parent.clientTop}px`, right: `${parentRect.right - rect.right - parent.clientLeft}px` })
}

export function showClickHints(persistent = false): () => void {
  let targets: HTMLElement[] = [], labels: string[] = [], badges: { element: HTMLElement; target: HTMLElement }[] = [], prefix = '', disposed = false
  let observer: MutationObserver | undefined, redraw: ReturnType<typeof setTimeout> | undefined
  const capture = { capture: true }
  const positions = () => badges.forEach(({ element, target }) => { if (element.isConnected !== false) positionHint(element, target) })
  const showAll = () => badges.forEach(({ element }) => { element.hidden = false })
  const detach = () => { badges.forEach(({ element }) => element.remove()); badges = [] }
  const render = () => {
    detach()
    targets = hintTargets()
    labels = hintLabels(targets.length)
    prefix = ''
    badges = targets.map((target, index) => {
      const element = document.createElement('kbd')
      element.className = 'zed-key zed-tab-key zed-hint'
      element.setAttribute('aria-hidden', 'true')
      element.textContent = labels[index]
      const host = VOID_ELEMENTS.has(target.tagName) ? target.parentElement : target
      if (host) { host.append(element); positionHint(element, target) }
      return { element, target }
    })
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    if (redraw) clearTimeout(redraw)
    observer?.disconnect()
    detach()
    window.removeEventListener('keydown', keydown, capture)
    window.removeEventListener('scroll', onViewportChange, capture)
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('pointerdown', onPointer, capture)
  }
  const activate = (index: number) => { const target = targets[index]; if (target?.isConnected) { target.focus(); target.click() } }
  const keydown = (event: KeyboardEvent) => {
    if (event.isComposing || event.repeat || event.key === 'Shift') return
    const key = (/^Key[A-Z]$/.test(event.code) ? event.code.slice(3) : event.key).toLowerCase()
    if (persistent) {
      if (event.key === 'Escape' || document.querySelector('dialog[open], [role="dialog"]')) return
      const target = event.target as HTMLElement | null
      if ((target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) || event.ctrlKey || event.metaKey || event.altKey) return
      const next = prefix + key
      if (!labels.some(label => label.startsWith(next))) { prefix = ''; showAll(); return }
      event.preventDefault(); event.stopImmediatePropagation()
      prefix = next
      const index = labels.indexOf(prefix)
      if (index >= 0) { prefix = ''; showAll(); activate(index); return }
    } else {
      if (key === 's' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) { cleanup(); return }
      event.preventDefault(); event.stopImmediatePropagation()
      if (event.key === 'Escape' || event.ctrlKey || event.metaKey || event.altKey) { cleanup(); return }
      prefix += key
      const index = labels.indexOf(prefix)
      if (index >= 0) { cleanup(); activate(index); return }
      if (!labels.some(label => label.startsWith(prefix))) { cleanup(); return }
    }
    badges.forEach(({ element }, index) => { element.hidden = !labels[index].startsWith(prefix) })
  }
  const onViewportChange = () => { if (persistent) positions(); else cleanup() }
  const onPointer = () => { if (!persistent) { cleanup(); return } prefix = ''; showAll(); positions() }

  render()
  window.addEventListener('keydown', keydown, capture)
  window.addEventListener('scroll', onViewportChange, capture)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('pointerdown', onPointer, capture)
  if (persistent && typeof MutationObserver !== "undefined") {
    const root = document.querySelector("main")
    if (root) {
      observer = new MutationObserver(records => {
        const relevant = records.some(record => record.type !== "childList" ||
          [...record.addedNodes, ...record.removedNodes].some(node => (node as HTMLElement).classList?.contains("zed-hint") !== true))
        if (!relevant || redraw || disposed) return
        redraw = setTimeout(() => { redraw = undefined; if (!disposed) render() }, 50)
      })
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "disabled", "aria-disabled"] })
    }
  }
  return cleanup
}
