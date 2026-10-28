import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { KBD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"
import { sendPageAction } from "@/lib/withActiveTab"
import { useCallback, useEffect, useState } from "react"

const DesignMode = () => {
  const [on, setOn] = useState(false)

  useEffect(() => {
    chrome.storage.local.get(["designMode"]).then((r) => {
      setOn(String(r.designMode).toLowerCase() === "on")
    })
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local" || !changes.designMode) return
      setOn(String(changes.designMode.newValue).toLowerCase() === "on")
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  const toggle = useCallback((checked: boolean) => {
    const next = checked ? "on" : "off"
    setOn(checked)
    void chrome.storage.local.set({ designMode: next }).then(() =>
      sendPageAction("designMode", `Design mode ${next}`)
    )
  }, [])

  return (
    <div
      className={cn(
        shortcutHostClassName,
        "flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
      )}
      onClick={() => toggle(!on)}
    >
      <div className="flex flex-col gap-1">
        <Label className="cursor-pointer text-sm font-medium">
          Design mode
        </Label>
        <ShortcutKbd label={KBD.designMode} />
      </div>
      <Switch
        id="design-mode"
        checked={on}
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={toggle}
        aria-label={`Design mode ${on ? "on" : "off"}`}
      />
    </div>
  )
}

export default DesignMode
