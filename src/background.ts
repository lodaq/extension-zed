import { openSavedLink } from "./lib/links"
import { executeShortcut } from "./lib/shortcutExecution"
import { handleScreenshotMessage } from "./lib/screenshots"
import { handlePageAction, type PageActionResult } from "./lib/pageActions"

async function showResult(result: PageActionResult) {
  if (result.tabId === undefined) {
    if (!result.ok) console.error(result.error)
    return
  }
  await Promise.all([
    chrome.action.setBadgeText({ tabId: result.tabId, text: result.ok ? "" : "!" }),
    chrome.action.setTitle({ tabId: result.tabId, title: result.ok ? "Extension Zed" : result.error ?? "Page action failed" }),
  ])
}

chrome.runtime.onMessage.addListener((data, sender, reply) => {
  if (sender.id !== chrome.runtime.id) return
  // Opening a tab closes the popup; finish removing the link in the worker.
  if (data?.type === "zed:open-link") {
    if (sender.tab || sender.url !== chrome.runtime.getURL("index.html")) return
    void openSavedLink(data.link).then(() => reply({ ok: true }), error => reply({ ok: false, error: String(error) }))
    return true
  }
  if (data?.type === "zed:shortcut") {
    const fromPopup = !sender.tab && sender.url === chrome.runtime.getURL("index.html")
    if (!fromPopup && (sender.tab?.id === undefined)) return
    const run = async () => {
      const tabId = sender.tab?.id ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id
      if (tabId === undefined) throw new Error("Current tab is unavailable")
      return executeShortcut(data.id, tabId)
    }
    void run().then(result=>reply({ok:true,...result && typeof result === "object" ? result : {}}),error=>reply({ok:false,error:String(error)}))
    return true
  }
  if (typeof data?.type === "string" && data.type.startsWith("screenshot:")) {
    void handleScreenshotMessage(data, sender).then(reply, (error) => reply({ ok: false, error: String(error.message || error) }))
    return true
  }
  void handlePageAction(data).then(async (result) => {
    await showResult(result).catch(console.error)
    reply(result)
  })
  return true
})


// Existing documents do not receive newly installed content scripts until navigation.
async function installShortcutsInOpenTabs(tabId?: number) {
  const tabs = tabId === undefined ? await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }) : [{ id: tabId }]
  await Promise.all(tabs.map(async tab => {
    if (tab.id === undefined) return
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["scripts/shortcuts.js"],
      })
    } catch {
      // Browser-protected pages and tabs closed during installation cannot be scripted.
    }
  }))
}
chrome.runtime.onInstalled.addListener(() => { void installShortcutsInOpenTabs().catch(console.error) })
chrome.runtime.onStartup.addListener(() => { void installShortcutsInOpenTabs().catch(console.error) })

// Extension reloads also restart the worker without a browser-startup event.
void installShortcutsInOpenTabs().catch(console.error)


// Tab events wake a lazy worker after reload, without opening the popup.
chrome.tabs.onActivated.addListener(({ tabId }) => { void installShortcutsInOpenTabs(tabId).catch(console.error) })
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "complete") void installShortcutsInOpenTabs(tabId).catch(console.error)
})
