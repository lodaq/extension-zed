import { useEffect, useState } from "react"
import { mirrorBootValue } from "./bootCache"
import { readSetting } from "./settings"

export function useStoredValue<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    let acceptInitialRead = true
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "local" && changes[key]) {
        acceptInitialRead = false
        const next = readSetting(key, changes[key].newValue, initialValue)
        mirrorBootValue(key, next)
        setValue(next)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    chrome.storage.local.get([key]).then((result) => {
      if (acceptInitialRead) {
        const next = readSetting(key, result[key], initialValue)
        mirrorBootValue(key, next)
        setValue(next)
      }
    }).catch(() => {
      if (acceptInitialRead) setValue(initialValue)
    })
    return () => {
      acceptInitialRead = false
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [initialValue, key])

  const setStoredValue = (next: T) => {
    mirrorBootValue(key, next)
    return chrome.storage.local.set({ [key]: next })
  }

  return [value, setStoredValue] as const
}
