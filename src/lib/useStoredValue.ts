import { useEffect, useState } from "react"
import { readSetting } from "./settings"

export function useStoredValue<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    chrome.storage.local.get([key]).then((result) => {
      setValue(readSetting(key, result[key], initialValue))
    }).catch(() => setValue(initialValue))
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "local" && changes[key]) {
        setValue(readSetting(key, changes[key].newValue, initialValue))
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [initialValue, key])

  const setStoredValue = (next: T) => {
    return chrome.storage.local.set({ [key]: next }).then(() => setValue(next))
  }

  return [value, setStoredValue] as const
}
