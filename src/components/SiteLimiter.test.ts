import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import SiteLimiter from "./SiteLimiter"

it("starts with ordinary timed blocking and leaves administrator protection explicitly opt-in", () => {
  const html = renderToStaticMarkup(createElement(SiteLimiter))
  const advanced = html.match(/<details>[\s\S]*?<\/details>/)?.[0]
  expect(advanced).toContain("Advanced: administrator protection")
  expect(advanced).toContain('name="system"')
  expect(advanced?.match(/<input[^>]*name="system"[^>]*>/)?.[0]).not.toContain("checked")
  expect(html.indexOf('name="url"')).toBeLessThan(html.indexOf("<details>"))
  expect(html).toMatch(/<input[^>]*type="radio"[^>]*name="mode"[^>]*checked=""/)
  expect(html).toContain("Block website</button>")
  expect(html).not.toContain('disabled=""')
})
