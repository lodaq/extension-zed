import { useStoredValue } from "@/lib/useStoredValue"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const ArabicRtlMode = () => {
  const [mode, setMode] = useStoredValue<string>("arabicRtlMode", "off")
  const on = mode.toLowerCase() === "on"

  const toggle = () => {
    const next = on ? "off" : "on"
    void setMode(next).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (tabId === undefined) return
        chrome.runtime.sendMessage({ event: "arabicRtlMode", tabId })
      })
    })
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
