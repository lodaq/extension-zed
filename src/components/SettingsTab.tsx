import { DEFAULT_TOOL_ORDER } from "@/lib/popupLayout"
import { moveMiscSection } from "@/lib/miscSectionOrder"
import { Dialog, SwitchRow } from "@/design-system/components"
import { Button } from "@/components/ui/button"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { readBootState, updateBootState } from "@/lib/bootCache"
import {
  exportSettings,
  importSettings,
  readSetting,
  resetSettings,
  MAX_SETTINGS_FILE_SIZE,
  type MiscSectionId,
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
  const [dark, setDark] = useStoredValue<boolean>("darkTheme", () => {
    const boot = readBootState()
    if (typeof boot.dark === "boolean") return boot.dark
    if (typeof document !== "undefined" && document.documentElement) {
      return document.documentElement.classList.contains("dark")
    }
    return true
  })
  const [blackAndWhite, setBlackAndWhite] = useStoredValue<boolean>("blackAndWhite", false)
  const [order,setOrder] = useStoredValue<readonly MiscSectionId[]>("miscSectionOrder", DEFAULT_TOOL_ORDER)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", readSetting("darkTheme", dark, true))
  }, [dark])

  const toggle = (enabled: boolean) => {
    document.documentElement.classList.toggle("dark", enabled)
    updateBootState({ dark: enabled })
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
        title: "Couldn’t import that file",
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
        title: "Couldn’t import that file",
        description: error instanceof Error ? error.message : "The settings file could not be read.",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleResetClick = async () => {
    setConfirmReset(false)
    setBusy(true)
    try {
      await resetSettings()
      toast({
        title: "Settings reset",
        description: "All preferences were reset to defaults.",
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
      <SwitchRow label="Dark theme" checked={dark} onChange={toggle}/>
      <SwitchRow label="Black and white" description="Show all websites in grayscale." checked={blackAndWhite} onChange={enabled=>void setBlackAndWhite(enabled).catch(error=>toast({title:String(error),variant:"destructive"}))}/>

      <h2 className={popupSectionTitle}>Backup and reset</h2>
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy}
          variant="outline"
          className="flex-1"
          onClick={() => void onExport()}
        >
          Export
        </Button>
        <Button
          type="button"
          disabled={busy}
          variant="outline"
          className="flex-1"
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </Button>
      </div>

      <div className="pt-1">
        <Button
          type="button"
          disabled={busy}
          variant="outline"
          className="w-full zed-btn--warn-outline"
          onClick={() => setConfirmReset(true)}
        >
          Reset settings to defaults
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void onImport(event)}
      />

      <details><summary className="zed-helper">Tool order</summary><div className="zed-stack">{order.map((id,index)=><div className="zed-row" key={id}><span className="flex-1">{({password:"Password generator",playback:"Playback speed",volume:"Volume boost",quality:"Video quality",scrollbars:"Scrollbars",modes:"Modes",screenshot:"Capture screenshot"})[id]}</span>{[-1,1].map(delta=><Button size="sm" key={delta} disabled={index+delta<0||index+delta>=order.length} aria-label={`Move ${id} ${delta<0?"up":"down"}`} onClick={()=>{const next=moveMiscSection(order,index,index+delta);void setOrder(next).catch(error=>toast({title:String(error),variant:"destructive"}))}}>{delta<0?"↑":"↓"}</Button>)}</div>)}</div></details>

      <section aria-labelledby="zed-about-heading" className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 id="zed-about-heading" className={popupSectionTitle}>About Extension Zed</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          A local browser toolbox for screenshots, video speed and quality, volume boost,
          YouTube layout, password generation, page inspection and editing, scrollbars, Arabic text,
          and extension management. Your settings and captures stay on your device.
        </p>
        <h3 className="text-sm font-medium">Tools it can replace</h3>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li><strong className="text-foreground">GoFullPage:</strong> full-page screenshots.</li>
          <li><strong className="text-foreground">Video Speed Controller:</strong> adjusting video playback speed.</li>
          <li><strong className="text-foreground">Volume Master:</strong> boosting tab media volume.</li>
          <li><strong className="text-foreground">Enhancer for YouTube:</strong> video speed, volume, quality, and larger-player controls.</li>
          <li><strong className="text-foreground">Extensity:</strong> enabling and disabling extensions.</li>
        </ul>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These are overlapping tasks, not every feature of those extensions. Website and player support varies.
        </p>
      </section>

      <div className="border-t border-border/70 pt-3">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between"
          aria-expanded={showPrivacy}
          onClick={() => setShowPrivacy(!showPrivacy)}
        >
          <span>Privacy & Permissions</span>
          <span>{showPrivacy ? "−" : "+"}</span>
        </Button>
        {showPrivacy && (
          <div className="mt-2 space-y-1.5 rounded-[var(--zed-radius-lg)] bg-muted/40 p-2.5 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Local & Private by Design</p>
            <p>
              Extension Zed executes exclusively in your browser. No telemetry, browsing history, or personal data is collected or sent to external servers.
            </p>
            <ul className="list-disc pl-3.5 space-y-1 pt-1">
              <li>
                <strong className="text-foreground">storage:</strong> stores your theme and playback preferences locally on this device.
              </li>
              <li><strong className="text-foreground">activeTab & scripting:</strong> runs requested page tools. Automatic playback, quality, and Arabic text helpers also run on HTTP(S) pages.</li>
              <li><strong className="text-foreground">clipboardWrite:</strong> copies a screenshot when you press Copy.</li>
              <li><strong className="text-foreground">debugger:</strong> captures the full rendered page without scrolling, then disconnects.</li>
              <li><strong className="text-foreground">management (optional):</strong> lists and manages extensions after you allow access.</li>
            </ul>
          </div>
        )}
      </div>
      {confirmReset&&<Dialog title="Reset settings to defaults?" onClose={()=>setConfirmReset(false)}><p>Every option and keyboard shortcut goes back to its default. This can’t be undone.</p><div className="zed-grid"><Button size="sm" onClick={()=>setConfirmReset(false)}>Cancel</Button><Button size="sm" variant="destructive" disabled={busy} onClick={()=>void handleResetClick()}>Reset settings</Button></div></Dialog>}
    </section>
  )
}
