import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { KBD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"
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
