import { isRestrictedPage } from "./withActiveTab"
import { describe, expect, it } from "vitest"
import { readSetting } from "./settings"
import { normalizeLink } from "./links"
import { recordCombo, SHORTCUT_ACTIONS, DEFAULT_SHORTCUTS } from "./shortcuts"
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
 it('provides 28 actions and 11 defaults',()=>{expect(SHORTCUT_ACTIONS).toHaveLength(28);expect(Object.values(DEFAULT_SHORTCUTS).filter(Boolean)).toHaveLength(11)})
 it('uses physical letter codes and rejects Meta alone',()=>{
  const event={key:'ф',code:'KeyA',ctrlKey:false,altKey:true,shiftKey:true,metaKey:false}
  expect(recordCombo(event)).toBe('Alt+Shift+A')
  expect(()=>recordCombo({...event,altKey:false,shiftKey:false,metaKey:true})).toThrow('Add Ctrl, Alt or Shift')
  expect(recordCombo({...event,key:'Shift',code:'ShiftLeft'})).toBeNull()
 })
})
