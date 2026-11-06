import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import DesignMode from "@/components/DesignMode"
import InspectModeToggle from "@/components/InspectModeToggle"
import ArabicRtlMode from "@/components/ArabicRtlMode"
import PageTimestampInspector from "@/components/PageTimestampInspector"

const ModesSection = ({ dragHandle, open, onOpenChange }: MiscSectionProps) => {
  return (
    <MiscSection dragHandle={dragHandle} open={open} onOpenChange={onOpenChange} title="Modes" id="zed-modes-heading">
      <div className="flex flex-col gap-3">
        <InspectModeToggle />
        <DesignMode />
        <ArabicRtlMode />
        <PageTimestampInspector />
      </div>
    </MiscSection>
  )
}

export default ModesSection
