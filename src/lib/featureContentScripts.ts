import type { FeatureId } from "./features"

type DynamicScriptDefinition = {
  id: string
  feature: FeatureId
  matches: string[]
  js: string[]
  runAt: "document_start" | "document_end" | "document_idle"
  allFrames?: boolean
  matchOriginAsFallback?: boolean
  world?: "MAIN" | "ISOLATED"
}

export const FEATURE_CONTENT_SCRIPTS: readonly DynamicScriptDefinition[] = [
  {
    id: "zed-feature-playback",
    feature: "playback",
    matches: ["https://*/*", "http://*/*"],
    js: ["scripts/playbackRatePersist.js"],
    runAt: "document_idle",
    allFrames: true,
    matchOriginAsFallback: true,
  },
  {
    id: "zed-feature-modes-rtl",
    feature: "modes",
    matches: ["https://*/*", "http://*/*"],
    js: ["scripts/arabicRtlMode.js"],
    runAt: "document_idle",
    allFrames: true,
  },
  {
    id: "zed-feature-quality-main",
    feature: "quality",
    matches: ["https://*/*", "http://*/*"],
    js: ["scripts/metaPlayback.js", "scripts/applyVideoQuality.js"],
    runAt: "document_idle",
    allFrames: true,
    matchOriginAsFallback: true,
    world: "MAIN",
  },
  {
    id: "zed-feature-quality-bridge",
    feature: "quality",
    matches: ["https://*/*", "http://*/*"],
    js: ["scripts/videoQualityBridge.js"],
    runAt: "document_idle",
    allFrames: true,
    matchOriginAsFallback: true,
  },
]

const ALL_DYNAMIC_SCRIPT_IDS = FEATURE_CONTENT_SCRIPTS.map((script) => script.id)
let pendingSync: Promise<void> = Promise.resolve()

/** Synchronize dynamic content script registrations with the user's installed features. */
export function syncFeatureContentScripts(installed: readonly FeatureId[]): Promise<void> {
  const task = pendingSync.then(async () => {
    if (!chrome.scripting?.getRegisteredContentScripts) return
    const installedSet = new Set(installed)
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ALL_DYNAMIC_SCRIPT_IDS })
    const existingIds = new Set(existing.map((script) => script.id))

    const toUnregister = existing
      .filter((script) => {
        const def = FEATURE_CONTENT_SCRIPTS.find((entry) => entry.id === script.id)
        return !def || !installedSet.has(def.feature)
      })
      .map((script) => script.id)

    if (toUnregister.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: toUnregister })
    }

    const toRegister = FEATURE_CONTENT_SCRIPTS.filter(
      (script) => installedSet.has(script.feature) && !existingIds.has(script.id)
    ).map(({ feature: _feature, ...registration }) => registration)

    if (toRegister.length > 0) {
      await chrome.scripting.registerContentScripts(toRegister)
    }
  })

  pendingSync = task.catch(() => {})
  return task
}
