import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import {
  popupControlRow,
  popupPanel,
  popupSectionInner,
  popupSectionTitle,
} from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import { sendPageAction } from "@/lib/withActiveTab"
import { cn } from "@/lib/utils"
import { isColor } from "@/lib/settings"

const DEFAULT_BG = "#1a1a1a"
const DEFAULT_FG = "#f5f5f5"

const ChangeColors = () => {
  const bgPickerRef = useRef<HTMLInputElement>(null)
  const textPickerRef = useRef<HTMLInputElement>(null)
  const [bg, setBg] = useState(DEFAULT_BG)
  const [fg, setFg] = useState(DEFAULT_FG)
  const [storageKey, setStorageKey] = useState<string | null>(null)

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.url?.startsWith("http")) return
      const key = `pageColors:${new URL(tab.url).origin}`
      setStorageKey(key)
      chrome.storage.local.get([key]).then((r) => {
        const settings = r[key] as { background?: string; text?: string } | undefined
        if (isColor(settings?.background) && settings?.background) setBg(settings.background)
        if (isColor(settings?.text) && settings?.text) setFg(settings.text)
      })
    }).catch(() => setStorageKey(null))
  }, [])

  const applyBackground = (hex: string) => {
    setBg(hex)
    void sendPageAction("changeBackgroundColor", "Background color applied", hex)
  }

  const applyTextColor = (hex: string) => {
    setFg(hex)
    void sendPageAction("changeColor", "Text color applied", hex)
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
    <section
      className={cn(popupPanel, popupSectionInner)}
      aria-labelledby="zed-colors-heading"
    >
      <h2 id="zed-colors-heading" className={popupSectionTitle}>
        Page colors
      </h2>

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
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm font-medium text-foreground">Backgrounds</Label>
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
          className={cn(shortcutHostClassName, "min-h-9 w-full")}
          onClick={resetAll}
        >
          Reset all colors
          <ShortcutKbd label={KBD.resetPageColors} />
        </Button>
      </div>
    </section>
  )
}

export default ChangeColors
