import SiteLimiter from "@/components/SiteLimiter"
import SavedTab from "@/components/SavedTab"
import { DEFAULT_PASSWORD_OPTIONS } from "@/lib/passwordGenerator"
import { QUALITY_OPTIONS } from "@/lib/videoQuality"
import { Activity, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import ExtensionsTab from "@/components/ExtensionsTab"
import SettingsTab from "@/components/SettingsTab"
import YoutubeTab from "@/components/YoutubeTab"
import ChangePlaybackRate from "@/components/ChangePlaybackRate"
import VideoQualitySection from "@/components/VideoQualitySection"
import PasswordGenerator from "@/components/PasswordGenerator"
import VolumeBooster from "@/components/VolumeBooster"
import ScrollbarsSection from "@/components/ScrollbarsSection"
import ModesSection from "@/components/ModesSection"
import ScreenshotSection from "@/components/ScreenshotSection"
import { Icon } from "@/design-system/Icon"
import { Notice, Tile } from "@/design-system/components"
import { Toaster } from "@/components/ui/toast"
import { toast } from "@/components/ui/use-toast"
import { isRestrictedPage, PAGE_ACTION_FEEDBACK_EVENT } from "@/lib/withActiveTab"
import { DEFAULT_TOOL_ORDER } from "@/lib/popupLayout"
import { useStoredValue } from "@/lib/useStoredValue"
import { LinksTab } from "@/components/LinksTab"
import { saveCurrentTab } from "@/lib/links"
import { getStoredScrollPosition, saveStoredScrollPosition } from "@/lib/bootCache"
import { DEFAULT_SHORTCUTS, readShortcuts, recordCombo } from "@/lib/shortcuts"
import { showClickHints } from "@/lib/clickHints"
import ShortcutsTab from "@/components/ShortcutsTab"
import VideoDownloader from "@/components/VideoDownloader"
import { DOWNLOADER_ENABLED } from "@/lib/downloader"
import { useDownloader } from "@/lib/useDownloader"

const tools = [
  { id: "limiter", title: "Site limiter", description: "Locked website blocks and daily usage limits", component: SiteLimiter },
  { id: "playback", title: "Playback speed", description: "Speed up or slow down video", component: ChangePlaybackRate },
  { id: "quality", title: "Video quality", description: "Set a preferred resolution", component: VideoQualitySection },
  { id: "password", title: "Password generator", description: "Random, customizable passwords", component: PasswordGenerator },
  { id: "volume", title: "Volume boost", description: "Amplify audio up to 2000%", component: VolumeBooster },
  { id: "scrollbars", title: "Scrollbars", description: "Restyle or hide scrollbars", component: ScrollbarsSection },
  { id: "modes", title: "Modes", description: "Inspect, design and RTL", component: ModesSection },
  { id: "capture", title: "Capture screenshot", description: "Selected area, visible area, full page or element", component: ScreenshotSection },
] as const
const tabs = ["Misc", "Extensions", "YouTube", "Links", "Saved", "Shortcuts"] as const
const DEFAULT_LOCATION = { tab: "Misc", detail: null as string | null, settings: false }
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
  const download = useDownloader()
  const restoredDownload = useRef(false)
  useEffect(() => {
    if (!DOWNLOADER_ENABLED || restoredDownload.current || !(download.phase === "downloading" || (download.phase === "done" && !download.seen))) return
    restoredDownload.current = true
    void setLocation({ tab: "Misc", detail: "downloader", settings: false })
  }, [download.phase, download.seen, setLocation])
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
  const setDetail = (detail: string | null) => void setLocation({ ...location, detail })
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
  const clearHints = useRef<(() => void) | undefined>(undefined)
  useEffect(() => () => { clearHints.current?.() }, [location, shortcuts])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.isComposing || document.querySelector('dialog[open], [role="dialog"]')) return
      if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))) return
      let combo
      try { combo = recordCombo(event, true) } catch { return }
      const id = Object.entries(readShortcuts(shortcuts)).find(([, value]) => value && value === combo)?.[0]
      if (!id) return
      event.preventDefault()
      if (id.startsWith("tab")) {
        if (id === "tab6") { void setLocation({ ...location, settings: true }); return }
        const target = tabs[Number(id.slice(3))]
        if (target) void setLocation({ ...location, tab: target, settings: false })
        return
      }
      if (id === "hints") { clearHints.current?.(); clearHints.current = showClickHints(); return }
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
  }, [location, settings, detail, tab, shortcuts, setLocation])
  const [order] = useStoredValue("miscSectionOrder", DEFAULT_TOOL_ORDER)
  const [passwordOptions, setPasswordOptions] = useState(DEFAULT_PASSWORD_OPTIONS)
  const [restricted, setRestricted] = useState(false)
  const [speed] = useStoredValue("speed", "1")
  const [volume] = useStoredValue("volumeBoost", 100)
  const [quality] = useStoredValue("videoQuality", "hd1080")
  const [inspect] = useStoredValue("inspectMode", "off")
  const [design] = useStoredValue("designMode", "off")
  const [rtl] = useStoredValue("arabicRtlMode", "off")
  useEffect(() => {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
      const url = active?.url ?? ""
      setRestricted(isRestrictedPage(url))
    }).catch(() => setRestricted(true))
    const listener = (event: Event) => { const d = (event as CustomEvent<{ message: string; tone: string }>).detail; if (d?.tone === "error" && /protected|cannot be scripted|cannot access|restricted/i.test(d.message)) setRestricted(true); if (d) toast({ title: d.message, variant: d.tone === "error" ? "destructive" : "default" }) }
    window.addEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
    return () => window.removeEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
  }, [])
  const downloaderTool = DOWNLOADER_ENABLED ? { id: "downloader", title: "Video downloader", description: "Download videos from any site yt-dlp supports" } : undefined
  const selected = tab === "Misc" ? tools.find(tool => tool.id === detail) ?? (detail === "downloader" ? downloaderTool : undefined) : undefined
  const Detail = selected && "component" in selected ? selected.component : undefined
  const pageTitle = settings ? "Settings" : selected?.title ?? tab
  useEffect(() => { document.title = `${pageTitle} · Extension Zed` }, [pageTitle])
  const modesOn = [inspect, design, rtl].filter(value => value === "on").length
  const badges: Record<string, string | undefined> = {
    playback: `${speed}×`,
    volume: `${volume}%`,
    password: `${passwordOptions.length} chars`,
    quality: quality === "auto" ? "Auto" : QUALITY_OPTIONS.find(option => option.id === quality)?.label.replace(/ \(.+\)/, "") ?? quality,
    modes: modesOn ? `${modesOn} on` : undefined,
  }
  const orderedTools = [...tools].sort((a, b) =>
    (a.id === "limiter" ? order.length : order.indexOf(a.id === "capture" ? "screenshot" : a.id)) - (b.id === "limiter" ? order.length : order.indexOf(b.id === "capture" ? "screenshot" : b.id))
  )
  const saveTab = () => void saveCurrentTab()
    .then(added => toast({ title: added ? "Saved to Links · tab closed" : "Already in Links · tab closed" }))
    .catch(error => toast({ title: String(error), variant: "destructive" }))

  let content: ReactNode
  if (settings) content = <SettingsTab />
  else if (tab === "Extensions") content = null
  else if (tab === "YouTube") content = <YoutubeTab />
  else if (tab === "Saved") content = <SavedTab />
  else if (tab === "Links") content = <LinksTab />
  else if (tab === "Shortcuts") content = <ShortcutsTab />
  else if (detail === "password") content = <PasswordGenerator initialOptions={passwordOptions} onOptionsChange={setPasswordOptions} />
  else if (detail === "downloader" && DOWNLOADER_ENABLED) content = <VideoDownloader state={download} />
  else if (Detail) content = <Detail />
  else content = (
    <div className="zed-stack zed-root">
      {restricted && (
        <Notice title="Zed can’t run on this page">
          Browser pages like this one block extensions. Open a regular website to use the page tools. Password generator{DOWNLOADER_ENABLED ? ", Video downloader" : ""} and Save &amp; close tab still work.
        </Notice>
      )}
      <div className="zed-tiles">
        {orderedTools.map(tool => (
          <Tile key={tool.id} id={`zed-tool-${tool.id}`} title={tool.title} description={tool.description} icon={tool.id === "limiter" ? "modes" : tool.id}
            badge={badges[tool.id]} disabled={restricted && tool.id !== "password" && tool.id !== "limiter"}
            onClick={() => setDetail(tool.id)} />
        ))}
        {downloaderTool && <Tile id="zed-tool-downloader" title={downloaderTool.title} description={downloaderTool.description} icon="download"
          badge={download.phase === "downloading" ? download.pct == null ? "Working" : `${download.pct}%` : download.phase === "done" && !download.seen ? "Done" : undefined}
          onClick={() => setDetail("downloader")} />}
        <Tile title="Save & close tab" description="Save this tab’s URL to Links, then close the tab" icon="save" onClick={saveTab} />
      </div>
    </div>
  )
  return (
    <main className="zed-shell">
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
        {selected && !settings ? <div className="zed-stack zed-root">
          <p className="zed-helper">{selected.description}</p>
          {content}
        </div> : content}
        <Activity mode={!settings && tab === "Extensions" ? "visible" : "hidden"}>
          <ExtensionsTab />
        </Activity>
      </div>
      <Toaster />
    </main>
  )
}
