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

const TARGET_SELECTOR = 'main button, main a[href], main input:not([type="hidden"]), main select, main textarea, main [role="switch"], main [role="checkbox"], main summary'
const VOID_ELEMENTS = new Set(["INPUT", "SELECT", "TEXTAREA"])
const ANCHOR_ATTRIBUTE = "data-zed-hint-anchor"

type HintTarget = { target: HTMLElement; rect: DOMRect }

// Layout is read once per target here; hints never measure on scroll or on every mutation.
function hintTargets(): HintTarget[] {
  const found: HintTarget[] = []
  for (const target of document.querySelectorAll<HTMLElement>(TARGET_SELECTOR)) {
    if (target.matches(':disabled, [aria-disabled="true"]') || target.closest('[inert], [hidden], .zed-tabbar, .zed-settings')) continue
    const rect = target.getBoundingClientRect()
    if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) continue
    const visible = typeof target.checkVisibility === "function" ? target.checkVisibility({ visibilityProperty: true }) : getComputedStyle(target).visibility === "visible"
    if (visible) found.push({ target, rect })
  }
  return found
}

// The badge becomes a child of its control, so the browser moves it on scroll and reflow for free.
function anchorHint(element: HTMLElement, { target, rect }: HintTarget, hosts: Set<HTMLElement>) {
  const isVoid = VOID_ELEMENTS.has(target.tagName)
  const host = isVoid ? target.parentElement : target
  if (!host) return
  const staticHost = getComputedStyle(host).position === "static"
  const hostRect = isVoid ? host.getBoundingClientRect() : null
  if (staticHost) { host.setAttribute(ANCHOR_ATTRIBUTE, ""); hosts.add(host) }
  if (hostRect) {
    element.style.top = `${rect.top - hostRect.top - host.clientTop}px`
    element.style.right = `${hostRect.right - rect.right - host.clientLeft}px`
  }
  host.append(element)
}

export function showClickHints(persistent = false): () => void {
  let targets: HTMLElement[] = [], labels: string[] = [], badges: { element: HTMLElement; target: HTMLElement }[] = [], prefix = '', disposed = false
  const hosts = new Set<HTMLElement>()
  let observer: MutationObserver | undefined, frame: number | undefined
  const capture = { capture: true }
  const showAll = () => badges.forEach(({ element }) => { element.hidden = false })
  const detach = () => { badges.forEach(({ element }) => element.remove()); badges = [] }
  const render = () => {
    const next = hintTargets()
    // shortcut: an unchanged control set is not re-measured, so a layout-only move can leave a field hint slightly off; upgrade to a ResizeObserver if that shows up.
    if (next.length === targets.length && next.every((entry, index) => entry.target === targets[index])) return
    detach()
    targets = next.map(entry => entry.target)
    labels = hintLabels(targets.length)
    prefix = ''
    badges = next.map((entry, index) => {
      const element = document.createElement('kbd')
      element.className = 'zed-key zed-tab-key zed-hint'
      element.setAttribute('aria-hidden', 'true')
      element.textContent = labels[index]
      anchorHint(element, entry, hosts)
      return { element, target: entry.target }
    })
  }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    if (frame !== undefined) cancelAnimationFrame(frame)
    observer?.disconnect()
    detach()
    hosts.forEach(host => host.removeAttribute(ANCHOR_ATTRIBUTE))
    hosts.clear()
    window.removeEventListener('keydown', keydown, capture)
    window.removeEventListener('pointerdown', onPointer, capture)
  }
  const activate = (index: number) => {
    const target = targets[index]
    if (!target?.isConnected || target.matches(':disabled, [aria-disabled="true"]') || target.closest('[hidden], [inert]')) return
    target.focus(); target.click()
  }
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
  const onPointer = () => { if (!persistent) { cleanup(); return } prefix = ''; showAll() }

  render()
  window.addEventListener('keydown', keydown, capture)
  window.addEventListener('pointerdown', onPointer, capture)
  if (persistent && typeof MutationObserver !== "undefined") {
    const root = document.querySelector("main")
    if (root) {
      // Structural changes and disabled flips matter; our own badges are ignored so renders never trigger themselves.
      observer = new MutationObserver(records => {
        if (disposed || frame !== undefined) return
        const relevant = records.some(record => record.type === "attributes" ||
          [...record.addedNodes, ...record.removedNodes].some(node => (node as Element).classList?.contains("zed-hint") !== true))
        if (!relevant) return
        frame = requestAnimationFrame(() => { frame = undefined; if (!disposed) render() })
      })
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "aria-disabled"] })
    }
  }
  return cleanup
}
