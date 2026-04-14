import { useCallback, useEffect, useRef, useState } from "react"
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
import { withActiveTab } from "@/lib/withActiveTab"
import { cn } from "@/lib/utils"

const STORAGE_BG = "background-color"
const STORAGE_COLOR = "color"
const DEFAULT_BG = "#1a1a1a"
const DEFAULT_FG = "#f5f5f5"

const ChangeColors = () => {
  const bgPickerRef = useRef<HTMLInputElement>(null)
  const textPickerRef = useRef<HTMLInputElement>(null)
  const [bg, setBg] = useState(DEFAULT_BG)
  const [fg, setFg] = useState(DEFAULT_FG)

  useEffect(() => {
    chrome.storage.local.get([STORAGE_BG, STORAGE_COLOR]).then((r) => {
      if (typeof r[STORAGE_BG] === "string") setBg(r[STORAGE_BG])
      if (typeof r[STORAGE_COLOR] === "string") setFg(r[STORAGE_COLOR])
    })
  }, [])

  const applyBackground = useCallback((hex: string) => {
    setBg(hex)
    withActiveTab((tabId) => {
      void chrome.storage.local.set({ [STORAGE_BG]: hex }).then(() => {
        chrome.runtime.sendMessage({ event: "changeBackgroundColor", tabId })
      })
    })
  }, [])

  const applyTextColor = useCallback((hex: string) => {
    setFg(hex)
    withActiveTab((tabId) => {
      void chrome.storage.local.set({ [STORAGE_COLOR]: hex }).then(() => {
        chrome.runtime.sendMessage({ event: "changeColor", tabId })
      })
    })
  }, [])

  const resetBackgroundDefault = useCallback(() => {
    withActiveTab((tabId) => {
      void chrome.storage.local.remove([STORAGE_BG]).then(() => {
        chrome.runtime.sendMessage({ event: "resetBackgroundOnly", tabId })
      })
    })
  }, [])

  const resetTextDefault = useCallback(() => {
    withActiveTab((tabId) => {
      void chrome.storage.local.remove([STORAGE_COLOR]).then(() => {
        chrome.runtime.sendMessage({ event: "resetTextColorOnly", tabId })
      })
    })
  }, [])

  const resetAll = useCallback(() => {
    setBg(DEFAULT_BG)
    setFg(DEFAULT_FG)
    withActiveTab((tabId) => {
      void chrome.storage.local.remove([STORAGE_BG, STORAGE_COLOR]).then(() => {
        chrome.runtime.sendMessage({ event: "resetPageColors", tabId })
      })
    })
  }, [])

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

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">Backgrounds</Label>
          <div className={popupControlRow}>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={() => bgPickerRef.current?.click()}
            >
              Change
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={resetBackgroundDefault}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium text-foreground">Text</Label>
          <div className={popupControlRow}>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={() => textPickerRef.current?.click()}
            >
              Change
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-10 flex-1 sm:flex-none"
              onClick={resetTextDefault}
            >
              Reset
            </Button>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          className={cn(shortcutHostClassName, "min-h-10 w-full")}
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
