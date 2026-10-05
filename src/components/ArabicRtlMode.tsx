import { useCallback, useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const ArabicRtlMode = () => {
  const [on, setOn] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(["arabicRtlMode"]).then((r) => {
      setOn(String(r.arabicRtlMode).toLowerCase() === "on")
    })
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local" || !changes.arabicRtlMode) return
      setOn(String(changes.arabicRtlMode.newValue).toLowerCase() === "on")
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const toggle = useCallback(() => {
    const next = on ? "off" : "on"
    setOn(next === "on")
    void chrome.storage.local.set({ arabicRtlMode: next }).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (tabId === undefined) return
        chrome.runtime.sendMessage({ event: "arabicRtlMode", tabId })
      })
    })
  }, [on])

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
