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
  if (data?.type === "zed:shortcut") {
    if (sender.tab?.id === undefined || sender.frameId !== 0) return
    void executeShortcut(data.id, sender.tab.id).then(result=>reply({ok:true,...result && typeof result === "object" ? result : {}}),error=>reply({ok:false,error:String(error)}))
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
