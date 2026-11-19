import { createRequire } from "node:module"
import { vi as bunVi } from "bun:test"

export * from "bun:test"

const requireForCache = createRequire(import.meta.url)
const realSetTimeout = globalThis.setTimeout.bind(globalThis)
const savedGlobals = new Map<string, { present: boolean; value: unknown }>()
const savedEnvs = new Map<string, string | undefined>()

function moduleCache() {
  const globalRequire = (globalThis as { require?: { cache?: Record<string, unknown> } }).require
  return globalRequire?.cache ?? requireForCache.cache
}

/**
 * Bun 1.4.4 implements the core Vitest surface but not these helpers. They keep
 * the existing tests' setup and teardown close to their original Vitest form.
 */
export const vi = Object.assign(bunVi, {
  stubGlobal(name: string, value: unknown) {
    if (!savedGlobals.has(name)) {
      savedGlobals.set(name, { present: name in globalThis, value: (globalThis as Record<string, unknown>)[name] })
    }
    ;(globalThis as Record<string, unknown>)[name] = value
  },
  unstubAllGlobals() {
    for (const [name, saved] of savedGlobals) {
      if (saved.present) (globalThis as Record<string, unknown>)[name] = saved.value
      else delete (globalThis as Record<string, unknown>)[name]
    }
    savedGlobals.clear()
  },
  stubEnv(name: string, value: string | undefined) {
    if (!savedEnvs.has(name)) savedEnvs.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  },
  unstubAllEnvs() {
    for (const [name, value] of savedEnvs) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    savedEnvs.clear()
  },
  mocked<T>(value: T): T {
    return value
  },
  hoisted<T>(factory: () => T): T {
    return factory()
  },
  waitFor<T>(callback: () => T | Promise<T>, options: { timeout?: number; interval?: number } = {}): Promise<T> {
    const timeout = options.timeout ?? 1000
    const interval = options.interval ?? 10
    const attempts = Math.max(1, Math.ceil(timeout / interval))
    return (async () => {
      let lastError: unknown
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          return await callback()
        } catch (error) {
          lastError = error
        }
        await new Promise<void>((resolve) => realSetTimeout(resolve, interval))
      }
      throw lastError ?? new Error("waitFor timed out")
    })()
  },
  async advanceTimersByTimeAsync(ms: number) {
    const flush = async () => {
      for (let turn = 0; turn < 8; turn += 1) await Promise.resolve()
    }
    // Let promise chains schedule their timers before advancing the clock.
    await flush()
    bunVi.advanceTimersByTime(ms)
    // Promise callbacks may schedule more zero-delay timers; run them too.
    for (let round = 0; round < 4; round += 1) {
      await flush()
      bunVi.advanceTimersByTime(0)
    }
    await flush()
  },
  setSystemTime(now: Date | number = Date.now()) {
    // Bun has the clock option but not Vitest's setSystemTime entry point.
    bunVi.useFakeTimers({ now })
  },
  resetModules() {
    const cache = moduleCache()
    if (!cache) return
    for (const key of Object.keys(cache)) {
      if (!key.includes("node_modules")) delete cache[key]
    }
  },
})
