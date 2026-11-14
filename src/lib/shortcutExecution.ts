import { handlePageAction } from "./pageActions"
import { handleScreenshotMessage } from "./screenshots"
import { generatePassword } from "./passwordGenerator"
import { addLink } from "./links"
import { SHORTCUT_ACTIONS, readShortcuts } from "./shortcuts"
import { MODE_KEYS, BOOLEAN_KEYS, type PageActionRequest } from "./actionRegistry"

export async function executeShortcut(id: string, tabId: number) {
  const action = SHORTCUT_ACTIONS.find(a => a.id === id)
  if (!action) throw new Error("Unknown shortcut")
  const stored = await chrome.storage.local.get(null)
  if (!readShortcuts(stored.keyboardShortcuts)[id]) throw new Error("Shortcut is not assigned")
  const page = async (event: PageActionRequest['event'], value?: number | boolean) => {
    const result = await handlePageAction({ event, value, tabId })
    if (!result.ok) throw new Error(result.error || "Page action failed")
  }
  const toggles: Record<string, PageActionRequest['event']> = { action13: "inspectModeApply", action14: "designMode", action15: "arabicRtlMode", action21: "youtubeFocus", action22: "hideYoutubeProgressBar", action23: "hideYoutubeDuration", action24: "hideYoutubeControls", action25: "youtubeHalfScreen" }
  if (toggles[id]) { const event = toggles[id]; const key = MODE_KEYS[event] ?? BOOLEAN_KEYS[event]; return page(event, MODE_KEYS[event] ? stored[key] !== "on" : !stored[key]) }
  switch (id) {
    case "action0": return page("playbackFaster")
    case "action1": return page("playbackSlower")
    case "action2": return page("playbackRateApply", 1)
    case "action3": case "action4": await chrome.storage.local.set({ videoQualityFallback: id === "action3" ? "higher" : "lower" }); return page("applyVideoQuality")
    case "action5": case "action6": return page("volumeBoost", Math.min(2000, Math.max(100, Number(stored.volumeBoost ?? 100) + (id === "action5" ? 10 : -10))))
    case "action7": return page("volumeBoost", 100)
    case "action8": return { password: generatePassword({ length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true }) }
    case "action9": return page("applyCustomScrollbar")
    case "action10": return page("hideMainScrollBar")
    case "action11": return page("hideAllScrollBars")
    case "action12": await page("resetCustomScrollbar"); await page("resetMainScrollBar"); return page("resetAllScrollBars")
    case "action16": case "action17": case "action18": case "action19": return handleScreenshotMessage({ type: "screenshot:start", mode: ({ action16: "area", action17: "visible", action18: "full", action19: "element" } as Record<string, string>)[id] }, { url: chrome.runtime.getURL("index.html") })
    case "action20": { const tab = await chrome.tabs.get(tabId); if (!tab.url) throw new Error("Current tab is unavailable"); await addLink(tab.url, tab.title, true); return chrome.tabs.remove(tabId) }
    case "action26": return chrome.storage.local.set({ darkTheme: stored.darkTheme === false })
    case "action27": return chrome.storage.local.set({ blackAndWhite: !stored.blackAndWhite })
  }
}
