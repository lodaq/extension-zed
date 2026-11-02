import MiscTab from "@/components/MiscTab"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toast"
import { toast } from "@/components/ui/use-toast"
import { popupSectionStack } from "@/lib/popupLayout"
import { KBD } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"
import { PAGE_ACTION_FEEDBACK_EVENT } from "@/lib/withActiveTab"
import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { readBootState, updateBootState } from "@/lib/bootCache"
import { readSetting } from "@/lib/settings"

const YoutubeTab = lazy(() => import("@/components/YoutubeTab"))
const ShortcutsTab = lazy(() => import("@/components/ShortcutsTab"))
const SettingsTab = lazy(() => import("@/components/SettingsTab"))

const TAB_KEY = "popupActiveTab"
const TAB_VALUES = ["misc", "youtube", "shortcuts", "settings"] as const
type TabValue = (typeof TAB_VALUES)[number]

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v)
}

const tabPanelClass =
  "col-start-1 row-start-1 mt-0 overflow-visible outline-none data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible data-[state=active]:relative data-[state=active]:z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

function App() {
  const [tab, setTab] = useState<TabValue>(() => readBootState().tab ?? "misc")

  const commitTab = useCallback((v: TabValue) => {
    setTab(v)
    updateBootState({ tab: v })
    void chrome.storage.local.set({ [TAB_KEY]: v })
  }, [])

  useEffect(() => {
    const applyTheme = (value: unknown) => {
      const darkTheme = readSetting("darkTheme", value, true)
      document.documentElement.classList.toggle("dark", darkTheme)
      updateBootState({ dark: darkTheme })
    }

    chrome.storage.local.get([TAB_KEY, "darkTheme"]).then((r) => {
      const v = r[TAB_KEY]
      if (typeof v === "string" && isTabValue(v)) {
        setTab(v)
        updateBootState({ tab: v })
      }
      applyTheme(r.darkTheme)
      if (r.darkTheme === undefined) void chrome.storage.local.set({ darkTheme: true })
    }).catch(() => {
      // Keep the synchronously painted boot theme and tab when storage is unavailable.
    })

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local") return
      const nextTab = changes[TAB_KEY]?.newValue
      if (typeof nextTab === "string" && isTabValue(nextTab)) {
        setTab(nextTab)
        updateBootState({ tab: nextTab })
      }
      if (changes.darkTheme) applyTheme(changes.darkTheme.newValue)
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
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
      <div className="popup-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <TabsContent value="misc" className={tabPanelClass}>
          <MiscTab />
        </TabsContent>
        <TabsContent value="youtube" className={tabPanelClass}>
          <Suspense fallback={null}>
            <YoutubeTab />
          </Suspense>
        </TabsContent>
        <TabsContent value="shortcuts" className={tabPanelClass}>
          <div className={cn(popupSectionStack, "px-0.5 pb-3 pt-6")}>
            <Suspense fallback={null}>
              <ShortcutsTab />
            </Suspense>
          </div>
        </TabsContent>
        <TabsContent value="settings" className={tabPanelClass}>
          <div className="px-0.5 pb-1 pt-3">
            <Suspense fallback={null}>
              <SettingsTab />
            </Suspense>
          </div>
        </TabsContent>
      </div>
      <Toaster />
    </Tabs>
  )
}

export default App
