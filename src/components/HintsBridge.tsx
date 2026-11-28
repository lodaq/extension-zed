import { useCallback, useEffect, useRef } from "react"
import { DEFAULT_HINT_MODE, showClickHints } from "@/lib/clickHints"
import { useStoredValue } from "@/lib/useStoredValue"

export default function HintsBridge({
  locationKey,
  shortcuts,
  registerTrigger,
}: {
  locationKey: string
  shortcuts: Record<string, string>
  registerTrigger: (trigger: (() => boolean) | null) => void
}) {
  const [hintMode] = useStoredValue("hintMode", DEFAULT_HINT_MODE)
  const clearHints = useRef<(() => void) | undefined>(undefined)

  const trigger = useCallback(() => {
    if (hintMode === "off") return false
    if (hintMode === "always" && clearHints.current) return true
    clearHints.current?.()
    clearHints.current = showClickHints(hintMode === "always")
    return true
  }, [hintMode])

  useEffect(() => {
    registerTrigger(trigger)
    return () => registerTrigger(null)
  }, [registerTrigger, trigger])

  useEffect(() => {
    if (hintMode !== "always") return
    clearHints.current = showClickHints(true)
    return () => {
      clearHints.current?.()
      clearHints.current = undefined
    }
  }, [hintMode])

  useEffect(() => {
    if (hintMode === "always") return
    clearHints.current?.()
    clearHints.current = undefined
  }, [hintMode, locationKey, shortcuts])

  useEffect(() => () => {
    clearHints.current?.()
    clearHints.current = undefined
  }, [])

  return null
}
