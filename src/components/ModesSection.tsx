import DesignMode from "@/components/DesignMode"
import InspectModeToggle from "@/components/InspectModeToggle"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

const ModesSection = () => {
  return (
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-modes-heading">
      <h2 id="zed-modes-heading" className={popupSectionTitle}>
        Modes
      </h2>
      <div className="flex flex-col gap-3">
        <InspectModeToggle />
        <DesignMode />
      </div>
    </section>
  )
}

export default ModesSection
