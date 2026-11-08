import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useStoredValue } from "./useStoredValue"

const hooks = vi.hoisted(() => ({
  setValue: vi.fn(),
  effect: undefined as undefined | (() => void | (() => void)),
}))
vi.mock("react", () => ({
  useState: (initial: unknown) => [typeof initial === "function" ? (initial as () => unknown)() : initial, hooks.setValue],
  useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect },
  useRef: (initial: unknown) => ({ current: initial }),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

type Listener = Parameters<typeof chrome.storage.onChanged.addListener>[0]
let listeners: Set<Listener>
let read: ReturnType<typeof deferred<Record<string, unknown>>>
let write: ReturnType<typeof deferred<void>>
let cleanup: (() => void) | void

function StoredValueHarness() {
  return useStoredValue("darkTheme", true)
}
function mount() {
  const result = StoredValueHarness()
  cleanup = hooks.effect?.()
  return result
}
function change(value: unknown, area: Parameters<Listener>[1] = "local", key = "darkTheme") {
  for (const listener of listeners) listener({ [key]: { newValue: value } }, area)
}
async function settle() { await Promise.resolve(); await Promise.resolve() }

beforeEach(() => {
  hooks.setValue.mockClear()
  listeners = new Set()
  read = deferred()
  write = deferred()
  vi.stubGlobal("chrome", { storage: {
    local: { get: vi.fn(() => read.promise), set: vi.fn(() => write.promise) },
    onChanged: {
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
    },
  } })
})
afterEach(() => { cleanup?.(); vi.unstubAllGlobals() })

it.each(["resolve", "reject"] as const)("keeps live changes when the startup read later %ss", async (outcome) => {
  mount()
  change(false)
  if (outcome === "resolve") read.resolve({ darkTheme: true })
  else read.reject(new Error("read failed"))
  await settle()
  expect(hooks.setValue.mock.calls).toEqual([[false]])
  change(true)
  expect(hooks.setValue).toHaveBeenLastCalledWith(true)
})

it.each(["resolve", "reject"] as const)("ignores startup read %s after cleanup", async (outcome) => {
  mount()
  cleanup?.()
  expect(listeners.size).toBe(0)
  if (outcome === "resolve") read.resolve({ darkTheme: false })
  else read.reject(new Error("read failed"))
  await settle()
  expect(hooks.setValue).not.toHaveBeenCalled()
})

it("loads validated preferences and falls back for deleted or invalid values", async () => {
  mount()
  change(false, "sync")
  change(false, "local", "unrelated")
  read.resolve({ darkTheme: false })
  await settle()
  expect(hooks.setValue).toHaveBeenLastCalledWith(false)
  change(undefined)
  expect(hooks.setValue).toHaveBeenLastCalledWith(true)
  change("invalid")
  expect(hooks.setValue).toHaveBeenLastCalledWith(true)
})

it("uses the default when the initial read fails without a live update", async () => {
  mount()
  read.reject(new Error("read failed"))
  await settle()
  expect(hooks.setValue).toHaveBeenLastCalledWith(true)
})

it("does not overwrite live state when an older save completes", async () => {
  const [, save] = mount()
  const pending = save(false)
  expect(chrome.storage.local.set).toHaveBeenCalledWith({ darkTheme: false })
  change(false)
  change(true)
  write.resolve()
  await pending
  expect(hooks.setValue.mock.calls).toEqual([[false], [true]])
})

it("propagates save errors without changing displayed state", async () => {
  const [, save] = mount()
  const pending = save(false)
  write.reject(new Error("write failed"))
  await expect(pending).rejects.toThrow("write failed")
  expect(hooks.setValue).not.toHaveBeenCalled()
})

it("does not update state when a save completes after cleanup", async () => {
  const [, save] = mount()
  const pending = save(false)
  cleanup?.()
  write.resolve()
  await pending
  expect(hooks.setValue).not.toHaveBeenCalled()
})

it("initializes synchronously from functional initial value", () => {
  const getter = vi.fn(() => false)
  const [val] = useStoredValue("customKey", getter)
  expect(val).toBe(false)
  expect(getter).toHaveBeenCalledOnce()
})
