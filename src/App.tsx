import { Activity, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from "react"
import { DEFAULT_PASSWORD_OPTIONS } from "@/lib/passwordGenerator"
import { QUALITY_OPTIONS } from "@/lib/videoQuality"
import { Icon } from "@/design-system/Icon"
import { Button } from "@/components/ui/button"
import { Card, Notice, Tile } from "@/design-system/components"
import { Toaster } from "@/components/ui/toast"
import { toast } from "@/components/ui/use-toast"
import { isRestrictedPage, PAGE_ACTION_FEEDBACK_EVENT } from "@/lib/withActiveTab"
import { useStoredValue } from "@/lib/useStoredValue"
import { saveCurrentTab } from "@/lib/links"
import { getStoredScrollPosition, saveStoredScrollPosition } from "@/lib/bootCache"
import { DEFAULT_SHORTCUTS, readShortcuts, recordCombo } from "@/lib/shortcuts"
import { DOWNLOADER_ENABLED } from "@/lib/downloader"
import { useDownloader } from "@/lib/useDownloader"
import { AVAILABLE_FEATURES, DEFAULT_INSTALLED_FEATURES, INSTALLED_FEATURES_KEY, isFeatureId, readInstalledFeatures, type FeatureDefinition, type FeatureId } from "@/lib/features"
import { TAB_IDS, TAB_LABELS, type TabId } from "@/lib/tabs"

const ExtensionsTab = lazy(() => import("@/components/ExtensionsTab"))
const SettingsTab = lazy(() => import("@/components/SettingsTab"))
const YoutubeTab = lazy(() => import("@/components/YoutubeTab"))
const SavedTab = lazy(() => import("@/components/SavedTab"))
const LinksTab = lazy(() => import("@/components/LinksTab").then((m) => ({ default: m.LinksTab })))
const ShortcutsTab = lazy(() => import("@/components/ShortcutsTab"))
const FeatureStore = lazy(() => import("@/components/FeatureStore"))
const HintsBridge = lazy(() => import("@/components/HintsBridge"))
const PasswordGenerator = lazy(() => import("@/components/PasswordGenerator"))
const VideoDownloader = lazy(() => import("@/components/VideoDownloader"))

const TOOL_COMPONENTS: Partial<Record<FeatureId, LazyExoticComponent<ComponentType>>> = {
  limiter: lazy(() => import("@/components/SiteLimiter")),
  playback: lazy(() => import("@/components/ChangePlaybackRate")),
  quality: lazy(() => import("@/components/VideoQualitySection")),
  volume: lazy(() => import("@/components/VolumeBooster")),
  scrollbars: lazy(() => import("@/components/ScrollbarsSection")),
  modes: lazy(() => import("@/components/ModesSection")),
  blackAndWhite: lazy(() => import("@/components/BlackAndWhiteSection")),
  capture: lazy(() => import("@/components/ScreenshotSection")),
  hints: lazy(() => import("@/components/KeyboardHintsSection")),
}

const DEFAULT_LOCATION: { tab: TabId; detail: string | null; settings: boolean } = { tab: "Misc", detail: null, settings: false }
const UNRESTRICTED_FEATURES = new Set<FeatureId>(["limiter", "password", "blackAndWhite", "hints", "saveTab"])

type TileProps = { feature: FeatureDefinition; disabled: boolean; onOpen: () => void }
const BADGE_TILES: Partial<Record<FeatureId, ComponentType<TileProps>>> = {
  playback: ({ feature, disabled, onOpen }) => {
    const [speed] = useStoredValue("speed", "1")
    return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={`${speed}×`} disabled={disabled} onClick={onOpen} />
  },
  volume: ({ feature, disabled, onOpen }) => {
    const [volume] = useStoredValue("volumeBoost", 100)
    return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={`${volume}%`} disabled={disabled} onClick={onOpen} />
  },
  quality: ({ feature, disabled, onOpen }) => {
    const [quality] = useStoredValue("videoQuality", "hd1080")
    const badge = quality === "auto" ? "Auto" : QUALITY_OPTIONS.find((o) => o.id === quality)?.label.replace(/ \(.+\)/, "") ?? quality
    return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={badge} disabled={disabled} onClick={onOpen} />
  },
  modes: ({ feature, disabled, onOpen }) => {
    const [inspect] = useStoredValue("inspectMode", "off")
    const [design] = useStoredValue("designMode", "off")
    const [rtl] = useStoredValue("arabicRtlMode", "off")
    const modesOn = [inspect, design, rtl].filter((v) => v === "on").length
    return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={modesOn ? `${modesOn} on` : undefined} disabled={disabled} onClick={onOpen} />
  },
  blackAndWhite: ({ feature, disabled, onOpen }) => {
    const [blackAndWhite] = useStoredValue<boolean>("blackAndWhite", false)
    return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={blackAndWhite ? "On" : "Off"} disabled={disabled} onClick={onOpen} />
  },
  hints: ({ feature, disabled, onOpen }) => {
    const [hintMode] = useStoredValue<"always" | "shortcut" | "off">("hintMode", "shortcut")
    const badge = hintMode === "always" ? "Always" : hintMode === "shortcut" ? "F key" : "Off"
    return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={badge} disabled={disabled} onClick={onOpen} />
  },
}

function DownloaderBridge({ detail, feature, showTile, onOpen }: { detail: string | null; feature: FeatureDefinition; showTile: boolean; onOpen: () => void }) {
  const download = useDownloader()
  const restored = useRef(false)
  useEffect(() => {
    if (detail === "downloader" || restored.current || !(download.phase === "downloading" || (download.phase === "done" && !download.seen))) return
    restored.current = true
    onOpen()
  }, [detail, download.phase, download.seen, onOpen])
  if (!showTile) return null
  const badge = download.phase === "downloading" ? (download.pct == null ? "Working" : `${download.pct}%`) : download.phase === "done" && !download.seen ? "Done" : undefined
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={badge} onClick={onOpen} />
}

const VideoDownloaderView = () => <VideoDownloader state={useDownloader()} />

export default function App() {
  const [dark] = useStoredValue("darkTheme", true)
  useLayoutEffect(() => { document.documentElement.classList.toggle("dark", dark) }, [dark])
  const tabbar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const nav = tabbar.current
    if (!nav) return
    const scrollTabs = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || nav.scrollWidth <= nav.clientWidth) return
      event.preventDefault()
      nav.scrollLeft += event.deltaY * (event.deltaMode === 1 ? nav.clientHeight : event.deltaMode === 2 ? nav.clientWidth : 1)
    }
    nav.addEventListener("wheel", scrollTabs, { passive: false })
    return () => nav.removeEventListener("wheel", scrollTabs)
  }, [])
  const [location, setLocation] = useStoredValue("popupLocation", DEFAULT_LOCATION)
  const { tab, detail, settings } = location
  const [storedInstalled] = useStoredValue<readonly FeatureId[]>(INSTALLED_FEATURES_KEY, DEFAULT_INSTALLED_FEATURES)
  const installed = readInstalledFeatures(storedInstalled)
  const installedSet = new Set(installed)
  const downloaderInstalled = DOWNLOADER_ENABLED && installedSet.has("downloader")
  const hintsInstalled = installedSet.has("hints")
  const openDownloader = useCallback(() => { void setLocation({ tab: "Misc", detail: "downloader", settings: false }) }, [setLocation])
  const triggerHintsRef = useRef<(() => boolean) | null>(null)
  const registerHintTrigger = useCallback((trigger: (() => boolean) | null) => { triggerHintsRef.current = trigger }, [])

  const viewTitle = useRef<HTMLHeadingElement>(null)
  const previousView = useRef({ tab, detail, settings })
  useLayoutEffect(() => {
    const previous = previousView.current
    previousView.current = { tab, detail, settings }
    if ((previous.tab === tab && previous.detail === detail && previous.settings === settings) || document.activeElement !== document.body) return
    const target = tab === "Misc" && !settings && !detail && previous.detail
      ? document.getElementById(`zed-tool-${previous.detail}`)
      : viewTitle.current ?? tabbar.current?.querySelector<HTMLElement>('[aria-current="page"]')
    target?.focus()
  }, [tab, detail, settings])
  const restoreScroll = useCallback((node: HTMLDivElement | null) => { if (node) node.scrollTop = getStoredScrollPosition(`${tab}-${detail}-${settings}`) }, [tab, detail, settings])
  const setDetail = (nextDetail: string | null) => void setLocation({ ...location, detail: nextDetail })
  const [shortcuts] = useStoredValue("keyboardShortcuts", DEFAULT_SHORTCUTS)
  const bindings = readShortcuts(shortcuts)

  useEffect(() => {
    void (async () => {
      const stored = await chrome.storage.local.get(["keyboardShortcuts", "popupShortcutKeysV2"])
      if (stored.popupShortcutKeysV2) return
      const next = readShortcuts(stored.keyboardShortcuts)
      if (next.tab1 === "A") next.tab1 = "2"
      if (next.tab6 === "7") next.tab6 = "S"
      await chrome.storage.local.set({ keyboardShortcuts: next, popupShortcutKeysV2: true })
    })().catch(error => toast({ title: String(error), variant: "destructive" }))
  }, [])

  const keydownStateRef = useRef({ location, settings, detail, tab, shortcuts, hintsInstalled, setLocation })
  keydownStateRef.current = { location, settings, detail, tab, shortcuts, hintsInstalled, setLocation }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || document.querySelector('dialog[open], [role="dialog"]')) return
      if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))) return
      let combo
      try { combo = recordCombo(event, true) } catch { return }
      const current = keydownStateRef.current
      const id = Object.entries(readShortcuts(current.shortcuts)).find(([, value]) => value && value === combo)?.[0]
      if (!id) return
      if (id === "hints") { if (current.hintsInstalled && triggerHintsRef.current?.()) event.preventDefault(); return }
      event.preventDefault()
      if (id.startsWith("tab")) {
        if (id === "tab6") { void current.setLocation({ ...current.location, settings: true }); return }
        const target = TAB_IDS[Number(id.slice(3))]
        if (target) void current.setLocation({ ...current.location, tab: target, settings: false })
        return
      }
      if (id === "back") { void current.setLocation({ tab: current.settings ? current.tab : "Misc", settings: false, detail: current.settings || current.tab !== "Misc" ? current.detail : null }); return }
      void chrome.runtime.sendMessage({ type: "zed:shortcut", id }).then(async result => {
        if (!result?.ok) throw new Error(result?.error || "Shortcut failed")
        if (result.password) await navigator.clipboard.writeText(result.password)
      }).catch(error => toast({ title: String(error), variant: "destructive" }))
    }
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])

  const [passwordOptions, setPasswordOptions] = useState(DEFAULT_PASSWORD_OPTIONS)
  const [restricted, setRestricted] = useState(false)
  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => setRestricted(isRestrictedPage(active?.url ?? ""))).catch(() => setRestricted(true))
    const listener = (event: Event) => {
      const d = (event as CustomEvent<{ message: string; tone: string }>).detail
      if (d?.tone === "error" && /protected|cannot be scripted|cannot access|restricted/i.test(d.message)) setRestricted(true)
      if (d) toast({ title: d.message, variant: d.tone === "error" ? "destructive" : "default" })
    }
    window.addEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
    return () => window.removeEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
  }, [])

  const selectedStore = tab === "Misc" && detail === "store" ? { id: "store", title: "Tool library", description: "Add only the tools you want to run" } : undefined
  const selectedFeature = tab === "Misc" && isFeatureId(detail) && detail !== "saveTab" && installedSet.has(detail) ? AVAILABLE_FEATURES.find((f) => f.id === detail) : undefined
  const selected = selectedStore ?? selectedFeature
  const pageTitle = settings ? "Settings" : selected?.title ?? TAB_LABELS[tab]
  useEffect(() => { document.title = `${pageTitle} · Extension Zed` }, [pageTitle])

  const installedTools = AVAILABLE_FEATURES.filter((feature) => installedSet.has(feature.id) && feature.id !== "downloader")
  const downloaderFeature = downloaderInstalled ? AVAILABLE_FEATURES.find((feature) => feature.id === "downloader") : undefined
  const saveTab = () => void saveCurrentTab().then(added => toast({ title: added ? "Saved to Read later · tab closed" : "Already in Read later · tab closed" })).catch(error => toast({ title: String(error), variant: "destructive" }))

  let content: ReactNode
  if (settings) content = <SettingsTab />
  else if (tab === "Extensions") content = null
  else if (tab === "YouTube") content = <YoutubeTab />
  else if (tab === "Saved") content = <SavedTab />
  else if (tab === "Links") content = <LinksTab />
  else if (tab === "Shortcuts") content = <ShortcutsTab />
  else if (selectedStore) content = <FeatureStore />
  else if (selectedFeature?.id === "password") content = <PasswordGenerator initialOptions={passwordOptions} onOptionsChange={setPasswordOptions} />
  else if (selectedFeature?.id === "downloader") content = <VideoDownloaderView />
  else if (selectedFeature) {
    const Detail = TOOL_COMPONENTS[selectedFeature.id]
    content = Detail ? <Detail /> : null
  } else {
    content = (
      <div className="zed-stack zed-root">
        <div className="zed-helper-row">
          <span className="zed-helper">{installed.length === 0 ? "No tools added" : `${installed.length} tool${installed.length === 1 ? "" : "s"} added`}</span>
          <Button type="button" variant="outline" size="sm" id="zed-open-store" onClick={() => setDetail("store")}>Tool library</Button>
        </div>
        {installed.length === 0 ? (
          <Card><div className="zed-stack">
            <strong>No tools added yet</strong>
            <p className="zed-helper">Add only the tools you need from the Tool library. Removed tools are never loaded and do not run on web pages.</p>
            <div className="zed-actions"><Button type="button" onClick={() => setDetail("store")}>Browse Tool library</Button></div>
          </div></Card>
        ) : (
          <>
            {restricted && <Notice title="Zed can’t run on this page">Browser pages like this one block extensions. Open a regular website to use the page tools.</Notice>}
            <div className="zed-tiles">
              {installedTools.map((feature) => {
                const disabled = restricted && !UNRESTRICTED_FEATURES.has(feature.id)
                if (feature.id === "saveTab") return <Tile key={feature.id} id="zed-tool-saveTab" title={feature.title} description={feature.description} icon={feature.icon} onClick={saveTab} />
                if (feature.id === "password") return <Tile key={feature.id} id="zed-tool-password" title={feature.title} description={feature.description} icon={feature.icon} badge={`${passwordOptions.length} chars`} onClick={() => setDetail(feature.id)} />
                const BadgeTile = BADGE_TILES[feature.id]
                if (BadgeTile) return <BadgeTile key={feature.id} feature={feature} disabled={disabled} onOpen={() => setDetail(feature.id)} />
                return <Tile key={feature.id} id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} disabled={disabled} onClick={() => setDetail(feature.id)} />
              })}
              {downloaderFeature && <DownloaderBridge detail={detail} feature={downloaderFeature} showTile onOpen={openDownloader} />}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <main className="zed-shell">
      {downloaderFeature && (tab !== "Misc" || Boolean(selected) || settings) && (
        <DownloaderBridge detail={detail} feature={downloaderFeature} showTile={false} onOpen={openDownloader} />
      )}
      {hintsInstalled && <Suspense fallback={null}><HintsBridge locationKey={`${tab}-${detail}-${settings}`} shortcuts={shortcuts} registerTrigger={registerHintTrigger} /></Suspense>}
      <nav className="zed-navigation" aria-label="Popup navigation">
        <div ref={tabbar} className="zed-tabbar">
          {TAB_IDS.map((id, index) => (
            <button key={id} title={bindings[`tab${index}`] ? `${TAB_LABELS[id]} (${bindings[`tab${index}`]})` : TAB_LABELS[id]} aria-keyshortcuts={bindings[`tab${index}`] || undefined} className="zed-tab" aria-current={!settings && tab === id ? "page" : undefined}
              onClick={() => void setLocation({ ...location, tab: id, settings: false })}>{TAB_LABELS[id]} {bindings[`tab${index}`] && <kbd aria-hidden="true" className="zed-key zed-tab-key">{bindings[`tab${index}`]}</kbd>}</button>
          ))}
        </div>
        <button className="zed-tab zed-settings" aria-label="Settings" title={bindings.tab6 ? `Settings (${bindings.tab6})` : "Settings"}
          aria-keyshortcuts={bindings.tab6 || undefined} aria-pressed={settings} onClick={() => void setLocation({ ...location, settings: !settings })}>
          <Icon name="settings" />{bindings.tab6 && <kbd aria-hidden="true" className="zed-key zed-tab-key">{bindings.tab6}</kbd>}
        </button>
      </nav>
      {(settings || selected) && (
        <div className="zed-subbar">
          <button className="zed-back" onClick={() => void setLocation({ ...location, settings: false, detail: settings ? detail : null })}><Icon name="back" size={18} />Back</button>
          <h1 ref={viewTitle} tabIndex={-1} className="zed-title">{settings ? "Settings" : selected?.title}</h1>
        </div>
      )}
      {!(settings || selected) && <h1 ref={viewTitle} tabIndex={-1} className="sr-only">{pageTitle}</h1>}
      <div className="zed-content zed-scroll" ref={restoreScroll} onScroll={event => saveStoredScrollPosition(`${tab}-${detail}-${settings}`, event.currentTarget.scrollTop)}>
        <Suspense fallback={<div className="zed-helper zed-root">Loading…</div>}>
          {selected && !settings ? <div className="zed-stack zed-root"><p className="zed-helper">{selected.description}</p>{content}</div> : content}
          <Activity mode={!settings && tab === "Extensions" ? "visible" : "hidden"}><ExtensionsTab /></Activity>
        </Suspense>
      </div>
      <Toaster />
    </main>
  )
}
