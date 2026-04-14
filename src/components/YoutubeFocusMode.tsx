import { Button } from "@/components/ui/button"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

const runScript = (files: string[]) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTabId = tabs[0]?.id
    if (!activeTabId) return
    chrome.scripting.executeScript({ target: { tabId: activeTabId }, files })
  })
}

const hideProgressBar = () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTabId = tabs[0]?.id
    if (!activeTabId) return
    chrome.runtime.sendMessage({ event: "hideYoutubeProgressBar", tabId: activeTabId })
  })
}

const YoutubeFocusMode = () => {
  return (
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-youtube-heading">
      <h2 id="zed-youtube-heading" className={popupSectionTitle}>
        YouTube
      </h2>
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          size="sm"
          className={cn(shortcutHostClassName, "min-h-10 w-full justify-start px-4")}
          onClick={() => runScript(["scripts/youtubeFocusMode.js"])}
        >
          Focus mode
          <ShortcutKbd label={KBD.youtubeFocus} />
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(shortcutHostClassName, "min-h-10 w-full justify-start px-4")}
          onClick={() => runScript(["scripts/youtubeFocusModeReset.js"])}
        >
          Reset layout
          <ShortcutKbd label={KBD.youtubeReset} />
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(shortcutHostClassName, "min-h-10 w-full justify-start px-4")}
          onClick={hideProgressBar}
        >
          Hide progress bar
          <ShortcutKbd label={KBD.youtubeProgressBar} />
        </Button>
      </div>
    </section>
  )
}

export default YoutubeFocusMode
