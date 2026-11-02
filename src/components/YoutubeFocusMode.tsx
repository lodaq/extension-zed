import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"

const YoutubeFocusMode = () => {
  const [focus] = useStoredValue("youtubeFocus", false)
  const [hideProgress] = useStoredValue("youtubeHideProgress", false)
  const [hideControls] = useStoredValue("youtubeHideControls", false)
  const toggleFocus = (next: boolean) => { void sendPageAction("youtubeFocus", `Focus mode ${next ? "on" : "off"}`, next) }
  const toggleProgress = (next: boolean) => { void sendPageAction("hideYoutubeProgressBar", `Progress bar ${next ? "hidden" : "shown"}`, next) }
  const toggleControls = (next: boolean) => { void sendPageAction("hideYoutubeControls", `Controls ${next ? "hidden" : "shown"}`, next) }
  return (
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-youtube-heading">
      <h2 id="zed-youtube-heading" className={popupSectionTitle}>
        YouTube
      </h2>
      <div className="flex flex-col gap-1">
        <div
          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
          onClick={() => toggleFocus(!focus)}
        >
          <Label className="cursor-pointer text-sm font-medium">Focus mode</Label>
          <Switch
            id="youtube-focus"
            checked={focus}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={toggleFocus}
            aria-label={`Focus mode ${focus ? "on" : "off"}`}
          />
        </div>
        <div
          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
          onClick={() => toggleProgress(!hideProgress)}
        >
          <Label className="cursor-pointer text-sm font-medium">Hide progress bar</Label>
          <Switch
            id="youtube-progress"
            checked={hideProgress}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={toggleProgress}
            aria-label={`Progress bar ${hideProgress ? "hidden" : "shown"}`}
          />
        </div>
        <div
          className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
          onClick={() => toggleControls(!hideControls)}
        >
          <Label className="cursor-pointer text-sm font-medium">Hide controls</Label>
          <Switch
            id="youtube-controls"
            checked={hideControls}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={toggleControls}
            aria-label={`Controls ${hideControls ? "hidden" : "shown"}`}
          />
        </div>
      </div>
    </section>
  )
}

export default YoutubeFocusMode
