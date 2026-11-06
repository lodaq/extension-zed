import { expect, it } from "vitest"
import { moveMiscSection } from "./miscSectionOrder"
import { MISC_SECTION_ORDER } from "./settings"

it("moves a section forward without swapping intervening sections", () => {
  expect(moveMiscSection(MISC_SECTION_ORDER, 0, 3)).toEqual(["playback", "volume", "quality", "password", "colors", "scrollbars", "modes"])
  expect(MISC_SECTION_ORDER[0]).toBe("password")
})

it("moves a section backward", () => {
  expect(moveMiscSection(MISC_SECTION_ORDER, 6, 0)).toEqual(["modes", "password", "playback", "volume", "quality", "colors", "scrollbars"])
})

it.each([[0, 0], [0, -1], [6, 7], [-1, 2]])("ignores unchanged or out-of-range moves (%i, %i)", (from, to) => {
  expect(moveMiscSection(MISC_SECTION_ORDER, from, to)).toEqual(MISC_SECTION_ORDER)
})
