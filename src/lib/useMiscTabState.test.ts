import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useMiscExpandedSections, useMiscSectionReorder } from "./useMiscTabState"
import { MISC_SECTION_ORDER, type MiscSectionId } from "./settings"

const sectionsMock: Record<MiscSectionId, { title: string }> = {
  password: { title: "Password generator" },
  playback: { title: "Playback speed" },
  volume: { title: "Volume boost" },
  quality: { title: "Video quality" },
  scrollbars: { title: "Scrollbars" },
  modes: { title: "Modes" },
  screenshot: { title: "Capture screenshot" },
}

let storedValues: Record<string, unknown>
let storageSet: ReturnType<typeof vi.fn>

const stateSlots: unknown[] = []
let slotIndex = 0

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react")
  return {
    ...actual,
    useState: <T>(initial: T | (() => T)) => {
      const idx = slotIndex++
      if (stateSlots.length <= idx) {
        stateSlots[idx] = typeof initial === "function" ? (initial as () => T)() : initial
      }
      const setter = (next: T | ((prev: T) => T)) => {
        stateSlots[idx] =
          typeof next === "function" ? (next as (prev: T) => T)(stateSlots[idx] as T) : next
      }
      return [stateSlots[idx], setter]
    },
    useCallback: (fn: (...args: unknown[]) => unknown) => fn,
    useRef: <T>(initial: T) => ({ current: initial }),
    useEffect: (effect: () => void | (() => void)) => {
      effect?.()
    },
  }
})

beforeEach(() => {
  storedValues = {}
  stateSlots.length = 0
  slotIndex = 0
  storageSet = vi.fn(async (patch: Record<string, unknown>) => {
    Object.assign(storedValues, patch)
  })
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async () => ({ ...storedValues })),
        set: storageSet,
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useMiscExpandedSections", () => {
  it("initializes with empty expanded state", () => {
    slotIndex = 0
    const hook = useMiscExpandedSections()
    expect(hook.expandedSections).toEqual([])
    expect(hook.isSectionOpen("playback")).toBe(false)
    expect(hook.isSectionRendered("playback")).toBe(false)
  })

  it("updates state on open and maintains rendered status", () => {
    slotIndex = 0
    let hook = useMiscExpandedSections()

    hook.setSectionOpen("playback", true)
    slotIndex = 0
    hook = useMiscExpandedSections()

    expect(hook.isSectionOpen("playback")).toBe(true)
    expect(hook.isSectionRendered("playback")).toBe(true)

    hook.setSectionOpen("playback", false)
    slotIndex = 0
    hook = useMiscExpandedSections()

    expect(hook.isSectionOpen("playback")).toBe(false)
    expect(hook.isSectionRendered("playback")).toBe(true)
  })
})

describe("useMiscSectionReorder", () => {
  it("initializes with default section order", () => {
    slotIndex = 0
    const hook = useMiscSectionReorder(sectionsMock)
    expect(hook.order).toEqual(MISC_SECTION_ORDER)
    expect(hook.dragging).toBeNull()
    expect(hook.dropTarget).toBeNull()
  })

  it("moves section and triggers order persistence", async () => {
    slotIndex = 0
    let hook = useMiscSectionReorder(sectionsMock)

    await hook.move(0, 1)
    slotIndex = 0
    hook = useMiscSectionReorder(sectionsMock)

    expect(hook.announcement).toContain("Moved Password generator to position 2 of 7")
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        miscSectionOrder: ["playback", "password", "volume", "quality", "scrollbars", "modes", "screenshot"],
      })
    )
  })

  it("cancels drag cleanly", () => {
    slotIndex = 0
    const hook = useMiscSectionReorder(sectionsMock)
    hook.cancelDrag()
    expect(hook.dragging).toBeNull()
    expect(hook.dropTarget).toBeNull()
  })
})
