import { useCallback, useEffect, useRef, useState } from "react"
import { mirrorBootValue, readBootState } from "./bootCache"
import { readSetting } from "./settings"

export function useStoredValue<T>(key: string, initialValue: T | (() => T), optimistic = false) {
  const hasStorage = typeof chrome !== "undefined" && Boolean(chrome.storage?.local)
  const resolveInitial = (): T => {
    if (key === "popupLocation") {
      const location = readBootState().location
      if (location) return location as T
    }
    if (key === "darkTheme") {
      const dark = readBootState().dark
      if (typeof dark === "boolean") return dark as unknown as T
      if (typeof document !== "undefined" && document.documentElement) {
        return document.documentElement.classList.contains("dark") as unknown as T
      }
    }
    if (key === "miscSectionOrder") {
      const order = readBootState().order
      if (Array.isArray(order)) return order as unknown as T
    }
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue
  }

  const [value, setValue] = useState<T>(resolveInitial)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  const writeVersion = useRef(0)
  const writesInFlight = useRef(0)
  useEffect(() => {
    const initialVersion = writeVersion.current
    let acceptInitialRead = true
    const fallback = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue
    const hasOnChanged = typeof chrome !== "undefined" && Boolean(chrome.storage?.onChanged)

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "local" && changes[key]) {
        acceptInitialRead = false
        if (optimistic && writesInFlight.current) return
        const next = readSetting(key, changes[key].newValue, fallback)
        mirrorBootValue(key, next)
        setValue(next)
        setLoadedKey(key)
      }
    }
    if (hasOnChanged) {
      chrome.storage.onChanged.addListener(listener)
    }
    if (hasStorage) {
      chrome.storage.local
        .get([key])
        .then((result) => {
          if (acceptInitialRead && initialVersion === writeVersion.current) {
            const next = readSetting(key, result[key], fallback)
            mirrorBootValue(key, next)
            setValue(next)
            setLoadedKey(key)
          }
        })
        .catch(() => {
          if (acceptInitialRead && initialVersion === writeVersion.current) {
            setValue(fallback)
            setLoadedKey(key)
          }
        })
    }
    return () => {
      acceptInitialRead = false
      if (hasOnChanged) {
        chrome.storage.onChanged.removeListener(listener)
      }
    }
  }, [initialValue, key, hasStorage, optimistic])

  const setStoredValue = useCallback(async (next: T) => {
    const version = ++writeVersion.current
    if (optimistic) {
      setValue(next)
      setLoadedKey(key)
    }
    mirrorBootValue(key, next)
    if (!hasStorage) return
    writesInFlight.current++
    try {
      await chrome.storage.local.set({ [key]: next })
    } catch (error) {
      if (optimistic && version === writeVersion.current) {
        const stored = await chrome.storage.local.get(key).catch(() => null)
        if (stored && version === writeVersion.current) {
          const fallback = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue
          const current = readSetting(key, stored[key], fallback)
          mirrorBootValue(key, current)
          setValue(current)
        }
      }
      throw error
    } finally {
      writesInFlight.current--
    }
  }, [key, hasStorage, initialValue, optimistic])

  return [value, setStoredValue, loadedKey === key || !hasStorage] as const
}
