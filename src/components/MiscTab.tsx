import { ChangeColors, ChangePlaybackRate, ModesSection, ScrollbarsSection } from "."
import VolumeBooster from "@/components/VolumeBooster"
import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

export default function MiscTab() {
  return (
    <div className={cn(popupSectionStack, "px-0.5 pb-1 pt-3")}>
      <ChangePlaybackRate />
      <VolumeBooster />
      <ChangeColors />
      <ScrollbarsSection />
      <ModesSection />
    </div>
  )
}
