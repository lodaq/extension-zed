import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { popupControlRow, popupSubhead, popupDescription } from "@/lib/popupLayout"
import { sendPageAction } from "@/lib/withActiveTab"
import { isColor } from "@/lib/settings"

const DEFAULT_BG = "#1a1a1a"
const DEFAULT_FG = "#f5f5f5"

const COLOR_PRESETS = [
  { name: "Dark", bg: "#18181b", fg: "#f4f4f5" },
  { name: "High Contrast", bg: "#000000", fg: "#ffffff" },
  { name: "Sepia", bg: "#fbf0d9", fg: "#433422" },
  { name: "Solarized", bg: "#002b36", fg: "#93a1a1" },
] as const

const ChangeColors = ({ dragHandle, open, onOpenChange }: MiscSectionProps) => {
  const bgPickerRef = useRef<HTMLInputElement>(null)
  const textPickerRef = useRef<HTMLInputElement>(null)
  const [bg, setBg] = useState(DEFAULT_BG)
  const [fg, setFg] = useState(DEFAULT_FG)
  const [storageKey, setStorageKey] = useState<string | null>(null)

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.url?.startsWith("http")) return
        const key = `pageColors:${new URL(tab.url).origin}`
        setStorageKey(key)
        if (chrome.storage?.local) {
          chrome.storage.local.get([key]).then((r) => {
            const settings = r[key] as { background?: string; text?: string } | undefined
            if (isColor(settings?.background) && settings?.background) setBg(settings.background)
            if (isColor(settings?.text) && settings?.text) setFg(settings.text)
          })
        }
      })
      .catch(() => setStorageKey(null))
  }, [])

  const applyBackground = (hex: string) => {
    setBg(hex)
    void sendPageAction("changeBackgroundColor", "Background color applied", hex)
  }

  const applyTextColor = (hex: string) => {
    setFg(hex)
    void sendPageAction("changeColor", "Text color applied", hex)
  }

  const applyPreset = async (presetBg: string, presetFg: string, presetName: string) => {
    setBg(presetBg)
    setFg(presetFg)
    await sendPageAction("changeBackgroundColor", `${presetName} background applied`, presetBg)
    await sendPageAction("changeColor", `${presetName} text applied`, presetFg)
  }

  const resetBackgroundDefault = () => {
    setBg(DEFAULT_BG)
    void sendPageAction("resetBackgroundOnly", "Background color reset")
  }

  const resetTextDefault = () => {
    setFg(DEFAULT_FG)
    void sendPageAction("resetTextColorOnly", "Text color reset")
  }

  const resetAll = () => {
    setBg(DEFAULT_BG)
    setFg(DEFAULT_FG)
    void sendPageAction("resetPageColors", "Page colors reset")
  }

  return (
    <MiscSection dragHandle={dragHandle} open={open} onOpenChange={onOpenChange} title="Page colors" id="zed-colors-heading">
      <input
        ref={bgPickerRef}
        type="color"
        className="sr-only pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden
        value={bg}
        onChange={(e) => applyBackground(e.currentTarget.value)}
      />
      <input
        ref={textPickerRef}
        type="color"
        className="sr-only pointer-events-none absolute h-0 w-0 opacity-0"
        tabIndex={-1}
        aria-hidden
        value={fg}
        onChange={(e) => applyTextColor(e.currentTarget.value)}
      />

      <div className="flex flex-col gap-3">
        <div>
          <p className={popupSubhead}>Presets</p>
          <p className={popupDescription}>Quick-apply curated color palettes to this website.</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {COLOR_PRESETS.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                variant="outline"
                size="sm"
                disabled={!storageKey}
                className="flex items-center justify-start gap-2 text-xs"
                onClick={() => void applyPreset(preset.bg, preset.fg, preset.name)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: preset.bg, color: preset.fg }}
                  title={`${preset.name} swatch`}
                />
                <span className="truncate">{preset.name}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="border-t border-border/70 pt-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm font-medium text-foreground">Background</Label>
            <div className={popupControlRow}>
              <Button
                type="button"
                size="sm"
                disabled={!storageKey}
                className="min-h-9 flex-1 sm:flex-none"
                onClick={() => bgPickerRef.current?.click()}
              >
                Change
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!storageKey}
                className="min-h-9 flex-1 sm:flex-none"
                onClick={resetBackgroundDefault}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-foreground">Text</Label>
          <div className={popupControlRow}>
            <Button
              type="button"
              size="sm"
              disabled={!storageKey}
              className="min-h-9 flex-1 sm:flex-none"
              onClick={() => textPickerRef.current?.click()}
            >
              Change
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!storageKey}
              className="min-h-9 flex-1 sm:flex-none"
              onClick={resetTextDefault}
            >
              Reset
            </Button>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={!storageKey}
          className="min-h-9 w-full"
          onClick={resetAll}
        >
          Reset all colors
        </Button>
      </div>
    </MiscSection>
  )
}

export default ChangeColors
