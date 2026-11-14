import { Button } from "./ui/button"
import { useState } from "react"
import MiscSection, { type MiscSectionProps } from "./MiscSection"
import { SCREENSHOT_MODES, type ScreenshotMode } from "@/lib/screenshotModes"

const labels: Record<ScreenshotMode, string> = { area: "Selected area", visible: "Visible area", full: "Full page", element: "Element" }
const paths: Record<ScreenshotMode, string> = {
  area: "M5 2H2v3m9-3h3v3M2 11v3h3m9-3v3h-3M4.5 5.5h2l1-1h2l1 1h1v6h-7zM9.5 8.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0",
  visible: "M2 5V2h12v3M2 11v3h3m9-3v3h-3M2 5h12M6 9l2-2 2 2m-2-2v6M2 8v1m12-1v1",
  full: "M2 2h12v12H2zM5 5V4h1m4 0h1v1M5 11V10m0 1h1m4 0h1v-1M8 5v6m-2-2 2 2 2-2",
  element: "M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4M5 5h6v6H5z",
}

export default function ScreenshotSection(props: MiscSectionProps) {
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function start(mode: ScreenshotMode) {
    setBusy(true)
    setError("")
    try {
      const result = await chrome.runtime.sendMessage({ type: "screenshot:start", mode })
      if (!result?.ok) throw new Error(result?.error || "Could not start screenshot")
      window.close()
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
      setBusy(false)
    }
  }
  return (
    <MiscSection {...props} title="Capture screenshot" id="zed-screenshot-heading">
      <div className="flex flex-col gap-2">
        {SCREENSHOT_MODES.map((mode) => (
          <Button variant="outline" key={mode} type="button" disabled={busy} onClick={() => void start(mode)}
            className="min-h-9 justify-start gap-2">
            <svg data-icon="inline-start" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d={paths[mode]} /></svg>
            {labels[mode]}
          </Button>
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </MiscSection>
  )
}
