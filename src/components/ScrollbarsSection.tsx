import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import { Button } from "@/components/ui/button"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import {
  popupControlRow,
  popupDescription,
  popupSubhead,
} from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import { sendPageAction } from "@/lib/withActiveTab"
import { cn } from "@/lib/utils"

const ScrollbarsSection = ({ dragHandle, open, onOpenChange }: MiscSectionProps) => {
  return (
    <MiscSection dragHandle={dragHandle} open={open} onOpenChange={onOpenChange} title="Scrollbars" id="zed-scrollbars-heading">
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
              onClick={() => void sendPageAction("hideMainScrollBar", "Main scrollbar hidden")}
            >
              Hide
              <ShortcutKbd label={KBD.hideMainScrollbar} />
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={() => void sendPageAction("resetMainScrollBar", "Main scrollbar reset")}
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
                onClick={() => void sendPageAction("hideAllScrollBars", "All scrollbars hidden")}
              >
                Hide
                <ShortcutKbd label={KBD.hideAllScrollbars} />
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-10 flex-1 sm:flex-none"
                onClick={() => void sendPageAction("resetAllScrollBars", "All scrollbars reset")}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MiscSection>
  )
}

export default ScrollbarsSection
