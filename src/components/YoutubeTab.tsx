import { YoutubeFocusMode } from "."
import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

export default function YoutubeTab() {
  return (
    <div className={cn(popupSectionStack, "px-0.5 pb-3 pt-6")}>
      <YoutubeFocusMode />
    </div>
  )
}
