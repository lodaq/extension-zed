import { changeSaved } from "./lib/saved"
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
  if (["saved:add", "saved:remove"].includes(data?.type)) {
    void changeSaved(data).then(reply, error => reply({ ok: false, error: String(error) }))
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "zed-save-text", title: "Save text to Zed", contexts: ["selection"] })
  })
})
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "zed-save-text") return
  void changeSaved({ type: "saved:text", text: info.selectionText, url: info.frameUrl || info.pageUrl })
    .then(() => showResult({ ok: true, saved: true, tabId: tab?.id }),
      error => showResult({ ok: false, saved: false, tabId: tab?.id, error: String(error) }))
    .catch(console.error)
})
