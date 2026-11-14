import { afterEach, beforeEach, expect, it, vi } from "vitest"
const page=vi.hoisted(()=>vi.fn(async()=>({ok:true})))
vi.mock('./pageActions',()=>({handlePageAction:page}))
vi.mock('./screenshots',()=>({handleScreenshotMessage:vi.fn()}))
import { executeShortcut } from "./shortcutExecution"
beforeEach(()=>{vi.stubGlobal('chrome',{storage:{local:{get:vi.fn(async()=>({volumeBoost:1995})),set:vi.fn()}},tabs:{get:vi.fn(),remove:vi.fn()}})})
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks()})
it('dispatches existing playback contracts and clamps boosted volume',async()=>{
 await executeShortcut('action0',7)
 expect(page).toHaveBeenLastCalledWith({event:'playbackFaster',value:undefined,tabId:7})
 await executeShortcut('action5',7)
 expect(page).toHaveBeenLastCalledWith({event:'volumeBoost',value:2000,tabId:7})
})
it('rejects unknown and unassigned actions',async()=>{
 await expect(executeShortcut('bad',7)).rejects.toThrow('Unknown shortcut')
 await expect(executeShortcut('action2',7)).rejects.toThrow('Shortcut is not assigned')
 expect(page).not.toHaveBeenCalled()
})
