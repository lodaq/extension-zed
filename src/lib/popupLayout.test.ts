import { afterEach, expect, it, vi } from "vitest"
import { fitPopup } from "./popupLayout"

afterEach(() => vi.unstubAllGlobals())

it.each([
  [0, -125, 640, "515px"],
  [-1920, -2045, 640, "515px"],
  [0, -600, 640, "200px"],
  [0, 100, 640, null],
  [-1920, -1800, 640, null],
])("fits the popup to its monitor (%s, %s, %s)", (availLeft, screenX, innerWidth, expected) => {
  const setProperty = vi.fn()
  vi.stubGlobal("screen", { availLeft })
  vi.stubGlobal("window", { screenX, innerWidth })
  vi.stubGlobal("document", { documentElement: { style: { setProperty } } })
  fitPopup()
  if (expected) expect(setProperty).toHaveBeenCalledWith("--zed-popup-width", expected)
  else expect(setProperty).not.toHaveBeenCalled()
})
