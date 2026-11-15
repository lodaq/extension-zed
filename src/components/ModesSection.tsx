import { SwitchRow } from "@/design-system/components"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"
import type { ModeAction } from "@/lib/actionRegistry"

function ModeToggle({ label, storageKey, action }: {
  label: string
  storageKey: string
  action: ModeAction
}) {
  const [mode] = useStoredValue(storageKey, "off")
  return <SwitchRow label={label} checked={mode.toLowerCase() === "on"}
    onChange={checked => void sendPageAction(action, `${label} ${checked ? "on" : "off"}`, checked)} />
}

export default function ModesSection() {
  return (
    <section className="zed-stack">
      <div className="flex flex-col gap-3">
        <ModeToggle label="Inspect mode" storageKey="inspectMode" action="inspectModeApply" />
        <ModeToggle label="Design mode" storageKey="designMode" action="designMode" />
        <ModeToggle label="Arabic RTL mode" storageKey="arabicRtlMode" action="arabicRtlMode" />
      </div>
    </section>
  )
}
