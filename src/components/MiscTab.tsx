import { ChangeColors, ChangePlaybackRate, ModesSection, ScrollbarsSection } from "."
import VolumeBooster from "@/components/VolumeBooster"
import PasswordGenerator from "@/components/PasswordGenerator"
import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

export default function MiscTab() {
  return (
    <div className={cn(popupSectionStack, "px-0.5 pb-1 pt-3")}>
      <PasswordGenerator />
      <ChangePlaybackRate />
      <VolumeBooster />
      <ChangeColors />
      <ScrollbarsSection />
      <ModesSection />
    </div>
  )
}
