import { useCallback, useEffect, useState } from "react"
import MiscTab from "@/components/MiscTab"
import ShortcutsTab from "@/components/ShortcutsTab"
import YoutubeTab from "@/components/YoutubeTab"
import { ShortcutKbd, shortcutHostClassName } from "@/components/ShortcutKbd"
import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { KBD } from "@/lib/shortcuts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TAB_KEY = "popupActiveTab"
const TAB_VALUES = ["misc", "youtube", "shortcuts"] as const
type TabValue = (typeof TAB_VALUES)[number]

function isTabValue(v: string): v is TabValue {
  return (TAB_VALUES as readonly string[]).includes(v)
}

/** Overlapping grid + forceMount: Chrome popup height ≈ max tab content. */
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
    chrome.storage.local.get([TAB_KEY]).then((r) => {
      const v = r[TAB_KEY]
      if (typeof v === "string" && isTabValue(v)) setTab(v)
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
      className="w-[400px] overflow-visible rounded-xl border border-border bg-card p-4 text-card-foreground shadow-md"
    >
      <TabsList className="grid w-full grid-cols-3 gap-1.5 overflow-visible">
        <TabsTrigger value="misc" className={cn(shortcutHostClassName, "px-2 py-2.5 text-[10px]")}>
          Misc
          <ShortcutKbd label={KBD.tabMisc} className="scale-90" />
        </TabsTrigger>
        <TabsTrigger value="youtube" className={cn(shortcutHostClassName, "px-2 py-2.5 text-[10px]")}>
          Youtube
          <ShortcutKbd label={KBD.tabYoutube} className="scale-90" />
        </TabsTrigger>
        <TabsTrigger value="shortcuts" className={cn(shortcutHostClassName, "px-2 py-2.5 text-[10px]")}>
          Shortcuts
          <ShortcutKbd label={KBD.tabShortcuts} className="scale-90" />
        </TabsTrigger>
      </TabsList>
      <div className="mt-4 grid grid-cols-1 grid-rows-1">
        <TabsContent value="misc" forceMount className={tabPanelClass}>
          <MiscTab />
        </TabsContent>
        <TabsContent value="youtube" forceMount className={tabPanelClass}>
          <YoutubeTab />
        </TabsContent>
        <TabsContent value="shortcuts" forceMount className={tabPanelClass}>
          <div className={cn(popupSectionStack, "max-h-[480px] px-0.5 pb-3 pt-6")}>
            <div className="overflow-y-auto overflow-x-hidden pr-0.5">
              <ShortcutsTab />
            </div>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  )
}

export default App
