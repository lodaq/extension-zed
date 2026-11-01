/// <reference types="node" />
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it } from "vitest"

async function page() {
  const operations: string[] = []
  class Element {
    nodeType = 1
    children: Element[] = []
    attributes = new Map<string, string>()
    values = new Map<string, [string, string]>()
    style = {
      getPropertyValue: (key: string) => this.values.get(key)?.[0] ?? "",
      getPropertyPriority: (key: string) => this.values.get(key)?.[1] ?? "",
      setProperty: (key: string, value: string, priority = "") => { operations.push("write"); this.values.set(key, [value, priority]) },
      removeProperty: (key: string) => { operations.push("write"); this.values.delete(key) },
    }
    constructor(public textContent: string, public renderedText = textContent) {}
    get innerText() { operations.push("read"); return this.renderedText }
    hasAttribute(key: string) { return this.attributes.has(key) }
    setAttribute(key: string, value: string) { operations.push("write"); this.attributes.set(key, value) }
    removeAttribute(key: string) { operations.push("write"); this.attributes.delete(key) }
    querySelectorAll(selector: string): Element[] {
      const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll("*")])
      return selector.startsWith("[") ? descendants.filter((child) => child.hasAttribute("data-arabic-rtl-fixed")) : descendants
    }
  }
  const body = new Element("English introduction")
  const window: Record<string, unknown> = {}
  let onMutation: (mutations: { addedNodes: Element[] }[]) => void = () => {}
  const document = {
    body,
    querySelectorAll: (selector: string) => [body, ...body.querySelectorAll("*")].filter((el) => !selector.startsWith("[") || el.hasAttribute("data-arabic-rtl-fixed")),
  }
  await runInNewContext(readFileSync(new URL("../../public/scripts/arabicRtlMode.js", import.meta.url), "utf8"), {
    window, document, HTMLElement: Element, Node: { ELEMENT_NODE: 1 },
    chrome: { storage: { local: { get: async () => ({ arabicRtlMode: "off" }) } } },
    MutationObserver: class {
      constructor(callback: typeof onMutation) { onMutation = callback }
      observe() {}
      disconnect() {}
    },
  })
  return { Element, body, operations, apply: window.__zedArabicRtlApply as (enabled: boolean) => void,
    mutate: (roots: Element[]) => onMutation([{ addedNodes: roots }]) }
}

it("reads the entire subtree before writing direction or alignment", async () => {
  const p = await page()
  p.body.children = [new p.Element("مرحبا"), new p.Element("العربية")]
  p.apply(true)
  expect(p.operations.indexOf("write")).toBeGreaterThan(p.operations.lastIndexOf("read"))
})

it("batches reads across all added roots in one mutation delivery", async () => {
  const p = await page()
  p.apply(true)
  const roots = [new p.Element("مرحبا"), new p.Element("العربية")]
  p.body.children = roots
  p.operations.length = 0
  p.mutate(roots)
  expect(p.operations.indexOf("write")).toBeGreaterThan(p.operations.lastIndexOf("read"))
  expect(roots.every((el) => el.attributes.get("dir") === "rtl")).toBe(true)
})

it("preserves rendered-text detection, explicit directions, and original inline alignment", async () => {
  const p = await page()
  const arabic = new p.Element("Hidden English text", "  123 مرحبا")
  arabic.style.setProperty("text-align", "left", "important")
  const english = new p.Element("مرحبا hidden", "English text")
  const explicit = new p.Element("مرحبا")
  explicit.setAttribute("dir", "ltr")
  p.body.children = [arabic, english, explicit]
  p.apply(true)
  expect(arabic.attributes.get("dir")).toBe("rtl")
  expect(arabic.values.get("text-align")).toEqual(["right", "important"])
  expect(english.attributes.has("dir")).toBe(false)
  expect(explicit.attributes.get("dir")).toBe("ltr")
  p.apply(false)
  expect(arabic.attributes.has("dir")).toBe(false)
  expect(arabic.values.get("text-align")).toEqual(["left", "important"])
  expect(explicit.attributes.get("dir")).toBe("ltr")
})
