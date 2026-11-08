import { useEffect, useState } from "react"
import { mirrorBootValue, readBootState } from "./bootCache"
import { readSetting } from "./settings"

export function useStoredValue<T>(key: string, initialValue: T | (() => T)) {
  const resolveInitial = (): T => {
    const boot = readBootState()
    if (key === "darkTheme") {
      if (typeof boot.dark === "boolean") return boot.dark as unknown as T
      if (typeof document !== "undefined" && document.documentElement) {
        return document.documentElement.classList.contains("dark") as unknown as T
      }
    }
    if (key === "miscSectionOrder" && Array.isArray(boot.order)) {
      return boot.order as unknown as T
    }
    if (key === "miscExpandedSections" && Array.isArray(boot.expanded)) {
      return boot.expanded as unknown as T
    }
    if (key === "popupActiveTab" && typeof boot.tab === "string") {
      return boot.tab as unknown as T
    }
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue
  }

  const [value, setValue] = useState<T>(resolveInitial)

  useEffect(() => {
    let acceptInitialRead = true
    const fallback = typeof initialValue === "function" ? (initialValue as () => T)() : initialValue
    const hasStorage = typeof chrome !== "undefined" && Boolean(chrome.storage?.local)
    const hasOnChanged = typeof chrome !== "undefined" && Boolean(chrome.storage?.onChanged)

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "local" && changes[key]) {
        acceptInitialRead = false
        const next = readSetting(key, changes[key].newValue, fallback)
        mirrorBootValue(key, next)
        setValue(next)
      }
    }
    if (hasOnChanged) {
      chrome.storage.onChanged.addListener(listener)
    }
    if (hasStorage) {
      chrome.storage.local
        .get([key])
        .then((result) => {
          if (acceptInitialRead) {
            const next = readSetting(key, result[key], fallback)
            mirrorBootValue(key, next)
            setValue(next)
          }
        })
        .catch(() => {
          if (acceptInitialRead) setValue(fallback)
        })
    }
    return () => {
      acceptInitialRead = false
      if (hasOnChanged) {
        chrome.storage.onChanged.removeListener(listener)
      }
    }
  }, [initialValue, key])

  const setStoredValue = (next: T) => {
    mirrorBootValue(key, next)
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return chrome.storage.local.set({ [key]: next })
    }
    return Promise.resolve()
  }

  return [value, setStoredValue] as const
}
