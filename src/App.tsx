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
import ShortcutsTab from "@/components/ShortcutsTab"

const tools = [
  { id: "playback", title: "Playback speed", tooltip: "Speed up or slow down video", component: ChangePlaybackRate },
  { id: "quality", title: "Video quality", tooltip: "Set a preferred resolution", component: VideoQualitySection },
  { id: "password", title: "Password generator", tooltip: "Random, customizable passwords", component: PasswordGenerator },
  { id: "volume", title: "Volume boost", tooltip: "Amplify audio up to 2000%", component: VolumeBooster },
  { id: "scrollbars", title: "Scrollbars", tooltip: "Restyle or hide scrollbars", component: ScrollbarsSection },
  { id: "modes", title: "Modes", tooltip: "Inspect, design and RTL", component: ModesSection },
  { id: "capture", title: "Capture screenshot", tooltip: "Selected area, visible area, full page or element", component: ScreenshotSection },
] as const
const tabs = ["Misc", "Extensions", "YouTube", "Links", "Shortcuts"] as const
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
  const restoreScroll = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollTop = getStoredScrollPosition(`${tab}-${detail}-${settings}`)
  }, [tab, detail, settings])
  const setDetail = (detail: string | null) => void setLocation({ ...location, detail })
  const [shortcuts] = useStoredValue("keyboardShortcuts", DEFAULT_SHORTCUTS)
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (event.key === "Escape") {
        if (document.querySelector('[role="dialog"]')) return
        if (settings || detail || tab !== "Misc") {
          event.preventDefault()
          event.stopPropagation()
          void setLocation({ tab: settings ? tab : "Misc", settings: false, detail: settings || tab !== "Misc" ? detail : null })
        }
        return
      }
      if (event.composedPath().some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)))) return
      let combo
      try { combo = recordCombo(event) } catch { return }
      const id = Object.entries(readShortcuts(shortcuts)).find(([, value]) => value && value === combo)?.[0]
      if (!id) return
      event.preventDefault()
      void chrome.runtime.sendMessage({ type: "zed:shortcut", id }).then(async result => {
        if (!result?.ok) throw new Error(result?.error || "Shortcut failed")
        if (result.password) await navigator.clipboard.writeText(result.password)
      }).catch(error => toast({ title: String(error), variant: "destructive" }))
    }
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
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
  const selected = tab === "Misc" ? tools.find(tool => tool.id === detail) : undefined
  const Detail = selected?.component
  const modesOn = [inspect, design, rtl].filter(value => value === "on").length
  const badges: Record<string, string | undefined> = {
    playback: `${speed}×`,
    volume: `${volume}%`,
    password: `${passwordOptions.length} chars`,
    quality: quality === "auto" ? "Auto" : QUALITY_OPTIONS.find(option => option.id === quality)?.label.replace(/ \(.+\)/, "") ?? quality,
    modes: modesOn ? `${modesOn} on` : undefined,
  }
  const orderedTools = [...tools].sort((a, b) =>
    order.indexOf(a.id === "capture" ? "screenshot" : a.id) - order.indexOf(b.id === "capture" ? "screenshot" : b.id)
  )
  const saveTab = () => void saveCurrentTab()
    .then(added => toast({ title: added ? "Saved to Links · tab closed" : "Already in Links · tab closed" }))
    .catch(error => toast({ title: String(error), variant: "destructive" }))

  let content: ReactNode
  if (settings) content = <SettingsTab />
  else if (tab === "Extensions") content = null
  else if (tab === "YouTube") content = <YoutubeTab />
  else if (tab === "Links") content = <LinksTab />
  else if (tab === "Shortcuts") content = <ShortcutsTab />
  else if (detail === "password") content = <PasswordGenerator open onOpenChange={() => { }} initialOptions={passwordOptions} onOptionsChange={setPasswordOptions} />
  else if (Detail) content = <Detail open onOpenChange={() => { }} />
  else content = (
    <div className="zed-stack zed-root">
      {restricted && (
        <Notice title="Zed can’t run on this page">
          Browser pages like this one block extensions. Open a regular website to use the page tools. Password generator and Save &amp; close tab still work.
        </Notice>
      )}
      <div className="zed-tiles">
        {orderedTools.map(tool => (
          <Tile key={tool.id} title={tool.title} tooltip={tool.tooltip} icon={tool.id}
            badge={badges[tool.id]} disabled={restricted && tool.id !== "password"}
            onClick={() => setDetail(tool.id)} />
        ))}
        <Tile title="Save & close tab" tooltip="Save this tab’s URL to Links, then close the tab" icon="save" onClick={saveTab} />
      </div>
    </div>
  )
  return (
    <main className="zed-shell">
      <nav className="zed-navigation" aria-label="Extension navigation">
        <div ref={tabbar} className="zed-tabbar">
        {tabs.map(name => (
          <button key={name} className="zed-tab" aria-current={!settings && tab === name ? "page" : undefined}
            onClick={() => { void setLocation({ ...location, tab: name, settings: false }) }}>{name}</button>
        ))}
        </div>
        <button className="zed-tab zed-settings" aria-label="Settings"
          aria-pressed={settings} onClick={() => { void setLocation({ ...location, settings: !settings }) }}>
          <Icon name="settings" />
        </button>
      </nav>
      {(settings || selected) && (
        <div className="zed-subbar">
          <button className="zed-back" onClick={() => void setLocation({ ...location, settings: false, detail: settings ? detail : null })}>
            <Icon name="back" size={18} />Back
          </button>
          <h1 className="zed-title">{settings ? "Settings" : selected?.title}</h1>
        </div>
      )}
      <div className="zed-content zed-scroll"
        ref={restoreScroll}
        onScroll={event => saveStoredScrollPosition(`${tab}-${detail}-${settings}`, event.currentTarget.scrollTop)}>
        {content}
        <Activity mode={!settings && tab === "Extensions" ? "visible" : "hidden"}>
          <ExtensionsTab />
        </Activity>
      </div>
      <Toaster />
    </main>
  )
}
