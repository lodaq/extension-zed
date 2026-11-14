import { afterEach, expect, it, vi } from "vitest"
import { openSavedLink, saveCurrentTab } from "./links"

afterEach(() => vi.unstubAllGlobals())

it("saves the command's tab before closing it, even if focus changes", async () => {
  const tab = { id: 7, url: "https://www.meta.ai/", title: "Meta AI" } as chrome.tabs.Tab
  const query = vi.fn()
  const set = vi.fn(async () => {})
  const remove = vi.fn()
  vi.stubGlobal("chrome", {
    tabs: { query, remove },
    storage: { local: { get: async () => ({}), set } },
  })
  await saveCurrentTab(tab)
  expect(query).not.toHaveBeenCalled()
  expect(set).toHaveBeenCalledWith({ savedLinks: [{ url: "www.meta.ai", href: tab.url, title: tab.title }] })
  expect(remove).toHaveBeenCalledWith(7)
  expect(set.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0])
})

it("keeps the tab open if saving fails", async () => {
  const remove = vi.fn()
  vi.stubGlobal("chrome", {
    tabs: { remove },
    storage: { local: { get: async () => ({}), set: async () => { throw new Error("Storage failed") } } },
  })
  await expect(saveCurrentTab({ id: 7, url: "https://example.com/" } as chrome.tabs.Tab)).rejects.toThrow("Storage failed")
  expect(remove).not.toHaveBeenCalled()
})

it("opens a saved link before removing it, preserving other saved links", async () => {
  const link = { url: "example.com", href: "https://example.com/", title: "Example" }
  const other = { url: "other.com", href: "https://other.com", title: "Other" }
  const create = vi.fn(async () => ({}))
  const set = vi.fn(async () => {})
  vi.stubGlobal("chrome", {
    tabs: { create },
    storage: { local: { get: async () => ({ savedLinks: [other, link] }), set } },
  })
  await openSavedLink(link)
  expect(create).toHaveBeenCalledWith({ url: link.href })
  expect(set).toHaveBeenCalledWith({ savedLinks: [other] })
  expect(create.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[0])
})

it("keeps the saved link when opening fails", async () => {
  const set = vi.fn()
  vi.stubGlobal("chrome", {
    tabs: { create: async () => { throw new Error("Could not open") } },
    storage: { local: { set } },
  })
  await expect(openSavedLink({ url: "example.com", href: "https://example.com/", title: "Example" })).rejects.toThrow("Could not open")
  expect(set).not.toHaveBeenCalled()
})
