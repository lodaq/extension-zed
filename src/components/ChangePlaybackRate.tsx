import { Button } from "@/components/ui/button"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import {
  popupControlRow,
  popupPanel,
  popupSectionInner,
  popupSectionTitle,
} from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import {
  PLAYBACK_PRESETS,
  nearestPreset,
} from "@/lib/playbackPresets"
import { cn } from "@/lib/utils"
import { useStoredValue } from "@/lib/useStoredValue"
import { sendPageAction } from "@/lib/withActiveTab"

const STORAGE_KEY = "speed"

const ChangePlaybackRate = () => {
  const [storedSpeed] = useStoredValue<string | number>(STORAGE_KEY, "1")
  const speed = nearestPreset(Number(storedSpeed))
  const step = (delta: number) => { void sendPageAction(delta < 0 ? "playbackSlower" : "playbackFaster", "Playback speed updated") }
  const onSelect = (value: string) => { void sendPageAction("playbackRateApply", "Playback speed updated", Number(value)) }
  const setNormal = () => onSelect("1")
  const setDouble = () => onSelect("2")

  return (
    <section
      className={cn(popupPanel, popupSectionInner)}
      aria-labelledby="zed-playback-heading"
    >
      <h2 id="zed-playback-heading" className={popupSectionTitle}>
        Playback speed
      </h2>

      <div className="flex flex-col gap-2">

        <div className={cn(popupControlRow, "items-stretch")}>
          <Button
            type="button"
            size="icon"
            className={cn(shortcutHostClassName, "h-9 w-9 shrink-0")}
            aria-label="Slower"
            onClick={() => step(-1)}
          >
            <span className="text-base leading-none">−</span>
            <ShortcutKbd label={KBD.playbackSlower} className="scale-[0.85]" />
          </Button>
          <select
            id="zed-playback-rate"
            className="relative z-0 h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={String(speed)}
            onChange={(e) => onSelect(e.target.value)}
          >
            {PLAYBACK_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === 1 ? "1× normal" : `${p}×`}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="icon"
            className={cn(shortcutHostClassName, "h-9 w-9 shrink-0")}
            aria-label="Faster"
            onClick={() => step(1)}
          >
            <span className="text-base leading-none">+</span>
            <ShortcutKbd label={KBD.playbackFaster} className="scale-[0.85]" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            size="sm"
            className={cn(shortcutHostClassName, "h-9 w-full")}
            aria-label="Normal speed (1×)"
            onClick={setNormal}
          >
            1× Normal
            <ShortcutKbd label={KBD.playbackNormal} />
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn(shortcutHostClassName, "h-9 w-full")}
            aria-label="Double speed (2×)"
            onClick={setDouble}
          >
            2×
            <ShortcutKbd label={KBD.playbackDouble} />
          </Button>
        </div>
      </div>
    </section>
  )
}

export default ChangePlaybackRate
