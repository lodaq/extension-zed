import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import {
  exportSettings,
  importSettings,
  readSetting,
  resetSettings,
  MAX_SETTINGS_FILE_SIZE,
} from "@/lib/settings"
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
  const [confirmReset, setConfirmReset] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", readSetting("darkTheme", dark, true))
  }, [dark])

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    }
  }, [])

  const toggle = (enabled: boolean) => {
    void setDark(enabled).catch((error) =>
      toast({ title: "Theme could not be saved", description: String(error), variant: "destructive" })
    )
  }

  const onExport = async () => {
    setBusy(true)
    try {
      downloadSettings(await exportSettings())
      toast({ title: "Settings exported", description: "Your Zed settings were downloaded." })
    } catch (error) {
      toast({ title: "Export failed", description: String(error), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (file.size > MAX_SETTINGS_FILE_SIZE) {
      toast({
        title: "Import rejected",
        description: `File is too large (${Math.round(file.size / 1024)} KB). Maximum allowed size is 512 KB.`,
        variant: "destructive",
      })
      return
    }

    setBusy(true)
    try {
      let parsed: unknown
      try {
        const text = await file.text()
        parsed = JSON.parse(text)
      } catch {
        throw new Error("Invalid JSON: The selected file could not be parsed as valid JSON.")
      }

      await importSettings(parsed)
      toast({
        title: "Settings imported",
        description: "Preferences merged. Page toggles apply when used; playback updates open pages.",
      })
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "The settings file could not be read.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleResetClick = async () => {
    if (!confirmReset) {
      setConfirmReset(true)
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      resetTimerRef.current = setTimeout(() => {
        setConfirmReset(false)
      }, 4000)
      return
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    setConfirmReset(false)
    setBusy(true)
    try {
      await resetSettings()
      toast({
        title: "Settings reset",
        description: "All preferences and customized site colors were reset to defaults.",
      })
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Could not reset settings.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={cn(popupPanel, popupSectionInner)}>
      <h2 className={popupSectionTitle}>Appearance</h2>
      <div
        className="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-muted/60"
        onClick={() => toggle(!dark)}
      >
        <Label className="cursor-pointer text-sm font-medium">Dark theme</Label>
        <Switch
          id="dark-theme"
          aria-label="Dark theme"
          checked={dark}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={toggle}
        />
      </div>

      <h2 className={popupSectionTitle}>Data</h2>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
          onClick={() => void onExport()}
        >
          Export settings
        </button>
        <button
          type="button"
          disabled={busy}
          className="flex-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
          onClick={() => fileInputRef.current?.click()}
        >
          Import settings
        </button>
      </div>

      <div className="pt-1">
        <button
          type="button"
          disabled={busy}
          className={cn(
            "w-full rounded-md border px-3 py-2 text-sm transition-colors",
            confirmReset
              ? "border-destructive bg-destructive/10 text-destructive font-medium hover:bg-destructive/20"
              : "border-input text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          onClick={() => void handleResetClick()}
        >
          {confirmReset ? "Click again to confirm reset" : "Reset settings to defaults"}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void onImport(event)}
      />

      <div className="border-t border-border/70 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setShowPrivacy(!showPrivacy)}
        >
          <span>Privacy & Permissions</span>
          <span>{showPrivacy ? "−" : "+"}</span>
        </button>
        {showPrivacy && (
          <div className="mt-2 space-y-1.5 rounded-md bg-muted/40 p-2.5 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Local & Private by Design</p>
            <p>
              Extension Zed executes exclusively in your browser. No telemetry, browsing history, or personal data is collected or sent to external servers.
            </p>
            <ul className="list-disc pl-3.5 space-y-1 pt-1">
              <li>
                <strong className="text-foreground">storage:</strong> stores your theme, playback preferences, and site colors locally on this device.
              </li>
              <li>
                <strong className="text-foreground">activeTab & scripting:</strong> injects styling and controls only into the active tab upon your direct request.
              </li>
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
