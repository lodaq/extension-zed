import type { PageAction, PageActionRequest, PageActionResult } from "./pageActions"
export type { PageAction } from "./pageActions"
export const PAGE_ACTION_FEEDBACK_EVENT = "zed-page-action-feedback"

function report(message: string, tone: "success" | "error") {
  window.dispatchEvent(
    new CustomEvent(PAGE_ACTION_FEEDBACK_EVENT, { detail: { message, tone } })
  )
}

export async function sendPageAction(event: PageAction, successMessage = "Applied to this page", value?: PageActionRequest["value"]) {
  try {
    const response = (await chrome.runtime.sendMessage({ event, value })) as PageActionResult
    if (!response?.ok) throw new Error(response?.error || "Chrome could not modify this page")
    report(successMessage, "success")
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chrome could not modify this page"
    report(message, "error")
    return false
  }
}
