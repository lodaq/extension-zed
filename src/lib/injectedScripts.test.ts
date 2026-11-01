/// <reference types="node" />
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

const script = (name: string) => readFileSync(new URL(`../../public/scripts/${name}.js`, import.meta.url), "utf8")

describe("injected script completion", () => {
  it.each(["applyPageColors", "inspectMode", "youtubeProgressBar", "youtubeControls", "volumeBoost", "arabicRtlMode"])("%s returns its asynchronous work", async (name) => {
    let finish!: (value: Record<string, unknown>) => void
    const get = new Promise<Record<string, unknown>>((resolve) => { finish = resolve })
    const result = runInNewContext(script(name), {
      chrome: { storage: { local: { get: () => get } } },
      window: { __zedVolumeBoost: { setGain: () => {} }, __zedArabicRtlApply: () => {} },
      location: { origin: "https://example.com" },
      document: { getElementById: () => null },
    })
    expect(typeof result?.then).toBe("function")
    let completed = false
    const pending = result.then(() => { completed = true })
    await Promise.resolve()
    expect(completed).toBe(false)
    finish({})
    await pending
    expect(completed).toBe(true)
  })

  it("does not interpolate malformed stored colors into CSS", async () => {
    const createElement = vi.fn()
    const remove = vi.fn()
    await runInNewContext(script("applyPageColors"), {
      chrome: { storage: { local: { get: async () => ({ "pageColors:https://example.com": { text: "red; } body { display:none" } }) } } },
      location: { origin: "https://example.com" },
      document: { getElementById: () => ({ remove }), createElement },
    })
    expect(createElement).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
  })
})
