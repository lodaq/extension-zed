import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"
import { ToggleRow, type ToggleRowProps } from "@/components/ToggleRow"
import type { ModeAction } from "@/lib/actionRegistry"

export { ToggleRow, type ToggleRowProps }

interface YoutubeToggleConfig {
  id: string
  label: string
  storageKey: string
  action: ModeAction
  formatToast: (next: boolean) => string
  formatAriaLabel: (checked: boolean) => string
}

const YOUTUBE_TOGGLES: readonly YoutubeToggleConfig[] = [
  {
    id: "youtube-focus",
    label: "Focus mode",
    storageKey: "youtubeFocus",
    action: "youtubeFocus",
    formatToast: (next) => `Focus mode ${next ? "on" : "off"}`,
    formatAriaLabel: (checked) => `Focus mode ${checked ? "on" : "off"}`,
  },
  {
    id: "youtube-progress",
    label: "Hide progress bar",
    storageKey: "youtubeHideProgress",
    action: "hideYoutubeProgressBar",
    formatToast: (next) => `Progress bar ${next ? "hidden" : "shown"}`,
    formatAriaLabel: (checked) => `Progress bar ${checked ? "hidden" : "shown"}`,
  },
  {
    id: "youtube-duration",
    label: "Hide time & duration",
    storageKey: "youtubeHideDuration",
    action: "hideYoutubeDuration",
    formatToast: (next) => `Video duration ${next ? "hidden" : "shown"}`,
    formatAriaLabel: (checked) => `Time and duration ${checked ? "hidden" : "shown"}`,
  },
  {
    id: "youtube-controls",
    label: "Hide controls",
    storageKey: "youtubeHideControls",
    action: "hideYoutubeControls",
    formatToast: (next) => `Controls ${next ? "hidden" : "shown"}`,
    formatAriaLabel: (checked) => `Controls ${checked ? "hidden" : "shown"}`,
  },
  {
    id: "youtube-half-screen",
    label: "Half-screen layout",
    storageKey: "youtubeHalfScreen",
    action: "youtubeHalfScreen",
    formatToast: (next) => `Half-screen layout ${next ? "enabled" : "disabled"}`,
    formatAriaLabel: (checked) => `Half-screen layout ${checked ? "enabled" : "disabled"}`,
  },
]

function YoutubeToggleItem({ config }: { config: YoutubeToggleConfig }) {
  const [checked] = useStoredValue<boolean>(config.storageKey, false)

  const handleToggle = (next: boolean) => {
    void sendPageAction(config.action, config.formatToast(next), next)
  }

  return (
    <ToggleRow
      id={config.id}
      label={config.label}
      checked={checked}
      ariaLabel={config.formatAriaLabel(checked)}
      onToggle={handleToggle}
    />
  )
}

const YoutubeFocusMode = () => {
  return (
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-youtube-heading">
      <h2 id="zed-youtube-heading" className={popupSectionTitle}>
        YouTube
      </h2>
      <div className="flex flex-col gap-1">
        {YOUTUBE_TOGGLES.map((config) => (
          <YoutubeToggleItem key={config.id} config={config} />
        ))}
      </div>
    </section>
  )
}

export default YoutubeFocusMode
