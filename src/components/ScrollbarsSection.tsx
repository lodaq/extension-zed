import { Button } from "@/components/ui/button"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import {
  popupControlRow,
  popupDescription,
  popupPanel,
  popupSectionInner,
  popupSectionTitle,
  popupSubhead,
} from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import { withActiveTab } from "@/lib/withActiveTab"
import { cn } from "@/lib/utils"

const ScrollbarsSection = () => {
  return (
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-scrollbars-heading">
      <h2 id="zed-scrollbars-heading" className={popupSectionTitle}>
        Scrollbars
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div>
            <p className={popupSubhead}>Main scrollbar</p>
            <p className={popupDescription}>Only the document / viewport scrollbar.</p>
          </div>
          <div className={popupControlRow}>
            <Button
              type="button"
              size="sm"
              className={cn(shortcutHostClassName, "min-h-10 flex-1 sm:flex-none")}
              onClick={() =>
                withActiveTab((tabId) =>
                  chrome.runtime.sendMessage({ event: "hideMainScrollBar", tabId })
                )
              }
            >
              Hide
              <ShortcutKbd label={KBD.hideMainScrollbar} />
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={() =>
                withActiveTab((tabId) =>
                  chrome.runtime.sendMessage({ event: "resetMainScrollBar", tabId })
                )
              }
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="border-t border-border/70 pt-4">
          <div className="flex flex-col gap-2">
            <div>
              <p className={popupSubhead}>All scrollbars</p>
              <p className={popupDescription}>Every scrollable region, including nested areas.</p>
            </div>
            <div className={popupControlRow}>
              <Button
                type="button"
                size="sm"
                className={cn(shortcutHostClassName, "min-h-10 flex-1 sm:flex-none")}
                onClick={() =>
                  withActiveTab((tabId) =>
                    chrome.runtime.sendMessage({ event: "hideAllScrollBars", tabId })
                  )
                }
              >
                Hide
                <ShortcutKbd label={KBD.hideAllScrollbars} />
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-10 flex-1 sm:flex-none"
                onClick={() =>
                  withActiveTab((tabId) =>
                    chrome.runtime.sendMessage({ event: "resetAllScrollBars", tabId })
                  )
                }
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ScrollbarsSection
