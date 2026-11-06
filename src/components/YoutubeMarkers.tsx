import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { popupSubhead, popupDescription } from "@/lib/popupLayout"
import { toast } from "@/components/ui/use-toast"
import { withActiveTab } from "@/lib/withActiveTab"

export interface VideoMarker {
  id: string
  time: number
  label: string
}

function formatSeconds(totalSeconds: number): string {
  const rounded = Math.floor(totalSeconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const seconds = rounded % 60

  const mm = String(minutes).padStart(2, "0")
  const ss = String(seconds).padStart(2, "0")

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

export default function YoutubeMarkers() {
  const [videoId, setVideoId] = useState<string | null>(null)
  const [markers, setMarkers] = useState<VideoMarker[]>([])
  const [busy, setBusy] = useState(false)

  const loadMarkers = (vId: string) => {
    const key = `ytMarkers:${vId}`
    chrome.storage.local.get([key]).then((result) => {
      const stored = result[key]
      if (Array.isArray(stored)) {
        setMarkers(stored as VideoMarker[])
      } else {
        setMarkers([])
      }
    })
  }

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.url) return
      try {
        const url = new URL(tab.url)
        if (url.hostname.includes("youtube.com") && url.pathname === "/watch") {
          const v = url.searchParams.get("v")
          if (v) {
            setVideoId(v)
            loadMarkers(v)
          }
        }
      } catch {
        // Not a valid URL
      }
    })
  }, [])

  const addMarker = async () => {
    if (!videoId) return
    setBusy(true)

    try {
      await withActiveTab(async (tab: chrome.tabs.Tab) => {
        if (!tab.id) throw new Error("No active tab")
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video")
            if (!video) return null
            return {
              time: Math.floor(video.currentTime),
              title: document.title.replace(/ - YouTube$/, ""),
            }
          },
        })

        if (!res?.result) {
          throw new Error("No active video found on page")
        }

        const { time } = res.result
        const newMarker: VideoMarker = {
          id: Math.random().toString(36).slice(2, 9),
          time,
          label: formatSeconds(time),
        }

        const updated = [...markers, newMarker].sort((a, b) => a.time - b.time)
        setMarkers(updated)
        await chrome.storage.local.set({ [`ytMarkers:${videoId}`]: updated })
        toast({ title: "Marker added", description: `Saved bookmark at ${formatSeconds(time)}` })
      })
    } catch (err) {
      toast({
        title: "Could not add marker",
        description: err instanceof Error ? err.message : "Video player not ready",
        variant: "destructive",
      })
    } finally {
      setBusy(false)
    }
  }

  const seekTo = async (seconds: number) => {
    try {
      await withActiveTab(async (tab: chrome.tabs.Tab) => {
        if (!tab.id) return
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (timeToSeek: number) => {
            const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video")
            if (video) {
              video.currentTime = timeToSeek
            }
          },
          args: [seconds],
        })
      })
    } catch (err) {
      toast({
        title: "Could not seek",
        description: err instanceof Error ? err.message : "Error seeking video",
        variant: "destructive",
      })
    }
  }

  const deleteMarker = async (id: string) => {
    if (!videoId) return
    const updated = markers.filter((m) => m.id !== id)
    setMarkers(updated)
    await chrome.storage.local.set({ [`ytMarkers:${videoId}`]: updated })
  }

  const exportMarkers = async () => {
    if (!markers.length) return
    const text = markers
      .map((m) => `${formatSeconds(m.time)} ${m.label}`)
      .join("\n")

    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Markers copied",
        description: "Timestamps copied to clipboard in YouTube chapter format.",
      })
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard permissions denied.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="border-t border-border/70 pt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className={popupSubhead}>Video markers</p>
          <p className={popupDescription}>Save and jump to moments.</p>
        </div>
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            disabled={!videoId || busy}
            className="min-h-9"
            onClick={() => void addMarker()}
          >
            + Marker
          </Button>
          {markers.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9"
              onClick={() => void exportMarkers()}
              title="Copy timestamps to clipboard"
            >
              Export
            </Button>
          )}
        </div>
      </div>

      {!videoId ? (
        <p className="mt-2 text-xs italic text-muted-foreground">
          Open a YouTube video to save markers.
        </p>
      ) : markers.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No saved markers yet.
        </p>
      ) : (
        <div className="mt-2 max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
          {markers.map((marker) => (
            <div
              key={marker.id}
              className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5 text-xs hover:bg-muted/70"
            >
              <button
                type="button"
                className="font-mono font-medium text-foreground hover:underline focus:outline-none"
                onClick={() => void seekTo(marker.time)}
                title={`Jump to ${marker.label}`}
              >
                {marker.label}
              </button>
              <button
                type="button"
                className="ml-2 text-muted-foreground hover:text-destructive"
                onClick={() => void deleteMarker(marker.id)}
                title="Delete marker"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
