export const PAGE_ACTION_FEEDBACK_EVENT = "zed-page-action-feedback"

type PageActionResponse = { ok: boolean; error?: string }

function report(message: string, tone: "success" | "error") {
  window.dispatchEvent(
    new CustomEvent(PAGE_ACTION_FEEDBACK_EVENT, { detail: { message, tone } })
  )
}

/** Runs a background-routed action and reports whether Chrome could inject it. */
export async function sendPageAction(event: string, successMessage = "Applied to this page") {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (typeof tabId !== "number") throw new Error("No active tab is available")

    const response = (await chrome.runtime.sendMessage({ event, tabId })) as PageActionResponse
    if (!response?.ok) throw new Error(response?.error || "Chrome could not modify this page")
    report(successMessage, "success")
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chrome could not modify this page"
    report(message, "error")
    return false
  }
}
