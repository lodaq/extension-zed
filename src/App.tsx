import MiscTab from "@/components/MiscTab"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/toast"
import { toast } from "@/components/ui/use-toast"
import { PAGE_ACTION_FEEDBACK_EVENT } from "@/lib/withActiveTab"
import { Cross1Icon, ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Suspense, lazy, useCallback, useEffect, useState } from "react"
import { readBootState, updateBootState } from "@/lib/bootCache"
import { readSetting } from "@/lib/settings"

const YoutubeTab = lazy(() => import("@/components/YoutubeTab"))
const SettingsTab = lazy(() => import("@/components/SettingsTab"))

const TAB_KEY = "popupActiveTab"
const TAB_VALUES = ["misc", "youtube", "settings"] as const
type TabValue = (typeof TAB_VALUES)[number]

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v)
}

const tabPanelClass =
  "col-start-1 row-start-1 mt-0 overflow-visible outline-none data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible data-[state=active]:relative data-[state=active]:z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

function App() {
  const [tab, setTab] = useState<TabValue>(() => readBootState().tab ?? "misc")
  const [storageError, setStorageError] = useState<string | null>(null)

  const commitTab = useCallback((v: TabValue) => {
    setTab(v)
    updateBootState({ tab: v })
    try {
      void chrome?.storage?.local?.set({ [TAB_KEY]: v })
    } catch {
      // storage write failure
    }
  }, [])

  const initStorage = useCallback(() => {
    const applyTheme = (value: unknown) => {
      const darkTheme = readSetting("darkTheme", value, true)
      document.documentElement.classList.toggle("dark", darkTheme)
      updateBootState({ dark: darkTheme })
    }

    void Promise.resolve().then(() => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        setStorageError("Extension storage is unavailable in this context.")
        return
      }

      return chrome.storage.local
        .get([TAB_KEY, "darkTheme"])
        .then((r) => {
          setStorageError(null)
          const v = r[TAB_KEY]
          if (typeof v === "string" && isTabValue(v)) {
            setTab(v)
            updateBootState({ tab: v })
          }
          applyTheme(r.darkTheme)
          if (r.darkTheme === undefined) void chrome.storage.local.set({ darkTheme: true })
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err)
          setStorageError(`Failed to load saved settings: ${msg || "Storage unavailable"}`)
        })
    })
  }, [])

  useEffect(() => {
    initStorage()

    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return

    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area !== "local") return
      const nextTab = changes[TAB_KEY]?.newValue
      if (typeof nextTab === "string" && isTabValue(nextTab)) {
        setTab(nextTab)
        updateBootState({ tab: nextTab })
      }
      if (changes.darkTheme) {
        const darkTheme = readSetting("darkTheme", changes.darkTheme.newValue, true)
        document.documentElement.classList.toggle("dark", darkTheme)
        updateBootState({ dark: darkTheme })
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [initStorage])

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
        <TabsList className="grid w-full grid-cols-3 gap-1 overflow-visible">
          <TabsTrigger value="misc" className="px-2 py-2 text-xs">
            Misc
          </TabsTrigger>
          <TabsTrigger value="youtube" className="px-2 py-2 text-xs">
            Youtube
          </TabsTrigger>
          <TabsTrigger value="settings" className="px-2 py-2 text-xs">
            Settings
          </TabsTrigger>
        </TabsList>

        {storageError && (
          <div
            role="alert"
            className="mt-1.5 flex items-center justify-between gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400"
          >
            <div className="flex items-center gap-1.5 truncate">
              <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{storageError}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => initStorage()}
              >
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => setStorageError(null)}
                aria-label="Dismiss storage warning"
              >
                <Cross1Icon className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
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
        <TabsContent value="settings" className={tabPanelClass}>
          <Suspense fallback={null}>
            <SettingsTab />
          </Suspense>
        </TabsContent>
      </div>
      <Toaster />
    </Tabs>
  )
}

export default App
