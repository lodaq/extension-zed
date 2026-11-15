import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"

it("keeps editing enabled on focus and pointer events, then cleans up every listener", () => {
  const handlers = new Map<string, () => void>()
  const events = () => ({
    addEventListener: (type: string, handler: () => void) => handlers.set(type, handler),
    removeEventListener: vi.fn((type: string) => handlers.delete(type)),
  })
  const document = { ...events(), designMode: "off" }
  const window = { ...events(), __zedDesignModeFlag: true }
  const source = readFileSync(new URL("../../public/scripts/designMode.js", import.meta.url), "utf8")
  const run = () => runInNewContext(source, { document, window })
  run()
  expect(document.designMode).toBe("on")
  expect([...handlers.keys()].sort()).toEqual(["focus", "pointerdown", "visibilitychange"])
  for (const listener of handlers.values()) {
    document.designMode = "off"
    listener()
    expect(document.designMode).toBe("on")
  }
  window.__zedDesignModeFlag = false
  run()
  expect(document.designMode).toBe("off")
  expect(handlers.size).toBe(0)
  expect(window.removeEventListener).toHaveBeenCalledWith("focus", expect.any(Function), false)
  expect(document.removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), true)
})

it("awaits the saved design mode when no explicit flag is provided", async () => {
  const source = readFileSync(new URL("../../public/scripts/designMode.js", import.meta.url), "utf8")
  const document = { designMode: "on" }
  const result = runInNewContext(source, { window: {}, document, chrome: { storage: { local: { get: async () => ({ designMode: "off" }) } } } })
  expect(result).toBeInstanceOf(Promise)
  await result
  expect(document.designMode).toBe("off")
})
