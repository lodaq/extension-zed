import { ChangeColors, ChangePlaybackRate, ModesSection, ScrollbarsSection } from "."
import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

export default function MiscTab() {
  return (
    <div className={cn(popupSectionStack, "px-0.5 pb-3 pt-6")}>
      <ChangePlaybackRate />
      <ChangeColors />
      <ScrollbarsSection />
      <ModesSection />
    </div>
  )
}
