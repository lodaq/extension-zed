import { ToggleRow } from "@/components/ToggleRow"
import { sendPageAction } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"

const ArabicRtlMode = () => {
  const [mode] = useStoredValue<string>("arabicRtlMode", "off")
  const on = mode.toLowerCase() === "on"

  const toggle = (checked: boolean) => {
    const next = checked ? "on" : "off"
    void sendPageAction("arabicRtlMode", `Arabic RTL mode ${next}`, checked)
  }

  return (
    <ToggleRow
      id="arabic-rtl-mode"
      label="Arabic RTL mode"
      checked={on}
      ariaLabel={`Arabic RTL mode ${on ? "on" : "off"}`}
      onToggle={toggle}
    />
  )
}

export default ArabicRtlMode
