import { afterEach, describe, expect, it, vi } from "@/test/bun-test"
import { DEFAULT_HINT_MODE, HINT_MODES, hintLabels, isHintMode, showClickHints } from "./clickHints"

afterEach(() => vi.unstubAllGlobals())

describe("keyboard hint modes", () => {
  it("offers always, F shortcut and disabled modes with a shortcut default", () => {
    expect(HINT_MODES.map(mode => mode.id)).toEqual(["always", "shortcut", "off"])
    expect(DEFAULT_HINT_MODE).toBe("shortcut")
    expect(isHintMode("always")).toBe(true)
    expect(isHintMode("shortcut")).toBe(true)
    expect(isHintMode("off")).toBe(true)
    expect(isHintMode("sometimes")).toBe(false)
    expect(isHintMode(null)).toBe(false)
  })
})

type TestBadge = {
  style: Record<string, string>
  hidden: boolean
  className: string
  isConnected: boolean
  removed: boolean
  setAttribute: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

function mountHints(count = 1, persistent = false, tags = Array.from({ length: count }, () => "BUTTON")) {
  const window = new EventTarget()
  const badges: TestBadge[] = []
  const parent = { children: [] as unknown[], append: vi.fn((node: unknown) => { parent.children.push(node) }) }
  const targets = tags.map(tagName => ({
    tagName, style: {}, matches: () => false, closest: () => null, contains: () => true, isConnected: true,
    parentElement: parent, children: [] as unknown[],
    append: vi.fn(function (this: unknown, node: unknown) { (this as { children: unknown[] }).children.push(node) }),
    getBoundingClientRect: () => ({ left: 10, top: 10, right: 110, width: 100, height: 30 }),
    focus: vi.fn(), click: vi.fn(),
  }))
  vi.stubGlobal('window', window)
  vi.stubGlobal('innerWidth', 640)
  vi.stubGlobal('innerHeight', 600)
  vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible', position: 'relative' }))
  vi.stubGlobal('document', {
    querySelectorAll: () => targets, querySelector: () => null, elementFromPoint: () => ({}),
    createElement: () => {
      const badge: TestBadge = {
        style: {}, hidden: false, className: '', isConnected: true, removed: false,
        setAttribute: vi.fn(),
        remove: vi.fn(() => { badge.removed = true }),
      }
      badges.push(badge)
      return badge
    },
  })
  const cleanup = showClickHints(persistent)
  const press = (key: string, code: string) => {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { key, code })
    window.dispatchEvent(event)
    return event
  }
  return { targets, badges, parent, press, cleanup, window }
}

describe('click hint activation', () => {
  it('leaves S available for Settings while hints are active', () => {
    const { targets, badges, press, cleanup } = mountHints()
    try {
      expect(press('س', 'KeyS').defaultPrevented).toBe(false)
      expect(badges[0].remove).toHaveBeenCalledOnce()
      expect(targets[0].click).not.toHaveBeenCalled()
    } finally { cleanup() }
  })
  it.each(['a', 'ش', 'ф', 'A'])('activates the physical A hint for %s', key => {
    const { targets, badges, press, cleanup } = mountHints()
    try {
      expect(press(key, 'KeyA').defaultPrevented).toBe(true)
      expect(targets[0].focus).toHaveBeenCalledOnce()
      expect(targets[0].click).toHaveBeenCalledOnce()
      expect(badges[0].remove).toHaveBeenCalledOnce()
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
    const { targets, badges, press, cleanup } = mountHints()
    try {
      press('Escape', 'Escape')
      press('a', 'KeyA')
      expect(badges[0].remove).toHaveBeenCalledOnce()
      expect(targets[0].click).not.toHaveBeenCalled()
    } finally { cleanup() }
  })

  it('keeps always-on hints visible through Escape, activation, pointer input, scrolling and resizing', () => {
    const { targets, badges, press, cleanup, window } = mountHints(1, true)
    try {
      expect(press('Escape', 'Escape').defaultPrevented).toBe(false)
      expect(badges[0].remove).not.toHaveBeenCalled()
      expect(press('a', 'KeyA').defaultPrevented).toBe(true)
      expect(targets[0].focus).toHaveBeenCalledOnce()
      expect(targets[0].click).toHaveBeenCalledOnce()
      expect(badges[0].remove).not.toHaveBeenCalled()
      window.dispatchEvent(new Event('pointerdown'))
      window.dispatchEvent(new Event('scroll'))
      window.dispatchEvent(new Event('resize'))
      expect(badges[0].remove).not.toHaveBeenCalled()
      expect(press('a', 'KeyA').defaultPrevented).toBe(true)
      expect(targets[0].click).toHaveBeenCalledTimes(2)
      expect(targets[0].focus).toHaveBeenCalledTimes(2)
    } finally { cleanup() }
  })

  it('inserts each hint inside its element at the top right', () => {
    const { targets, badges, cleanup } = mountHints()
    try {
      expect(targets[0].append).toHaveBeenCalledWith(badges[0])
      expect(badges[0].className).toContain('zed-hint')
      expect(badges[0].setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
      expect(badges[0].style.top).toBe('0')
      expect(badges[0].style.right).toBe('0')
    } finally { cleanup() }
  })

  it('places hints for fields that cannot contain children in their parent', () => {
    const { badges, parent, cleanup } = mountHints(1, false, ['INPUT'])
    try {
      expect(parent.append).toHaveBeenCalledWith(badges[0])
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
