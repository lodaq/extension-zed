import { installSystemSiteLimiter, reportSystemForeground, systemSiteLimiter } from "./lib/systemSiteLimiter"
import { installSiteLimiter, updateSiteLimiter } from "./lib/siteLimiterWorker"
import { changeSaved } from "./lib/saved"
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
  if (typeof data?.type === "string" && data.type.startsWith("limiter:")) {
    if (sender.tab || sender.url !== chrome.runtime.getURL("index.html")) return
    if (data.type === "limiter:system-status" || (data.type === "limiter:add" && data.system === true)) {
      const run = async () => {
        if (data.type === "limiter:add") await reportSystemForeground()
        return systemSiteLimiter(data.type === "limiter:add" ? "add" : "status", data)
      }
      void run()
        .then(rules => reply({ ok: true, rules }), error => reply({ ok: false, error: String(error) }))
      return true
    }
    if (data.type !== "limiter:add" && data.type !== "limiter:list") return
    void updateSiteLimiter(data.type === "limiter:add" ? data : undefined)
      .then(rules => reply({ ok: true, rules }), error => reply({ ok: false, error: String(error) }))
    return true
  }
  if (["saved:add", "saved:remove"].includes(data?.type)) {
    void changeSaved(data).then(reply, error => reply({ ok: false, error: String(error) }))
    return true
  }
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
chrome.runtime.onInstalled.addListener(() => {
  void installShortcutsInOpenTabs().catch(console.error)
})
chrome.runtime.onStartup.addListener(() => { void installShortcutsInOpenTabs().catch(console.error) })

// Extension reloads also restart the worker without a browser-startup event.
void installShortcutsInOpenTabs().catch(console.error)


// Tab events wake a lazy worker after reload, without opening the popup.
chrome.tabs.onActivated.addListener(({ tabId }) => { void installShortcutsInOpenTabs(tabId).catch(console.error) })
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === "complete") void installShortcutsInOpenTabs(tabId).catch(console.error)
})

function installSaveMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "zed-save-text", title: "Save text to Zed", contexts: ["selection"] })
    chrome.contextMenus.create({ id: "zed-save-link", title: "Save link to Zed", contexts: ["link"], targetUrlPatterns: ["https://*.facebook.com/*", "https://*.instagram.com/*", "https://*.youtube.com/*", "https://youtu.be/*"] })
  })
}
// A worker restart also repairs menus missing after an unpacked reload.
installSaveMenu()
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "zed-save-text" && info.menuItemId !== "zed-save-link") return
  void changeSaved(info.menuItemId === "zed-save-link"
    ? { type: "saved:add", url: info.linkUrl }
    : { type: "saved:text", text: info.selectionText, url: info.frameUrl || info.pageUrl })
    .then(() => showResult({ ok: true, saved: true, tabId: tab?.id }),
      error => showResult({ ok: false, saved: false, tabId: tab?.id, error: String(error) }))
    .catch(console.error)
})

if (chrome.alarms && chrome.declarativeNetRequest) installSiteLimiter()

if (chrome.alarms && chrome.declarativeNetRequest && typeof chrome.management?.getSelf === "function") installSystemSiteLimiter()
