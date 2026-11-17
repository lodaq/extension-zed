import { afterEach, describe, expect, it, vi } from "vitest"
import { hintLabels, showClickHints } from "./clickHints"

afterEach(() => vi.unstubAllGlobals())

function mountHints(count = 1) {
  const window = new EventTarget()
  const targets = Array.from({ length: count }, () => ({
    matches: () => false, closest: () => null, contains: () => true, isConnected: true,
    getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, width: 100, height: 30 }),
    focus: vi.fn(), click: vi.fn(),
  }))
  const overlay = { className: '', setAttribute: vi.fn(), append: vi.fn(), remove: vi.fn(), children: [] }
  vi.stubGlobal('window', window)
  vi.stubGlobal('innerWidth', 640)
  vi.stubGlobal('innerHeight', 600)
  vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }))
  vi.stubGlobal('document', {
    querySelectorAll: () => targets, elementFromPoint: () => ({}), body: { append: vi.fn() },
    createElement: (tag: string) => tag === 'div' ? overlay : { style: {} },
  })
  const cleanup = showClickHints()
  const press = (key: string, code: string) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, code })
    window.dispatchEvent(event)
    return event
  }
  return { targets, overlay, press, cleanup }
}

describe('click hint activation', () => {
  it('leaves S available for Settings while hints are active', () => {
    const { targets, overlay, press, cleanup } = mountHints()
    try {
      expect(press('س', 'KeyS').defaultPrevented).toBe(false)
      expect(overlay.remove).toHaveBeenCalledOnce()
      expect(targets[0].click).not.toHaveBeenCalled()
    } finally { cleanup() }
  })
  it.each(['a', 'ش', 'ф', 'A'])('activates the physical A hint for %s', key => {
    const { targets, overlay, press, cleanup } = mountHints()
    try {
      expect(press(key, 'KeyA').defaultPrevented).toBe(true)
      expect(targets[0].focus).toHaveBeenCalledOnce()
      expect(targets[0].click).toHaveBeenCalledOnce()
      expect(overlay.remove).toHaveBeenCalledOnce()
      press(key, 'KeyA')
      expect(targets[0].click).toHaveBeenCalledOnce()
    } finally { cleanup() }
  })

  it('waits for the complete label and ignores Shift alone', () => {
    const { targets, press, cleanup } = mountHints(27)
    try {
      press('Shift', 'ShiftLeft')
      press('ش', 'KeyA')
      expect(targets.every(target => !target.click.mock.calls.length)).toBe(true)
      press('ش', 'KeyA')
      expect(targets[0].click).toHaveBeenCalledOnce()
    } finally { cleanup() }
  })

  it('dismisses hints with Escape without activating a target', () => {
    const { targets, overlay, press, cleanup } = mountHints()
    try {
      press('Escape', 'Escape')
      press('a', 'KeyA')
      expect(overlay.remove).toHaveBeenCalledOnce()
      expect(targets[0].click).not.toHaveBeenCalled()
    } finally { cleanup() }
  })
})

describe("click hint labels", () => {
  it.each([0, 1, 26, 27, 1000])("gives every one of %i targets a unique unambiguous label", count => {
    const labels = hintLabels(count)
    expect(labels).toHaveLength(count)
    expect(new Set(labels).size).toBe(count)
    expect(new Set(labels.map(label => label.length)).size).toBe(count ? 1 : 0)
    expect(labels.every(label => /^[a-z]+$/.test(label))).toBe(true)
    expect(labels.every(label => !label.includes('s'))).toBe(true)
  })
})
