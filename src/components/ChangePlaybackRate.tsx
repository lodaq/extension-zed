import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import {
  popupControlRow,
  popupPanel,
  popupSectionInner,
  popupSectionTitle,
} from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import {
  PLAYBACK_PRESETS,
  clampPlayback,
  nearestPreset,
  presetIndex,
} from "@/lib/playbackPresets"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "speed"

const applySpeed = (rate: number) => {
  const s = String(rate)
  chrome.storage.local.set({ [STORAGE_KEY]: s })
}

const ChangePlaybackRate = () => {
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    chrome.storage.local.get([STORAGE_KEY]).then((r) => {
      const n = Number(r[STORAGE_KEY])
      if (Number.isFinite(n) && n > 0) setSpeed(nearestPreset(clampPlayback(n)))
    })
  }, [])

  useEffect(() => {
    const onChanged: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area
    ) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return
      const n = Number(changes[STORAGE_KEY].newValue)
      if (Number.isFinite(n) && n > 0) setSpeed(nearestPreset(clampPlayback(n)))
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const step = useCallback((delta: number) => {
    setSpeed((prev) => {
      const i = presetIndex(prev)
      const next = PLAYBACK_PRESETS[Math.min(PLAYBACK_PRESETS.length - 1, Math.max(0, i + delta))]
      applySpeed(next)
      return next
    })
  }, [])

  const onSelect = useCallback((value: string) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return
    const next = clampPlayback(n)
    setSpeed(next)
    applySpeed(next)
  }, [])

  const setNormal = useCallback(() => {
    setSpeed(1)
    applySpeed(1)
  }, [])

  const setDouble = useCallback(() => {
    setSpeed(2)
    applySpeed(2)
  }, [])

  return (
    <section
      className={cn(popupPanel, popupSectionInner)}
      aria-labelledby="zed-playback-heading"
    >
      <h2 id="zed-playback-heading" className={popupSectionTitle}>
        Playback speed
      </h2>

      <div className="flex flex-col gap-4">

        <div className={cn(popupControlRow, "items-stretch")}>
          <Button
            type="button"
            size="icon"
            className={cn(shortcutHostClassName, "h-11 w-11 shrink-0")}
            aria-label="Slower"
            onClick={() => step(-1)}
          >
            <span className="text-lg leading-none">−</span>
            <ShortcutKbd label={KBD.playbackSlower} className="scale-[0.85]" />
          </Button>
          <select
            id="zed-playback-rate"
            className="relative z-0 h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-center text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={String(speed)}
            onChange={(e) => onSelect(e.target.value)}
          >
            {PLAYBACK_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === 1 ? "1× normal" : `${p}×`}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="icon"
            className={cn(shortcutHostClassName, "h-11 w-11 shrink-0")}
            aria-label="Faster"
            onClick={() => step(1)}
          >
            <span className="text-lg leading-none">+</span>
            <ShortcutKbd label={KBD.playbackFaster} className="scale-[0.85]" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            size="sm"
            className={cn(shortcutHostClassName, "h-11 w-full")}
            aria-label="Normal speed (1×)"
            onClick={setNormal}
          >
            1× Normal
            <ShortcutKbd label={KBD.playbackNormal} />
          </Button>
          <Button
            type="button"
            size="sm"
            className={cn(shortcutHostClassName, "h-11 w-full")}
            aria-label="Double speed (2×)"
            onClick={setDouble}
          >
            2×
            <ShortcutKbd label={KBD.playbackDouble} />
          </Button>
        </div>
      </div>
    </section>
  )
}

export default ChangePlaybackRate
