import { useSyncExternalStore, type ReactNode } from "react"
import type { ToastProps } from "./toast"

type ToastItem = ToastProps & { id: string; title?: ReactNode; description?: ReactNode }
const listeners = new Set<() => void>()
const removalTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
let toasts: ToastItem[] = []
let nextId = 0

function publish(next: ToastItem[]) {
  toasts = next
  listeners.forEach(listener => listener())
}

function dismiss(id?: string) {
  const dismissed = toasts.filter(item => id === undefined || item.id === id)
  publish(toasts.map(item => dismissed.includes(item) ? { ...item, open: false } : item))
  for (const item of dismissed) {
    if (removalTimeouts.has(item.id)) continue
    removalTimeouts.set(item.id, setTimeout(() => {
      removalTimeouts.delete(item.id)
      publish(toasts.filter(current => current.id !== item.id))
    }, 1000))
  }
}

export function toast(props: Omit<ToastItem, "id">) {
  const id = String(++nextId)
  const close = () => dismiss(id)
  publish([{ ...props, id, onOpenChange: open => { if (!open) close() } }])
  return { id, dismiss: close }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const getSnapshot = () => toasts

export function useToast() {
  return { toasts: useSyncExternalStore(subscribe, getSnapshot, getSnapshot), toast, dismiss }
}
