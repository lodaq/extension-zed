import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "@/test/bun-test"

const source = readFileSync(new URL("../../public/scripts/linkedinPosts.js", import.meta.url), "utf8")

it("resolves SDUI text/video cards, skips neighboring React owners, and updates recycled cards", () => {
  const attributes: Record<string, string> = { componentkey: "update-card-focusFirst" }
  const card = {
    __reactProps$test: {
      _owner: { id: "commentCount-urn:li:activity:999" },
      children: { _payload: { value: 'serialized "commentCount-urn:li:ugcPost:123"' } },
    },
    getAttribute: (key: string) => attributes[key] ?? null,
    setAttribute: (key: string, value: string) => { attributes[key] = value },
    removeAttribute: (key: string) => { delete attributes[key] },
  }
  let scan!: () => void
  const win = { top: null as unknown }
  win.top = win
  runInNewContext(source, {
    window: win,
    document: { documentElement: {}, querySelectorAll: () => [card] },
    MutationObserver: class { constructor(callback: () => void) { scan = callback } observe() {} },
    setTimeout: (callback: () => void) => callback(),
  })
  expect(attributes["data-zed-linkedin-url"]).toBe("https://www.linkedin.com/feed/update/urn:li:ugcPost:123/")
  attributes.componentkey = "update-card-focusSecond"
  card.__reactProps$test.children._payload.value = "commentingDisabled-urn:li:activity:456"
  scan()
  expect(attributes["data-zed-linkedin-url"]).toBe("https://www.linkedin.com/feed/update/urn:li:activity:456/")
  attributes.componentkey = "update-card-focusThird"
  card.__reactProps$test.children._payload.value = ""
  scan()
  expect(attributes["data-zed-linkedin-url"]).toBeUndefined()
})

it("does not inspect subframes", () => {
  const querySelectorAll = vi.fn()
  runInNewContext(source, { window: { top: {} }, document: { querySelectorAll } })
  expect(querySelectorAll).not.toHaveBeenCalled()
})
