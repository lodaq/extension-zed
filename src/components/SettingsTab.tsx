import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { ChangeEvent, useEffect, useRef, useState } from "react"

const EXPORT_VERSION = 1

function downloadSettings(settings: Record<string, unknown>) {
  const blob = new Blob([JSON.stringify({ version: EXPORT_VERSION, settings }, null, 2)], {
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
  const [dark, setDark] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    chrome.storage.local.get(["darkTheme"]).then((r) => {
      const enabled = r.darkTheme === undefined ? true : Boolean(r.darkTheme)
      setDark(enabled)
      document.documentElement.classList.toggle("dark", enabled)
      if (r.darkTheme === undefined) void chrome.storage.local.set({ darkTheme: true })
    })
  }, [])
  const toggle = (enabled: boolean) => {
    setDark(enabled)
    document.documentElement.classList.toggle("dark", enabled)
    void chrome.storage.local.set({ darkTheme: enabled })
  }

  const exportSettings = async () => {
    const settings = await chrome.storage.local.get(null)
    downloadSettings(settings)
    toast({ title: "Settings exported", description: "Your Zed settings were downloaded." })
  }

  const importSettings = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid settings file")
      const payload = parsed as { version?: unknown; settings?: unknown }
      if (payload.version !== EXPORT_VERSION || !payload.settings || typeof payload.settings !== "object" || Array.isArray(payload.settings)) {
        throw new Error("Unsupported settings file")
      }
      await chrome.storage.local.set(payload.settings as Record<string, unknown>)
      const importedDark = Boolean((payload.settings as Record<string, unknown>).darkTheme)
      setDark(importedDark)
      document.documentElement.classList.toggle("dark", importedDark)
      toast({ title: "Settings imported", description: "Your Zed settings were restored." })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "The settings file could not be read.",
        variant: "destructive",
      })
    }
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
        <button type="button" className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted" onClick={() => void exportSettings()}>
          Export settings
        </button>
        <button type="button" className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted" onClick={() => fileInputRef.current?.click()}>
          Import settings
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importSettings(event)} />
    </section>
  )
}
