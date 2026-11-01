import { useStoredValue } from "@/lib/useStoredValue"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { sendPageAction } from "@/lib/withActiveTab"

const ArabicRtlMode = () => {
  const [mode] = useStoredValue<string>("arabicRtlMode", "off")
  const on = mode.toLowerCase() === "on"

  const toggle = (checked: boolean) => {
    void sendPageAction("arabicRtlMode", `Arabic RTL mode ${checked ? "on" : "off"}`, checked)
  }

  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 py-3")}>
      <div className="flex flex-col gap-1">
        <Label htmlFor="arabic-rtl-mode" className="text-sm font-medium cursor-pointer">
          Arabic RTL Mode
        </Label>
      </div>
      <Switch
        id="arabic-rtl-mode"
        checked={on}
        onCheckedChange={toggle}
        aria-label={`Arabic RTL Mode ${on ? "on" : "off"}`}
      />
    </div>
  )
}

export default ArabicRtlMode
