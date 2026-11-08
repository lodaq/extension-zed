import { ToggleRow } from "@/components/ToggleRow"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"

const InspectModeToggle = () => {
  const [mode] = useStoredValue<string>("inspectMode", "off")
  const on = mode.toLowerCase() === "on"

  const toggle = (checked: boolean) => {
    const next = checked ? "on" : "off"
    void sendPageAction("inspectModeApply", `Inspect mode ${next}`, checked)
  }

  return (
    <ToggleRow
      id="inspect-mode"
      label="Inspect mode"
      checked={on}
      ariaLabel={`Inspect mode ${on ? "on" : "off"}`}
      onToggle={toggle}
    />
  )
}

export default InspectModeToggle
