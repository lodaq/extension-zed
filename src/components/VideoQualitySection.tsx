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
        <div className="zed-quality-grid">
          {[...QUALITY_OPTIONS].reverse().filter(opt=>opt.height<=1080).map(opt=><Button key={opt.id} aria-pressed={quality===opt.id} variant={quality===opt.id?"default":"outline"} onClick={()=>void handleQualityChange(opt.id)}>{opt.height}p</Button>)}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">If unavailable</span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={fallback === "higher" ? "default" : "outline"}
              size="sm"
              
              onClick={() => void handleFallbackChange("higher")}
            >
              Prefer higher
            </Button>
            <Button
              type="button"
              variant={fallback === "lower" ? "default" : "outline"}
              size="sm"
              
              onClick={() => void handleFallbackChange("lower")}
            >
              Prefer lower
            </Button>
          </div>
        </div>
        <Button variant="default" onClick={handleApply}>Apply</Button>
        <details><summary className="zed-helper">More resolutions</summary><div className="zed-quality-grid">{QUALITY_OPTIONS.filter(opt=>opt.height>1080).map(opt=><Button key={opt.id} aria-pressed={quality===opt.id} variant={quality===opt.id?"default":"outline"} onClick={()=>void handleQualityChange(opt.id)}>{opt.label}</Button>)}<Button aria-pressed={quality==="auto"} variant={quality==="auto"?"default":"outline"} onClick={()=>void handleQualityChange("auto")}>Auto</Button></div></details>
      </div>
    </MiscSection>
  )
}
