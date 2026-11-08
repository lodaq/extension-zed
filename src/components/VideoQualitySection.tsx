import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import { Button } from "@/components/ui/button"
import { useStoredValue } from "@/lib/useStoredValue"
import { QUALITY_OPTIONS, type VideoQualityFallback } from "@/lib/videoQuality"
import { sendPageAction } from "@/lib/withActiveTab"

export default function VideoQualitySection({ dragHandle, open, onOpenChange }: MiscSectionProps) {
  const [quality, setQuality] = useStoredValue<string>("videoQuality", "hd1080")
  const [fallback, setFallback] = useStoredValue<VideoQualityFallback>("videoQualityFallback", "lower")

  const handleQualityChange = async (newQuality: string) => {
    await setQuality(newQuality)
    void sendPageAction("applyVideoQuality", "Quality saved")
  }

  const handleFallbackChange = async (newFallback: VideoQualityFallback) => {
    await setFallback(newFallback)
    void sendPageAction("applyVideoQuality", `Prefer ${newFallback} quality`)
  }

  const handleApply = async () => {
    try {
      await setQuality(quality)
      await setFallback(fallback)
    } catch {
      return
    }
    void sendPageAction("applyVideoQuality", "Quality preference saved")
  }

  return (
    <MiscSection
      dragHandle={dragHandle}
      open={open}
      onOpenChange={onOpenChange}
      title="Video quality"
      id="zed-quality-heading"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <select
            id="zed-video-quality-select"
            aria-label="Preferred video quality"
            value={quality}
            onChange={(e) => void handleQualityChange(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="auto">Auto</option>
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 px-3"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>

        <p className="text-xs leading-snug text-muted-foreground">
          Sets quality through supported player controllers, including Facebook, Instagram, and TikTok, without opening menus. The result reports the selected quality or an unsupported player.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">If unavailable</span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={fallback === "higher" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => void handleFallbackChange("higher")}
            >
              Prefer higher
            </Button>
            <Button
              type="button"
              variant={fallback === "lower" ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs font-medium"
              onClick={() => void handleFallbackChange("lower")}
            >
              Prefer lower
            </Button>
          </div>
        </div>
      </div>
    </MiscSection>
  )
}
