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
import {
  AVAILABLE_FEATURES,
  DEFAULT_INSTALLED_FEATURES,
  INSTALLED_FEATURES_KEY,
  readInstalledFeatures,
  type FeatureDefinition,
  type FeatureId,
} from "@/lib/features"

const ExtensionsTab = lazy(() => import("@/components/ExtensionsTab"))
const SettingsTab = lazy(() => import("@/components/SettingsTab"))
const YoutubeTab = lazy(() => import("@/components/YoutubeTab"))
const SavedTab = lazy(() => import("@/components/SavedTab"))
const LinksTab = lazy(() => import("@/components/LinksTab").then((m) => ({ default: m.LinksTab })))
const ShortcutsTab = lazy(() => import("@/components/ShortcutsTab"))
const FeatureStore = lazy(() => import("@/components/FeatureStore"))
const HintsBridge = lazy(() => import("@/components/HintsBridge"))

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
const PasswordGenerator = lazy(() => import("@/components/PasswordGenerator"))
const VideoDownloader = lazy(() => import("@/components/VideoDownloader"))

const tabs = ["Misc", "Extensions", "YouTube", "Links", "Saved", "Shortcuts"] as const
const DEFAULT_LOCATION = { tab: "Misc", detail: null as string | null, settings: false }

function PlaybackTile({ feature, restricted, onOpen }: { feature: FeatureDefinition; restricted: boolean; onOpen: () => void }) {
  const [speed] = useStoredValue("speed", "1")
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={`${speed}×`} disabled={restricted} onClick={onOpen} />
}

function VolumeTile({ feature, restricted, onOpen }: { feature: FeatureDefinition; restricted: boolean; onOpen: () => void }) {
  const [volume] = useStoredValue("volumeBoost", 100)
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={`${volume}%`} disabled={restricted} onClick={onOpen} />
}

function QualityTile({ feature, restricted, onOpen }: { feature: FeatureDefinition; restricted: boolean; onOpen: () => void }) {
  const [quality] = useStoredValue("videoQuality", "hd1080")
  const badge = quality === "auto" ? "Auto" : QUALITY_OPTIONS.find((option) => option.id === quality)?.label.replace(/ \(.+\)/, "") ?? quality
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={badge} disabled={restricted} onClick={onOpen} />
}

function ModesTile({ feature, restricted, onOpen }: { feature: FeatureDefinition; restricted: boolean; onOpen: () => void }) {
  const [inspect] = useStoredValue("inspectMode", "off")
  const [design] = useStoredValue("designMode", "off")
  const [rtl] = useStoredValue("arabicRtlMode", "off")
  const modesOn = [inspect, design, rtl].filter((value) => value === "on").length
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={modesOn ? `${modesOn} on` : undefined} disabled={restricted} onClick={onOpen} />
}

function BlackAndWhiteTile({ feature, onOpen }: { feature: FeatureDefinition; onOpen: () => void }) {
  const [blackAndWhite] = useStoredValue<boolean>("blackAndWhite", false)
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={blackAndWhite ? "On" : "Off"} onClick={onOpen} />
}

function HintsTile({ feature, onOpen }: { feature: FeatureDefinition; onOpen: () => void }) {
  const [hintMode] = useStoredValue<"always" | "shortcut" | "off">("hintMode", "shortcut")
  const badge = hintMode === "always" ? "Always" : hintMode === "shortcut" ? "F key" : "Off"
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={badge} onClick={onOpen} />
}

function DownloaderTile({ feature, onOpen }: { feature: FeatureDefinition; onOpen: () => void }) {
  const download = useDownloader()
  const badge = download.phase === "downloading"
    ? (download.pct == null ? "Working" : `${download.pct}%`)
    : download.phase === "done" && !download.seen ? "Done" : undefined
  return <Tile id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={badge} onClick={onOpen} />
}

function DownloaderAutoOpen({ detail, onOpenDownloader }: { detail: string | null; onOpenDownloader: () => void }) {
  const download = useDownloader()
  const restoredDownload = useRef(false)
  useEffect(() => {
    if (detail === "downloader" || restoredDownload.current || !(download.phase === "downloading" || (download.phase === "done" && !download.seen))) return
    restoredDownload.current = true
    onOpenDownloader()
  }, [detail, download.phase, download.seen, onOpenDownloader])
  return null
}

function VideoDownloaderView() {
  const download = useDownloader()
  return <VideoDownloader state={download} />
}

export default function App() {
  const [dark] = useStoredValue("darkTheme", true)
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])
  const tabbar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const nav = tabbar.current
    if (!nav) return
    const scrollTabs = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || nav.scrollWidth <= nav.clientWidth) return
      event.preventDefault()
      const unit = event.deltaMode === 1 ? nav.clientHeight : event.deltaMode === 2 ? nav.clientWidth : 1
      nav.scrollLeft += event.deltaY * unit
    }
    nav.addEventListener("wheel", scrollTabs, { passive: false })
    return () => nav.removeEventListener("wheel", scrollTabs)
  }, [])
  const [location, setLocation] = useStoredValue("popupLocation", DEFAULT_LOCATION)
  const { tab, detail, settings } = location
  const [storedInstalled] = useStoredValue<readonly FeatureId[]>(INSTALLED_FEATURES_KEY, DEFAULT_INSTALLED_FEATURES)
  const installed = readInstalledFeatures(storedInstalled)
  const downloaderInstalled = DOWNLOADER_ENABLED && installed.includes("downloader")
  const hintsInstalled = installed.includes("hints")

  const openDownloader = useCallback(() => {
    void setLocation({ tab: "Misc", detail: "downloader", settings: false })
  }, [setLocation])

  const triggerHintsRef = useRef<(() => boolean) | null>(null)
  const registerHintTrigger = useCallback((trigger: (() => boolean) | null) => {
    triggerHintsRef.current = trigger
  }, [])

  const viewTitle = useRef<HTMLHeadingElement>(null)
  const previousView = useRef({ tab, detail, settings })
  useLayoutEffect(() => {
    const previous = previousView.current
    previousView.current = { tab, detail, settings }
    if (previous.tab === tab && previous.detail === detail && previous.settings === settings) return
    // Only repair focus when navigation removed the focused control.
    if (document.activeElement !== document.body) return
    const returningToTools = tab === "Misc" && !settings && !detail && previous.detail
    const target = returningToTools
      ? document.getElementById(`zed-tool-${previous.detail}`)
      : viewTitle.current ?? tabbar.current?.querySelector<HTMLElement>('[aria-current="page"]')
    target?.focus()
  }, [tab, detail, settings])
  const restoreScroll = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollTop = getStoredScrollPosition(`${tab}-${detail}-${settings}`)
  }, [tab, detail, settings])
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
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.isComposing || document.querySelector('dialog[open], [role="dialog"]')) return
      if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))) return
      let combo
      try { combo = recordCombo(event, true) } catch { return }
      const id = Object.entries(readShortcuts(shortcuts)).find(([, value]) => value && value === combo)?.[0]
      if (!id) return
      if (id === "hints") {
        if (!hintsInstalled) return
        if (triggerHintsRef.current?.()) event.preventDefault()
        return
      }
      event.preventDefault()
      if (id.startsWith("tab")) {
        if (id === "tab6") { void setLocation({ ...location, settings: true }); return }
        const target = tabs[Number(id.slice(3))]
        if (target) void setLocation({ ...location, tab: target, settings: false })
        return
      }
      if (id === "back") {
        void setLocation({ tab: settings ? tab : "Misc", settings: false, detail: settings || tab !== "Misc" ? detail : null })
        return
      }
      void chrome.runtime.sendMessage({ type: "zed:shortcut", id }).then(async result => {
        if (!result?.ok) throw new Error(result?.error || "Shortcut failed")
        if (result.password) await navigator.clipboard.writeText(result.password)
      }).catch(error => toast({ title: String(error), variant: "destructive" }))
    }
    window.addEventListener("keydown", listener)
    return () => { window.removeEventListener("keydown", listener) }
  }, [location, settings, detail, tab, shortcuts, hintsInstalled, setLocation])
  const [passwordOptions, setPasswordOptions] = useState(DEFAULT_PASSWORD_OPTIONS)
  const [restricted, setRestricted] = useState(false)
  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
      const url = active?.url ?? ""
      setRestricted(isRestrictedPage(url))
    }).catch(() => setRestricted(true))
    const listener = (event: Event) => { const d = (event as CustomEvent<{ message: string; tone: string }>).detail; if (d?.tone === "error" && /protected|cannot be scripted|cannot access|restricted/i.test(d.message)) setRestricted(true); if (d) toast({ title: d.message, variant: d.tone === "error" ? "destructive" : "default" }) }
    window.addEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
    return () => window.removeEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
  }, [])

  const selectedStore = tab === "Misc" && detail === "store"
    ? { id: "store", title: "Feature Store", description: "Install only the features you want to load" }
    : undefined
  const selectedFeature = tab === "Misc" && detail && detail !== "saveTab" && installed.includes(detail as FeatureId)
    ? AVAILABLE_FEATURES.find((feature) => feature.id === detail)
    : undefined
  const selected = selectedStore ?? selectedFeature
  const pageTitle = settings ? "Settings" : selected?.title ?? tab
  useEffect(() => { document.title = `${pageTitle} · Extension Zed` }, [pageTitle])

  const installedTools = AVAILABLE_FEATURES.filter((feature) => installed.includes(feature.id) && feature.id !== "downloader" && feature.id !== "saveTab")
  const saveTab = () => void saveCurrentTab()
    .then(added => toast({ title: added ? "Saved to Links · tab closed" : "Already in Links · tab closed" }))
    .catch(error => toast({ title: String(error), variant: "destructive" }))

  const renderTile = (feature: FeatureDefinition) => {
    if (feature.id === "playback") return <PlaybackTile key={feature.id} feature={feature} restricted={restricted} onOpen={() => setDetail(feature.id)} />
    if (feature.id === "volume") return <VolumeTile key={feature.id} feature={feature} restricted={restricted} onOpen={() => setDetail(feature.id)} />
    if (feature.id === "quality") return <QualityTile key={feature.id} feature={feature} restricted={restricted} onOpen={() => setDetail(feature.id)} />
    if (feature.id === "modes") return <ModesTile key={feature.id} feature={feature} restricted={restricted} onOpen={() => setDetail(feature.id)} />
    if (feature.id === "blackAndWhite") return <BlackAndWhiteTile key={feature.id} feature={feature} onOpen={() => setDetail(feature.id)} />
    if (feature.id === "hints") return <HintsTile key={feature.id} feature={feature} onOpen={() => setDetail(feature.id)} />
    if (feature.id === "password") return <Tile key={feature.id} id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} badge={`${passwordOptions.length} chars`} onClick={() => setDetail(feature.id)} />
    return <Tile key={feature.id} id={`zed-tool-${feature.id}`} title={feature.title} description={feature.description} icon={feature.icon} disabled={restricted && feature.id !== "limiter"} onClick={() => setDetail(feature.id)} />
  }

  const downloaderFeature = downloaderInstalled ? AVAILABLE_FEATURES.find((feature) => feature.id === "downloader") : undefined
  const saveTabFeature = installed.includes("saveTab") ? AVAILABLE_FEATURES.find((feature) => feature.id === "saveTab") : undefined

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
          <span className="zed-helper">
            {installed.length === 0 ? "No features installed" : `${installed.length} feature${installed.length === 1 ? "" : "s"} installed`}
          </span>
          <Button type="button" variant="outline" size="sm" id="zed-open-store" onClick={() => setDetail("store")}>
            Feature Store
          </Button>
        </div>
        {installed.length === 0 ? (
          <Card>
            <div className="zed-stack">
              <strong>No features installed yet</strong>
              <p className="zed-helper">
                Install only the tools you need from the Feature Store. Uninstalled features are never loaded and do not run on web pages.
              </p>
              <div className="zed-actions">
                <Button type="button" onClick={() => setDetail("store")}>
                  Browse Feature Store
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <>
            {restricted && (
              <Notice title="Zed can’t run on this page">
                Browser pages like this one block extensions. Open a regular website to use the page tools.
              </Notice>
            )}
            <div className="zed-tiles">
              {installedTools.map(renderTile)}
              {downloaderFeature && <DownloaderTile feature={downloaderFeature} onOpen={() => setDetail("downloader")} />}
              {saveTabFeature && (
                <Tile
                  id="zed-tool-saveTab"
                  title={saveTabFeature.title}
                  description={saveTabFeature.description}
                  icon={saveTabFeature.icon}
                  onClick={saveTab}
                />
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <main className="zed-shell">
      {downloaderInstalled && <DownloaderAutoOpen detail={detail} onOpenDownloader={openDownloader} />}
      {hintsInstalled && (
        <Suspense fallback={null}>
          <HintsBridge
            locationKey={`${tab}-${detail}-${settings}`}
            shortcuts={shortcuts}
            registerTrigger={registerHintTrigger}
          />
        </Suspense>
      )}
      <nav className="zed-navigation" aria-label="Extension navigation">
        <div ref={tabbar} className="zed-tabbar">
          {tabs.map((name, index) => (
            <button key={name} title={bindings[`tab${index}`] ? `${name} (${bindings[`tab${index}`]})` : name} aria-keyshortcuts={bindings[`tab${index}`] || undefined} className="zed-tab" aria-current={!settings && tab === name ? "page" : undefined}
              onClick={() => { void setLocation({ ...location, tab: name, settings: false }) }}>{name} {bindings[`tab${index}`] && <kbd aria-hidden="true" className="zed-key zed-tab-key">{bindings[`tab${index}`]}</kbd>}</button>
          ))}
        </div>
        <button className="zed-tab zed-settings" aria-label="Settings"
          title={bindings.tab6 ? `Settings (${bindings.tab6})` : "Settings"} aria-keyshortcuts={bindings.tab6 || undefined}
          aria-pressed={settings} onClick={() => { void setLocation({ ...location, settings: !settings }) }}>
          <Icon name="settings" />
          {bindings.tab6 && <kbd aria-hidden="true" className="zed-key zed-tab-key">{bindings.tab6}</kbd>}
        </button>
      </nav>
      {(settings || selected) && (
        <div className="zed-subbar">
          <button className="zed-back" onClick={() => void setLocation({ ...location, settings: false, detail: settings ? detail : null })}>
            <Icon name="back" size={18} />Back
          </button>
          <h1 ref={viewTitle} tabIndex={-1} className="zed-title">{settings ? "Settings" : selected?.title}</h1>
        </div>
      )}
      {!(settings || selected) && <h1 ref={viewTitle} tabIndex={-1} className="sr-only">{pageTitle}</h1>}
      <div className="zed-content zed-scroll"
        ref={restoreScroll}
        onScroll={event => saveStoredScrollPosition(`${tab}-${detail}-${settings}`, event.currentTarget.scrollTop)}>
        <Suspense fallback={<div className="zed-helper zed-root">Loading…</div>}>
          {selected && !settings ? <div className="zed-stack zed-root">
            <p className="zed-helper">{selected.description}</p>
            {content}
          </div> : content}
          <Activity mode={!settings && tab === "Extensions" ? "visible" : "hidden"}>
            <ExtensionsTab />
          </Activity>
        </Suspense>
      </div>
      <Toaster />
    </main>
  )
}
