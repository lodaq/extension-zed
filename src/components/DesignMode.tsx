import { ToggleRow } from "@/components/ToggleRow"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"

const DesignMode = () => {
  const [mode] = useStoredValue<string>("designMode", "off")
  const on = mode.toLowerCase() === "on"

  const toggle = (checked: boolean) => {
    const next = checked ? "on" : "off"
    void sendPageAction("designMode", `Design mode ${next}`, checked)
  }

  return (
    <ToggleRow
      id="design-mode"
      label="Design mode"
      checked={on}
      ariaLabel={`Design mode ${on ? "on" : "off"}`}
      onToggle={toggle}
    />
  )
}

export default DesignMode
