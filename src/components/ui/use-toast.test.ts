import { afterEach, expect, it, vi } from "@/test/bun-test"

const subscriptions: { subscribe: undefined | ((listener: () => void) => () => void) } = { subscribe: undefined }
vi.mock("react", () => ({ useSyncExternalStore: (subscribe: typeof subscriptions.subscribe, snapshot: () => unknown) => {
  subscriptions.subscribe = subscribe
  return snapshot()
} }))
afterEach(() => { vi.useRealTimers(); vi.resetModules() })

it("keeps the latest toast and cannot remove it with an older dismissal timer", async () => {
  vi.useFakeTimers()
  const { toast, useToast } = await import("./use-toast")
  const first = toast({ title: "First" })
  const listener = vi.fn()
  useToast()
  const unsubscribe = subscriptions.subscribe!(listener)
  first.dismiss()
  first.dismiss()
  expect(useToast().toasts[0].open).toBe(false)
  const second = toast({ title: "Second", description: "Detail", variant: "destructive" })
  expect(useToast().toasts).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1000)
  expect(useToast().toasts[0]).toMatchObject({ id: second.id, title: "Second", description: "Detail", variant: "destructive" })
  unsubscribe()
  listener.mockClear()
  useToast().toasts[0].onOpenChange!(false)
  await vi.advanceTimersByTimeAsync(1000)
  expect(useToast().toasts).toEqual([])
  expect(listener).not.toHaveBeenCalled()
})

it("dismisses and removes all notifications through the hook", async () => {
  vi.useFakeTimers()
  const { toast, useToast } = await import("./use-toast")
  toast({ title: "Notice" })
  useToast().dismiss()
  expect(useToast().toasts[0].open).toBe(false)
  await vi.advanceTimersByTimeAsync(1000)
  expect(useToast().toasts).toEqual([])
})
