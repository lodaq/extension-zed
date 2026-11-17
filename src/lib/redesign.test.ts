import { isRestrictedPage } from "./withActiveTab"
import { describe, expect, it } from "vitest"
import { readSetting } from "./settings"
import { normalizeLink } from "./links"
import { readShortcuts, recordCombo, SHORTCUT_ACTIONS, DEFAULT_SHORTCUTS } from "./shortcuts"
describe('redesign data rules',()=>{
 it('normalizes URL identity without losing its destination',()=>{
  expect(normalizeLink(' https://www.example.com/ ')).toEqual({url:'www.example.com',href:'https://www.example.com/',title:'example.com'})
  expect(normalizeLink('example.com')?.href).toBe('https://example.com')
  expect(normalizeLink(' ')).toBeNull()
  expect(normalizeLink('chrome://settings', 'Settings', true)?.href).toBe('chrome://settings')
  expect(normalizeLink('https://')).toBeNull()
 })
 it('reads saved links and rejects executable imported destinations',()=>{
  const links=[normalizeLink('example.com')]
  expect(readSetting('savedLinks',links,[])).toEqual(links)
  expect(readSetting('savedLinks',[{url:'bad',title:'bad',href:'javascript:alert(1)'}],[])).toEqual([])
 })
 it('detects restricted URLs without blocking lookalike domains',()=>{
  expect(isRestrictedPage('chrome://settings')).toBe(true)
  expect(isRestrictedPage('https://chromewebstore.google.com/detail/test')).toBe(true)
  expect(isRestrictedPage('https://chrome.google.com/webstore/category/extensions')).toBe(true)
  expect(isRestrictedPage('https://chromewebstore.google.com.example.com/')).toBe(false)
  expect(isRestrictedPage('https://example.com')).toBe(false)
 })
 it('provides 28 page actions and 20 total defaults',()=>{expect(SHORTCUT_ACTIONS).toHaveLength(28);expect(Object.values(DEFAULT_SHORTCUTS).filter(Boolean)).toHaveLength(20)})
 it('uses physical letter codes and accepts Cmd shortcuts',()=>{
  const event={key:'ф',code:'KeyA',ctrlKey:false,altKey:true,shiftKey:true,metaKey:false}
  expect(recordCombo(event)).toBe('Alt+Shift+A')
  expect(recordCombo({...event,altKey:false,shiftKey:false,metaKey:true})).toBe("Cmd+A")
  expect(recordCombo({...event,key:'Shift',code:'ShiftLeft'})).toBeNull()
 })
})

it("validates popup locations including nested tools", () => {
 const location = { tab: "Misc", detail: "playback", settings: false }
 expect(readSetting("popupLocation", location, null)).toEqual(location)
 expect(readSetting("popupLocation", { ...location, detail: "unknown" }, null)).toBeNull()
})

it("preserves save shortcuts edited inside Zed", () => {
 expect(readShortcuts({ action20: "Alt+Shift+S" }).action20).toBe("Alt+Shift+S")
})

 it("keeps popup assignments and merges defaults into older settings", () => {
  const bindings = readShortcuts({ action0: "Cmd+K", tab0: "", hints: "G" })
  expect(bindings.action0).toBe("Cmd+K")
  expect(bindings.tab0).toBe("")
  expect(bindings.tab1).toBe("2")
  expect(bindings.hints).toBe("G")
  expect(readSetting("keyboardShortcuts", bindings, null)).toEqual(bindings)
 })
 it("allows plain popup bindings while requiring page modifiers", () => {
  const event = { key: "f", code: "KeyF", ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }
  expect(recordCombo(event, true)).toBe("F")
  expect(() => recordCombo(event)).toThrow()
 })

it("defaults Extensions to 2 and Settings to S while preserving custom assignments", () => {
  expect(readShortcuts({ tab0: "1" })).toMatchObject({ tab1: "2", tab6: "S" })
  expect(readShortcuts({ tab1: "E", tab6: "G" })).toMatchObject({ tab1: "E", tab6: "G" })
})
