import { handlePageAction, requestForCommand, type PageActionResult } from "./lib/pageActions"

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
  void handlePageAction(data).then(async (result) => {
    await showResult(result).catch(console.error)
    reply(result)
  })
  return true
})

chrome.commands.onCommand.addListener((command) => {
  const request = requestForCommand(command)
  if (!request) return
  void handlePageAction(request).then(showResult).catch(console.error)
})
