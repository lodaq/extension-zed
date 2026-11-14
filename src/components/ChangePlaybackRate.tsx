import MiscSection, { type MiscSectionProps } from "./MiscSection"
import { Button } from "./ui/button"
import { Card } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
import { PLAYBACK_MIN, PLAYBACK_MAX, nearestPreset } from "@/lib/playbackPresets"
import { useStoredValue } from "@/lib/useStoredValue"
import { sendPageAction } from "@/lib/withActiveTab"
export default function ChangePlaybackRate(props: MiscSectionProps) {
  const [stored] = useStoredValue<string | number>("speed", "1")
  const speed = nearestPreset(Number(stored))
  const apply = (value: number) => void sendPageAction("playbackRateApply", "Playback speed updated", value)
  return <MiscSection {...props} title="Playback speed" id="speed">
    <Card><div className="zed-stack"><div className="flex items-center gap-5"><Button size="icon" aria-label="Slower" disabled={speed <= PLAYBACK_MIN} onClick={() => void sendPageAction("playbackSlower")}><Icon name="minus" size={22} /></Button><output className="zed-speed">{speed}×</output><Button size="icon" aria-label="Faster" disabled={speed >= PLAYBACK_MAX} onClick={() => void sendPageAction("playbackFaster")}><Icon name="plus" size={22} /></Button></div><input type="range" min={PLAYBACK_MIN} max={PLAYBACK_MAX} step="0.1" aria-label="Playback speed" value={speed} onChange={event => apply(Number(event.target.value))} /></div></Card>
    <div className="zed-grid">{[1, 2].map(value => <Button key={value} aria-pressed={value === speed} variant={value === speed ? "default" : "outline"} onClick={() => apply(value)}>{value === 1 ? "1× Normal" : "2×"}</Button>)}</div>
  </MiscSection>
}
