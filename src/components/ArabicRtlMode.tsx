import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
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
    <div
      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
      onClick={() => toggle(!on)}
    >
      <Label className="cursor-pointer text-sm font-medium">
        Arabic RTL mode
      </Label>
      <Switch
        id="arabic-rtl-mode"
        checked={on}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={toggle}
        aria-label={`Arabic RTL mode ${on ? "on" : "off"}`}
      />
    </div>
  )
}

export default ArabicRtlMode
