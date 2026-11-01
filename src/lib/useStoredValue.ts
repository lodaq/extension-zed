import { useEffect, useState } from "react"

export function useStoredValue<T>(key: string, initialValue: T) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    chrome.storage.local.get([key]).then((result) => {
      setValue((result[key] as T | undefined) ?? initialValue)
    })
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "local" && changes[key]) {
        setValue((changes[key].newValue as T | undefined) ?? initialValue)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [initialValue, key])

  const setStoredValue = (next: T) => {
    setValue(next)
    return chrome.storage.local.set({ [key]: next })
  }

  return [value, setStoredValue] as const
}
