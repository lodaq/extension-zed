import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { expect, it, vi } from "@/test/bun-test"

it("renders every inspection detail as text and removes listeners when disabled", async () => {
  interface Element {
    className: string; textContent: string; hidden: boolean; style: Record<string, string>; children: Element[]
    append(...nodes: Element[]): void
    appendChild(node: Element): void
    replaceChildren(): void
    getBoundingClientRect(): { left: number; top: number; width: number; height: number }
    remove: ReturnType<typeof vi.fn>
    setAttribute: ReturnType<typeof vi.fn>
    contains(): boolean
  }
  function element(): Element {
    return {
      className: "", textContent: "", hidden: false, style: {} as Record<string, string>, children: [] as Element[],
      append(...nodes: Element[]) { this.children.push(...nodes) },
      appendChild(node: Element) { this.children.push(node) },
      replaceChildren() { this.children = [] },
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 100, height: 50 }),
      remove: vi.fn(), setAttribute: vi.fn(), contains: () => false,
    }
  }
  const box = element(), panel = element()
  const shadow = { innerHTML: "", querySelector: (selector: string) => selector === ".box" ? box : panel, appendChild: vi.fn() }
  const overlay = { ...element(), classList: { toggle: vi.fn() }, attachShadow: () => shadow }
  const listeners = new Map<string, (event: unknown) => void>()
  let changed!: (changes: object, area: string) => void
  const set = vi.fn(async () => {})
  const removeListener = vi.fn()
  const window = { innerWidth: 1000, innerHeight: 800 }
  const css = {
    marginTop: "1px", marginRight: "2px", marginBottom: "3px", marginLeft: "4px",
    paddingTop: "5px", paddingRight: "6px", paddingBottom: "7px", paddingLeft: "8px",
    borderTopWidth: "9px", borderRightWidth: "10px", borderBottomWidth: "11px", borderLeftWidth: "12px",
    boxSizing: "border-box", color: "red", backgroundColor: "blue", opacity: "0.5", borderTopColor: "green",
    display: "block", position: "static", fontSize: "14px", fontFamily: "Inter", lineHeight: "20px", zIndex: "auto",
  }
  let createdOverlay = false
  await runInNewContext(readFileSync(new URL("../../public/scripts/inspectMode.js", import.meta.url), "utf8"), {
    window, Node: { ELEMENT_NODE: 1 }, getComputedStyle: () => css,
    document: {
      createElement: (tag: string) => { if (tag === "div" && !createdOverlay) { createdOverlay = true; return overlay }; return element() },
      documentElement: { appendChild: vi.fn() },
      addEventListener: (type: string, callback: (event: unknown) => void) => listeners.set(type, callback),
      removeEventListener: (type: string) => listeners.delete(type),
    },
    chrome: { runtime: { getURL: (path: string) => path }, storage: {
      local: { get: async () => ({ inspectMode: "on" }), set },
      onChanged: { addListener: (callback: typeof changed) => { changed = callback }, removeListener },
    } },
  })
  listeners.get("mousemove")!({ target: { nodeType: 1, tagName: "DIV", id: "<img onerror=bad>", classList: ["first", "second"], getBoundingClientRect: box.getBoundingClientRect }, clientX: 100, clientY: 100 })
  expect(panel.children[0].textContent).toBe("<div> #<img onerror=bad> .first.second")
  const sections = panel.children.slice(3).map(section => [section.textContent, section.children.map(row => row.children.map(span => span.textContent))])
  expect(sections).toEqual([
    ["Box model", [["margin", "1px 2px 3px 4px"], ["padding", "5px 6px 7px 8px"], ["border", "9px 10px 11px 12px"], ["box-sizing", "border-box"]]],
    ["Visual", [["color", "red"], ["background", "blue"], ["opacity", "0.5"], ["border-color", "green"]]],
    ["Layout & type", [["display", "block"], ["position", "static"], ["font", "14px Inter"], ["line-height", "20px"], ["z-index", "auto"]]],
  ])
  listeners.get("keydown")!({ key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() })
  expect(set).toHaveBeenCalledWith({ inspectMode: "off" })
  changed({ inspectMode: { newValue: "off" } }, "local")
  expect(overlay.remove).toHaveBeenCalledOnce()
  expect(listeners.size).toBe(0)
  expect(removeListener).toHaveBeenCalledOnce()
})
