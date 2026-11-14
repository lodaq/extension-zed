import { Icon } from "@/design-system/Icon"
import { Button } from "./ui/button"
import { useState } from "react"
import MiscSection, { type MiscSectionProps } from "./MiscSection"
import { SCREENSHOT_MODES, type ScreenshotMode } from "@/lib/screenshotModes"

const labels: Record<ScreenshotMode, string> = { area: "Selected area", visible: "Visible area", full: "Full page", element: "Element" }

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
      <div className="zed-captures">
        {SCREENSHOT_MODES.map((mode) => (
          <Button variant="outline" key={mode} type="button" disabled={busy} onClick={() => void start(mode)}
            className="zed-capture">
            <span className="zed-well"><Icon name={mode} size={26}/></span>
            {labels[mode]}
          </Button>
        ))}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </MiscSection>
  )
}
