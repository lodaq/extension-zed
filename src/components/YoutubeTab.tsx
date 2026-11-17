import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"
import { SwitchRow } from "@/design-system/components"
import type { ModeAction } from "@/lib/actionRegistry"

const YOUTUBE_TOGGLES: readonly {
  label: string; storageKey: string; action: ModeAction; subject: string; states: readonly [string, string]
}[] = [
  { label: "Focus mode", storageKey: "youtubeFocus", action: "youtubeFocus", subject: "Focus mode", states: ["off", "on"] },
  { label: "Hide progress bar", storageKey: "youtubeHideProgress", action: "hideYoutubeProgressBar", subject: "Progress bar", states: ["shown", "hidden"] },
  { label: "Hide time & duration", storageKey: "youtubeHideDuration", action: "hideYoutubeDuration", subject: "Video duration", states: ["shown", "hidden"] },
  { label: "Hide thumbnail timestamps", storageKey: "youtubeHideTimestamps", action: "hideYoutubeTimestamps", subject: "Thumbnail timestamps", states: ["shown", "hidden"] },
  { label: "Hide all timestamps", storageKey: "youtubeHideAllTimestamps", action: "hideAllYoutubeTimestamps", subject: "All timestamps", states: ["shown", "hidden"] },
  { label: "Hide controls", storageKey: "youtubeHideControls", action: "hideYoutubeControls", subject: "Controls", states: ["shown", "hidden"] },
  { label: "Half-screen layout", storageKey: "youtubeHalfScreen", action: "youtubeHalfScreen", subject: "Half-screen layout", states: ["disabled", "enabled"] },
]

function YoutubeToggleItem({ config }: { config: (typeof YOUTUBE_TOGGLES)[number] }) {
  const [checked, , loaded] = useStoredValue<boolean>(config.storageKey, false)
  if (!loaded) return null
  return <SwitchRow label={config.label} checked={checked}
    onChange={next => void sendPageAction(config.action, `${config.subject} ${config.states[Number(next)]}`, next)} />
}

export default function YoutubeTab() {
  return (
    <div className="flex flex-col gap-3 px-0.5 pb-1 pt-3">
      <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-youtube-heading">
        <h2 id="zed-youtube-heading" className={popupSectionTitle}>
          YouTube
        </h2>
        <div className="flex flex-col gap-1">
          {YOUTUBE_TOGGLES.map((config) => (
            <YoutubeToggleItem key={config.storageKey} config={config} />
          ))}
        </div>
      </section>
    </div>
  )
}
