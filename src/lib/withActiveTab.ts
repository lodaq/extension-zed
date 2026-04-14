export function withActiveTab(fn: (tabId: number) => void): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const id = tabs[0]?.id
    if (!id) return
    fn(id)
  })
}
