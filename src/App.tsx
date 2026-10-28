import MiscTab from "@/components/MiscTab"
import SettingsTab from "@/components/SettingsTab"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import ShortcutsTab from "@/components/ShortcutsTab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toast"
import { toast } from "@/components/ui/use-toast"
import YoutubeTab from "@/components/YoutubeTab"
import { popupSectionStack } from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"
import { PAGE_ACTION_FEEDBACK_EVENT } from "@/lib/withActiveTab"
import { useCallback, useEffect, useState } from "react"

const TAB_KEY = "popupActiveTab"
const TAB_VALUES = ["misc", "youtube", "shortcuts", "settings"] as const
type TabValue = (typeof TAB_VALUES)[number]

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v)
}

const tabPanelClass =
  "col-start-1 row-start-1 mt-0 overflow-visible outline-none data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible data-[state=active]:relative data-[state=active]:z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

function App() {
  const [tab, setTab] = useState<TabValue>("misc")
  const [ready, setReady] = useState(false)

  const commitTab = useCallback((v: TabValue) => {
    setTab(v)
    void chrome.storage.local.set({ [TAB_KEY]: v })
  }, [])

  useEffect(() => {
    chrome.storage.local.get([TAB_KEY, "darkTheme"]).then((r) => {
      const v = r[TAB_KEY]
      if (typeof v === "string" && isTabValue(v)) setTab(v)
      const darkTheme = r.darkTheme === undefined ? true : Boolean(r.darkTheme)
      document.documentElement.classList.toggle("dark", darkTheme)
      if (r.darkTheme === undefined) void chrome.storage.local.set({ darkTheme: true })
      setReady(true)
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : ""
      if (k === "q") {
        e.preventDefault()
        commitTab("misc")
      } else if (k === "w") {
        e.preventDefault()
        commitTab("youtube")
      } else if (k === "e") {
        e.preventDefault()
        commitTab("shortcuts")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [commitTab])

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; tone: "success" | "error" }>).detail
      if (!detail) return
      toast({
        title: detail.tone === "error" ? "Page action failed" : "Page updated",
        description: detail.message,
        variant: detail.tone === "error" ? "destructive" : "default",
      })
    }
    window.addEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
    return () => window.removeEventListener(PAGE_ACTION_FEEDBACK_EVENT, listener)
  }, [])

  if (!ready) {
    return (
      <div className="w-[400px] rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        …
      </div>
    )
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        if (!isTabValue(v)) return
        commitTab(v)
      }}
      className="flex h-[600px] w-[400px] flex-col overflow-hidden rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm"
    >
      <div className="sticky top-0 z-10 shrink-0 bg-card pb-1">
        <TabsList className="grid w-full grid-cols-4 gap-1 overflow-visible">
          <TabsTrigger value="misc" className={cn(shortcutHostClassName, "px-2 py-2 text-xs")}>
            Misc
            <ShortcutKbd label={KBD.tabMisc} className="scale-90" />
          </TabsTrigger>
          <TabsTrigger value="youtube" className={cn(shortcutHostClassName, "px-2 py-2 text-xs")}>
            Youtube
            <ShortcutKbd label={KBD.tabYoutube} className="scale-90" />
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className={cn(shortcutHostClassName, "px-2 py-2 text-xs")}>
            Shortcuts
            <ShortcutKbd label={KBD.tabShortcuts} className="scale-90" />
          </TabsTrigger>
          <TabsTrigger value="settings" className="px-2 py-2 text-xs">Settings</TabsTrigger>
        </TabsList>
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <TabsContent value="misc" className={tabPanelClass}>
          <MiscTab />
        </TabsContent>
        <TabsContent value="youtube" className={tabPanelClass}>
          <YoutubeTab />
        </TabsContent>
        <TabsContent value="shortcuts" className={tabPanelClass}>
          <div className={cn(popupSectionStack, "px-0.5 pb-3 pt-6")}>
            <ShortcutsTab />
          </div>
        </TabsContent>
        <TabsContent value="settings" className={tabPanelClass}><div className="px-0.5 pb-1 pt-3"><SettingsTab /></div></TabsContent>
      </div>
      <Toaster />
    </Tabs>
  )
}

export default App
