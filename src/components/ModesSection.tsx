import MiscSection from "@/components/MiscSection"
import DesignMode from "@/components/DesignMode"
import InspectModeToggle from "@/components/InspectModeToggle"
import ArabicRtlMode from "@/components/ArabicRtlMode"

const ModesSection = () => {
  return (
    <MiscSection title="Modes" id="zed-modes-heading">
      <div className="flex flex-col gap-3">
        <InspectModeToggle />
        <DesignMode />
        <ArabicRtlMode />
      </div>
    </MiscSection>
  )
}

export default ModesSection
