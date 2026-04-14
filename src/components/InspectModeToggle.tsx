import { useCallback, useEffect, useState } from "react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import { KBD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

const InspectModeToggle = () => {
  const [on, setOn] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(["inspectMode"]).then((r) => {
      setOn(String(r.inspectMode).toLowerCase() === "on")
    })
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local" || !changes.inspectMode) return
      setOn(String(changes.inspectMode.newValue).toLowerCase() === "on")
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const toggle = useCallback(() => {
    const next = on ? "off" : "on"
    setOn(next === "on")
    void chrome.storage.local.set({ inspectMode: next }).then(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id
        if (tabId === undefined) return
        chrome.runtime.sendMessage({ event: "inspectModeApply", tabId })
      })
    })
  }, [on])

  return (
    <div className={cn(shortcutHostClassName, "flex items-center justify-between gap-3 px-4 py-3")}>
      <div className="flex flex-col gap-1">
        <Label htmlFor="inspect-mode" className="text-sm font-medium cursor-pointer">
          Inspect mode
        </Label>
        <ShortcutKbd label={KBD.inspect} />
      </div>
      <Switch
        id="inspect-mode"
        checked={on}
        onCheckedChange={toggle}
        aria-label={`Inspect mode ${on ? "on" : "off"}`}
      />
    </div>
  )
}

export default InspectModeToggle
