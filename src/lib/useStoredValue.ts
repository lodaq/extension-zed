import { useEffect, useState } from "react"
import { readSetting } from "./settings"

export function useStoredValue<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    let acceptInitialRead = true
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "local" && changes[key]) {
        acceptInitialRead = false
        setValue(readSetting(key, changes[key].newValue, initialValue))
      }
    }
    chrome.storage.onChanged.addListener(listener)
    chrome.storage.local.get([key]).then((result) => {
      if (acceptInitialRead) setValue(readSetting(key, result[key], initialValue))
    }).catch(() => {
      if (acceptInitialRead) setValue(initialValue)
    })
    return () => {
      acceptInitialRead = false
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [initialValue, key])

  const setStoredValue = (next: T) => {
    return chrome.storage.local.set({ [key]: next })
  }

  return [value, setStoredValue] as const
}
