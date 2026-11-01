import { Button } from "@/components/ui/button"
import { popupControlRow, popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { sendPageAction } from "@/lib/withActiveTab"
import { cn } from "@/lib/utils"
import { useStoredValue } from "@/lib/useStoredValue"

const STORAGE_KEY = "volumeBoost"
const MIN_BOOST = 100
const MAX_BOOST = 2000

function clampBoost(value: number) {
  if (!Number.isFinite(value)) return MIN_BOOST
  return Math.min(MAX_BOOST, Math.max(MIN_BOOST, Math.round(value)))
}

export default function VolumeBooster() {
  const [storedBoost, setBoost] = useStoredValue(STORAGE_KEY, MIN_BOOST)
  const boost = clampBoost(Number(storedBoost))

  const applyBoost = (value: number) => {
    const next = clampBoost(value)
    void setBoost(next).then(() => sendPageAction("volumeBoost", `Volume boost ${next}%`))
  }

  return (
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-volume-heading">
      <h2 id="zed-volume-heading" className={popupSectionTitle}>Volume boost</h2>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="zed-volume-boost" className="text-sm font-medium">Amplification</label>
        <output htmlFor="zed-volume-boost" className="min-w-14 text-right text-sm font-semibold">{boost}%</output>
      </div>
      <input
        id="zed-volume-boost"
        type="range"
        min={MIN_BOOST}
        max={MAX_BOOST}
        step="10"
        value={boost}
        onChange={(event) => applyBoost(Number(event.target.value))}
        className="w-full accent-primary"
        aria-label="Volume amplification"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Boosts audio and video up to 2000%. High levels may cause distortion or damage speakers.
      </p>
      <div className={popupControlRow}>
        <Button type="button" size="sm" className="flex-1" onClick={() => applyBoost(MIN_BOOST)}>
          Reset to 100%
        </Button>
      </div>
    </section>
  )
}
