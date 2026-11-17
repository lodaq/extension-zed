import { useEffect, useState } from "react"
import { DOWNLOADER_ENABLED, DOWNLOADER_STATE_KEY, downloaderCommand, EMPTY_DOWNLOADER, type DownloaderState } from "./downloader"

export function useDownloader() {
  const [state, setState] = useState<DownloaderState>(EMPTY_DOWNLOADER)
  useEffect(() => {
    if (!DOWNLOADER_ENABLED) return
    let active = true
    let changed = false
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "session" && changes[DOWNLOADER_STATE_KEY]?.newValue) {
        changed = true
        setState(changes[DOWNLOADER_STATE_KEY].newValue as DownloaderState)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    void downloaderCommand("state").then(value => { if (active && !changed) setState(value) }).catch(error => {
      if (active) setState({ phase: "setup", error: String(error) })
    })
    return () => { active = false; chrome.storage.onChanged.removeListener(listener) }
  }, [])
  return state
}
