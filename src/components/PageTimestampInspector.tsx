import { useState } from "react"
import { Button } from "@/components/ui/button"
import { popupSubhead, popupDescription } from "@/lib/popupLayout"
import { withActiveTab } from "@/lib/withActiveTab"

export interface PageTimestampInfo {
  published?: string | null
  modified?: string | null
  lastModifiedHeader?: string | null
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    const diffMs = Date.now() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return date.toLocaleDateString()
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 30) return `${diffDays} days ago`
    const diffMonths = Math.floor(diffDays / 30)
    if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`
    const diffYears = Math.floor(diffDays / 365)
    return `${diffYears} year${diffYears > 1 ? "s" : ""} ago (${date.toLocaleDateString()})`
  } catch {
    return dateString
  }
}

export default function PageTimestampInspector() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PageTimestampInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  const inspectTimestamps = async () => {
    setLoading(true)
    setError(null)
    setData(null)

    try {
      await withActiveTab(async (tab) => {
        if (!tab.id) throw new Error("No active tab")
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const getMeta = (...names: string[]): string | undefined => {
              for (const name of names) {
                const el = document.querySelector(
                  `meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`
                )
                const content = el?.getAttribute("content")
                if (content && content.trim()) return content.trim()
              }
              return undefined
            }

            // Check JSON-LD
            let jsonLdPublished: string | undefined
            let jsonLdModified: string | undefined
            for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
              try {
                const parsed = JSON.parse(script.textContent || "")
                const findDates = (obj: Record<string, unknown>) => {
                  if (!obj || typeof obj !== "object") return
                  if (typeof obj.datePublished === "string") jsonLdPublished = obj.datePublished
                  if (typeof obj.dateModified === "string") jsonLdModified = obj.dateModified
                  if (Array.isArray(obj["@graph"])) {
                    for (const item of obj["@graph"]) findDates(item as Record<string, unknown>)
                  }
                }
                findDates(parsed)
              } catch {
                // Ignore malformed JSON-LD
              }
            }

            const timeEl = document.querySelector("time[datetime]")?.getAttribute("datetime")

            const published =
              jsonLdPublished ||
              getMeta(
                "article:published_time",
                "datePublished",
                "pubdate",
                "publish-date",
                "date",
                "dc.date",
                "sailthru.date"
              ) ||
              timeEl ||
              null

            const modified =
              jsonLdModified ||
              getMeta(
                "article:modified_time",
                "dateModified",
                "last-modified",
                "lastmod",
                "revised"
              ) ||
              null

            const docLastModified = document.lastModified && document.lastModified !== "" ? document.lastModified : null

            return {
              published,
              modified,
              lastModifiedHeader: docLastModified,
            }
          },
        })

        if (!result?.result) throw new Error("Could not inspect page")
        setData(result.result)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect page timestamps")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-t border-border/70 pt-3">
      <div className="flex items-center justify-between">
        <div>
          <p className={popupSubhead}>Page Age & Timestamps</p>
          <p className={popupDescription}>Detect publication and last-updated dates for this page.</p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={loading}
          className="min-h-9"
          onClick={() => void inspectTimestamps()}
        >
          {loading ? "Checking..." : "Inspect"}
        </Button>
      </div>

      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-2 space-y-1.5 rounded-md bg-muted/40 p-2.5 text-xs">
          {data.published ? (
            <div>
              <span className="font-semibold text-foreground">Published: </span>
              <span className="text-muted-foreground">{formatRelativeTime(data.published)}</span>
            </div>
          ) : null}

          {data.modified ? (
            <div>
              <span className="font-semibold text-foreground">Modified: </span>
              <span className="text-muted-foreground">{formatRelativeTime(data.modified)}</span>
            </div>
          ) : null}

          {data.lastModifiedHeader && !data.modified ? (
            <div>
              <span className="font-semibold text-foreground">Doc header: </span>
              <span className="text-muted-foreground">{data.lastModifiedHeader}</span>
            </div>
          ) : null}

          {!data.published && !data.modified && !data.lastModifiedHeader && (
            <p className="text-muted-foreground italic">No timestamp metadata found on this page.</p>
          )}
        </div>
      )}
    </div>
  )
}
