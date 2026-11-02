import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import DesignMode from "@/components/DesignMode"
import InspectModeToggle from "@/components/InspectModeToggle"
import ArabicRtlMode from "@/components/ArabicRtlMode"

const ModesSection = ({ dragHandle, open, onOpenChange }: MiscSectionProps) => {
  return (
    <MiscSection dragHandle={dragHandle} open={open} onOpenChange={onOpenChange} title="Modes" id="zed-modes-heading">
      <div className="flex flex-col gap-3">
        <InspectModeToggle />
        <DesignMode />
        <ArabicRtlMode />
      </div>
    </MiscSection>
  )
}

export default ModesSection
