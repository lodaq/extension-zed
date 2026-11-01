import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { exportSettings, importSettings, readSetting } from "@/lib/settings"
import { useStoredValue } from "@/lib/useStoredValue"

function downloadSettings(backup: Awaited<ReturnType<typeof exportSettings>>) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `extension-zed-settings-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SettingsTab() {
  const [dark, setDark] = useStoredValue("darkTheme", true)
  const [busy, setBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    document.documentElement.classList.toggle("dark", readSetting("darkTheme", dark, true))
  }, [dark])
  const toggle = (enabled: boolean) => {
    void setDark(enabled).catch((error) => toast({ title: "Theme could not be saved", description: String(error), variant: "destructive" }))
  }

  const onExport = async () => {
    setBusy(true)
    try {
      downloadSettings(await exportSettings())
      toast({ title: "Settings exported", description: "Your Zed settings were downloaded." })
    } catch (error) {
      toast({ title: "Export failed", description: String(error), variant: "destructive" })
    } finally { setBusy(false) }
  }

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setBusy(true)
    try {
      await importSettings(JSON.parse(await file.text()))
      toast({ title: "Settings imported", description: "Preferences merged. Page toggles apply when used; playback updates open pages." })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "The settings file could not be read.",
        variant: "destructive",
      })
    } finally { setBusy(false) }
  }

  return (
    <section className={cn(popupPanel, popupSectionInner)}>
      <h2 className={popupSectionTitle}>Appearance</h2>
      <div className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60" onClick={() => toggle(!dark)}>
        <Label className="cursor-pointer text-sm font-medium">Dark theme</Label>
        <Switch id="dark-theme" aria-label="Dark theme" checked={dark} onClick={(event) => event.stopPropagation()} onCheckedChange={toggle} />
      </div>
      <h2 className={popupSectionTitle}>Data</h2>
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted" onClick={() => void onExport()}>
          Export settings
        </button>
        <button type="button" disabled={busy} className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted" onClick={() => fileInputRef.current?.click()}>
          Import settings
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void onImport(event)} />
    </section>
  )
}
