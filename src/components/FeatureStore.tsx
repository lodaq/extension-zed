import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, StatusPill } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
import { AVAILABLE_FEATURES, DEFAULT_INSTALLED_FEATURES, FEATURE_CATEGORIES, INSTALLED_FEATURES_KEY, readInstalledFeatures, type FeatureCategory, type FeatureId } from "@/lib/features"
import { useStoredValue } from "@/lib/useStoredValue"
import { toast } from "./ui/use-toast"

export default function FeatureStore() {
  const [storedInstalled, setStoredInstalled] = useStoredValue<readonly FeatureId[]>(INSTALLED_FEATURES_KEY, DEFAULT_INSTALLED_FEATURES)
  const installed = readInstalledFeatures(storedInstalled)
  const installedSet = new Set(installed)
  const [category, setCategory] = useState<"All" | FeatureCategory>("All")
  const [query, setQuery] = useState("")

  const q = query.trim().toLowerCase()
  const filtered = AVAILABLE_FEATURES.filter((f) =>
    (category === "All" || f.category === category) &&
    (!q || f.title.toLowerCase().includes(q) || f.storeDescription.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
  )

  const pendingRef = useRef<Promise<void>>(Promise.resolve())
  const toggleFeature = (id: FeatureId, title: string, active: boolean) => {
    const task = pendingRef.current.then(async () => {
      const latest = typeof chrome !== "undefined" && chrome.storage?.local
        ? readInstalledFeatures((await chrome.storage.local.get(INSTALLED_FEATURES_KEY))[INSTALLED_FEATURES_KEY])
        : installed
      const next = active ? latest.filter((item) => item !== id) : latest.includes(id) ? latest : [...latest, id]
      await setStoredInstalled(next)
      toast({ title: active ? `${title} uninstalled` : `${title} installed` })
    }).catch((error) => { toast({ title: "Could not update installed features", description: String(error), variant: "destructive" }) })
    pendingRef.current = task
  }

  return (
    <section className="zed-stack">
      <div className="zed-helper-row">
        <span className="zed-helper">Only installed features are loaded in Misc, shortcuts, and web pages.</span>
        <span className="zed-count">{installed.length} of {AVAILABLE_FEATURES.length} installed</span>
      </div>
      <input type="search" className="zed-input" aria-label="Search features" placeholder="Search features…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="zed-chip-row" role="group" aria-label="Filter by category">
        {(["All", ...FEATURE_CATEGORIES] as const).map((item) => (
          <button key={item} type="button" className="zed-chip" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {filtered.length === 0 ? <p className="zed-empty">No features match your search.</p> : (
        <div className="zed-stack">
          {filtered.map((feature) => {
            const active = installedSet.has(feature.id)
            return (
              <Card key={feature.id} active={active}>
                <div className="flex items-start gap-3">
                  <span className="zed-well" style={{ flexShrink: 0 }}><Icon name={feature.icon} /></span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2"><strong className="truncate">{feature.title}</strong><StatusPill active={active} /></div>
                      <Button type="button" variant={active ? "outline" : "default"} size="sm"
                        aria-label={`${active ? "Uninstall" : "Install"} ${feature.title}`}
                        onClick={() => toggleFeature(feature.id, feature.title, active)}>
                        {active ? "Uninstall" : "Install"}
                      </Button>
                    </div>
                    <span className="zed-helper">{feature.category}</span>
                    <p className="zed-helper">{feature.storeDescription}</p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
