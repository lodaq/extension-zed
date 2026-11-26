import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Card, Notice, SwitchRow, TimelineTrimmer } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
import { clampClipRange, defaultClipFilename, defaultClipRange, estimateClipSize, formatTime, validateClipTimeInput } from "@/lib/clip"
import { DEFAULT_DOWNLOAD_DIRECTORY, defaultDownloadFormat, downloadSize, downloaderCommand, validDownloadDirectory, validDownloadUrl, type DownloaderState } from "@/lib/downloader"
import { useDownloadActions } from "@/lib/useDownloader"
import { useStoredValue } from "@/lib/useStoredValue"
import { isSameYoutubeVideo, readActiveYoutubeTab, type YoutubeTabVideo } from "@/lib/youtubeTab"

export default function VideoDownloader({ state }: { state: DownloaderState }) {
  const [enteredLink, setLink] = useState<string | null>(null)
  const link = enteredLink ?? state.url ?? ""
  const [mode, setMode] = useState<"video" | "audio">("video")
  const [rangeMode, setRangeMode] = useState<"full" | "clip">("full")
  const [selection, setSelection] = useState("")
  const [enteredName, setEnteredName] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(60)
  const [startText, setStartText] = useState("0:00")
  const [endText, setEndText] = useState("1:00")
  const [timeError, setTimeError] = useState("")
  const [precise, setPrecise] = useState(true)
  const [tabVideo, setTabVideo] = useState<YoutubeTabVideo | null>(null)
  const [storedDirectory, setStoredDirectory] = useStoredValue("downloaderDirectory", DEFAULT_DOWNLOAD_DIRECTORY)
  const [directory, setDirectory] = useState(storedDirectory)
  const [folderError, setFolderError] = useState("")
  const { error, pending, run, setError } = useDownloadActions(state, downloaderCommand)
  const input = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const previous = useRef(state)
  const pendingTabTime = useRef<number | null>(null)
  const lastMediaKey = useRef("")

  useEffect(() => { setDirectory(storedDirectory) }, [storedDirectory])
  useEffect(() => {
    // The worker reports connection failures in the setup notice.
    void downloaderCommand("connect").catch(() => {})
  }, [])
  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (before.phase === "checking" && state.phase === "ready") toast({ title: "Helper connected" })
    if (before.phase === "updating" && state.phase !== "updating" && state.phase !== "error") {
      toast({ title: before.version === state.version ? "yt-dlp is up to date" : `yt-dlp updated to ${state.version}` })
    }
    if (before.phase === "downloading" && state.phase === "results" && state.cancelled) toast({ title: "Download cancelled" })
    if (before.phase !== "done" && state.phase === "done") toast({ title: state.section ? "Clip saved" : "Download complete" })
  }, [state])

  const media = state.media
  const canClip = Boolean(media && !media.isLive && media.duration >= 1)
  const helperSupportsClip = Boolean(state.capabilities?.includes("clip"))
  const duration = media && media.duration >= 1 ? Math.floor(media.duration) : 1
  const showingPickScreen = state.phase !== "setup" && state.phase !== "downloading" && state.phase !== "done" && (!media || editing || state.phase !== "results")
  const pollingYoutube = showingPickScreen || (state.phase === "results" && !editing && rangeMode === "clip")

  useEffect(() => {
    if (!pollingYoutube) return
    let active = true
    const refresh = () => {
      void readActiveYoutubeTab().then((video) => {
        if (active) setTabVideo(video)
      })
    }
    refresh()
    const timer = window.setInterval(refresh, 1000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [pollingYoutube])

  useEffect(() => {
    if (!media) {
      lastMediaKey.current = ""
      return
    }
    const key = `${state.url ?? ""}::${media.title}::${media.duration}`
    if (lastMediaKey.current === key) return
    lastMediaKey.current = key
    const initial = defaultClipRange(media.duration, pendingTabTime.current)
    pendingTabTime.current = null
    setClipStart(initial.start)
    setClipEnd(initial.end)
    setStartText(formatTime(initial.start))
    setEndText(formatTime(initial.end))
    setTimeError("")
    if (media.isLive || media.duration < 1) setRangeMode("full")
  }, [media, state.url])

  const clipRange = clampClipRange(clipStart, clipEnd, duration)
  const tabMatches = Boolean(tabVideo && isSameYoutubeVideo(state.url, tabVideo.url))
  const formats = media?.[mode] ?? []
  const selectedId = formats.some(f => f.id === selection) ? selection : defaultDownloadFormat(formats)
  const selected = formats.find(f => f.id === selectedId)
  const effectiveRangeMode = rangeMode === "clip" && canClip ? "clip" : "full"
  const defaultName = media
    ? (effectiveRangeMode === "clip" ? defaultClipFilename(media.title, clipRange.start, clipRange.end) : media.title)
    : ""
  const filename = (enteredName ?? defaultName).slice(0, 120)
  const working = ["reading", "checking", "updating"].includes(state.phase)

  const applyRange = (next: { start: number; end: number }) => {
    const clamped = clampClipRange(next.start, next.end, duration)
    setClipStart(clamped.start)
    setClipEnd(clamped.end)
    setStartText(formatTime(clamped.start))
    setEndText(formatTime(clamped.end))
    setTimeError("")
  }

  const onTimeInput = (which: "start" | "end", raw: string) => {
    if (which === "start") setStartText(raw)
    else setEndText(raw)
    const result = validateClipTimeInput(which, raw, clipRange.start, clipRange.end, duration)
    if (!result.ok) {
      setTimeError(result.error)
      return
    }
    setTimeError("")
    if (which === "start") setClipStart(result.value)
    else setClipEnd(result.value)
  }

  const syncTimeFieldOnBlur = (which: "start" | "end") => {
    const raw = which === "start" ? startText : endText
    const result = validateClipTimeInput(which, raw, clipRange.start, clipRange.end, duration)
    if (result.ok) {
      if (which === "start") setStartText(formatTime(result.value))
      else setEndText(formatTime(result.value))
    }
  }

  const setBoundToNow = (which: "start" | "end") => {
    if (!tabVideo) return
    const now = Math.min(Math.max(0, Math.floor(tabVideo.currentTime)), duration)
    if (which === "start") {
      const nextStart = Math.min(now, Math.max(0, duration - 1))
      const nextEnd = nextStart >= clipRange.end ? Math.min(duration, Math.max(nextStart + 1, nextStart + 60)) : clipRange.end
      applyRange({ start: nextStart, end: nextEnd })
      return
    }
    const nextEnd = Math.max(1, now)
    const nextStart = nextEnd <= clipRange.start ? Math.max(0, nextEnd - 60) : clipRange.start
    applyRange({ start: nextStart, end: nextEnd })
  }

  const setupCommands = <Button type="button" onClick={() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("downloader-setup.html") }).catch(error => setError(String(error)))
  }}>Setup commands</Button>

  const read = (targetUrl = link, tabTime: number | null = null) => {
    const trimmed = targetUrl.trim()
    if (!trimmed) { setError("Paste a link first."); input.current?.focus(); return }
    if (!validDownloadUrl(trimmed)) { setError("That doesn’t look like a link."); input.current?.focus(); return }
    pendingTabTime.current = tabTime
    setEditing(false)
    setSelection("")
    setEnteredName(null)
    void run("formats", { url: trimmed })
  }

  const saveDirectory = (value = directory, notify = false) => {
    const trimmed = value.trim()
    if (!validDownloadDirectory(trimmed)) {
      setFolderError("Enter an absolute folder path, such as /home/you/Videos, or one starting with ~.")
      folderInput.current?.focus()
      return undefined
    }
    setFolderError("")
    setDirectory(trimmed)
    void setStoredDirectory(trimmed)
      .then(() => { if (notify) toast({ title: "Save folder updated", description: trimmed }) })
      .catch(error => setFolderError(String(error)))
    return trimmed
  }

  const download = () => {
    const folder = saveDirectory()
    if (!folder || !selected) return
    if (effectiveRangeMode === "clip") {
      if (!helperSupportsClip || !state.ffmpeg || timeError) return
      void run("download", {
        formatId: selectedId,
        filename: filename.trim(),
        directory: folder,
        section: clipRange,
        precise,
      })
      return
    }
    void run("download", { formatId: selectedId, filename: filename.trim(), directory: folder })
  }

  const mediaCard = media && <div className="zed-row zed-downloader-media">
    <span className={`zed-downloader-thumbnail${effectiveRangeMode === "clip" ? " zed-downloader-thumbnail--sm" : ""}`} aria-hidden="true">
      <Icon name={effectiveRangeMode === "clip" ? "play" : "quality"} size={effectiveRangeMode === "clip" ? 18 : 32} />
      {(media.duration > 0 || media.isLive) && <span>{media.isLive ? "Live" : formatTime(media.duration)}</span>}
    </span>
    <div className="zed-downloader-text">
      <strong>{media.title}</strong>
      <p className="zed-helper">{[media.uploader, media.host].filter(Boolean).join(" · ")}</p>
      {state.phase === "results" && <Button variant="ghost" onClick={() => { setEditing(true); setLink(state.url ?? link); setEnteredName(null) }}>Change link</Button>}
    </div>
  </div>

  const footnote = <p className="zed-helper">Works with YouTube and the 1,000+ other sites yt-dlp supports. Clips are cut on this computer. Download only content you own or have permission to save.</p>

  const folderField = <div className="zed-stack">
    <label className="zed-helper" htmlFor="zed-download-folder">Save folder</label>
    <div className="zed-actions">
      <input ref={folderInput} id="zed-download-folder" className="zed-input zed-downloader-link" value={directory} autoComplete="off" spellCheck={false} disabled={pending}
        aria-invalid={Boolean(folderError)} aria-describedby="zed-download-folder-help"
        onChange={event => { setDirectory(event.target.value); setFolderError("") }}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); saveDirectory(directory, true) } }}
        onBlur={() => { if (directory.trim() !== storedDirectory && validDownloadDirectory(directory)) saveDirectory() }} />
      <Button type="button" disabled={pending} onClick={() => saveDirectory(directory, true)}>Save</Button>
    </div>
    <p id="zed-download-folder-help" className={folderError ? "zed-downloader-error" : "zed-helper"} role={folderError ? "alert" : undefined}>
      {folderError || "Absolute path, or one starting with ~. The folder is created when the download starts."}
    </p>
  </div>

  if (state.phase === "setup") return <div className="zed-stack">
    <Notice title="Downloader helper not found">Follow the setup commands for your operating system, then click Check again.{(error || state.error) && <p>{error || state.error}</p>}</Notice>
    <div className="zed-actions">{setupCommands}
      <Button variant="default" disabled={pending} onClick={() => void run("ping")}>Check again</Button></div>
  </div>

  if (state.phase === "done") {
    const isClip = Boolean(state.section)
    const clipMeta = state.section ? `${formatTime(state.section.end - state.section.start)} clip · ` : ""
    return <div className="zed-stack">
      <Card><div className="zed-stack zed-downloader-done" role="status"><span className="zed-well"><Icon name="check" size={32} /></span>
        <h2 className="zed-title">{isClip ? "Clip saved" : "Download complete"}</h2><strong className="zed-downloader-filename">{state.filename}</strong>
        <p className="zed-helper zed-downloader-path">{clipMeta}{state.summary} · {downloadSize(state.size)} · {state.directory || directory}</p></div></Card>
      <Button variant="default" disabled={pending} onClick={() => void run("reveal")}><Icon name="folder" />Show in folder</Button>
      <div className="zed-grid">
        <Button disabled={pending} onClick={() => void run("open")}><Icon name={isClip ? "file" : "open"} />Open file</Button>
        {isClip && media ? (
          <Button disabled={pending} onClick={() => { setEnteredName(null); void run("reset", { keepMedia: true }) }}>Clip another part</Button>
        ) : (
          <Button disabled={pending} onClick={() => { setLink(""); setEditing(false); setEnteredName(null); void run("reset") }}>New download</Button>
        )}
      </div>
      {isClip && media && (
        <Button variant="ghost" disabled={pending} onClick={() => { setLink(""); setEditing(false); setEnteredName(null); void run("reset") }}>New download</Button>
      )}
      {error && <Notice title="Couldn’t open the file">{error}</Notice>}
    </div>
  }

  if (state.phase === "downloading") {
    const isClip = Boolean(state.section)
    const clipLine = state.section ? `Clip ${formatTime(state.section.start)}–${formatTime(state.section.end)} · ` : ""
    return <div className="zed-stack">
      <Card><div className="zed-stack">
        {mediaCard}
        <div className="zed-actions">
          <span className="zed-well" aria-hidden="true"><Icon name={isClip ? "scissors" : "download"} /></span>
          <p className="zed-helper zed-downloader-text">{clipLine}{state.summary || selected?.label}</p>
        </div>
        <progress className="zed-download-progress" aria-label="Download progress" max={100} value={state.pct ?? undefined} />
        <div className="zed-helper-row zed-helper"><span><strong>{state.pct == null ? "Working" : `${state.pct}%`}</strong> · {downloadSize(state.downloaded)} of {downloadSize(state.total)}</span>
          <span>{state.speed ? `${downloadSize(state.speed)}/s` : "Speed unknown"} · {state.eta ? `${Math.ceil(state.eta)}s left` : "Estimating time"}</span></div>
        <p className="zed-helper" role="status">{state.stage || (isClip ? "Downloading clip…" : "Downloading…")}</p></div></Card>
      <Button disabled={pending} onClick={() => void run("cancel")}>Cancel download</Button>
      <p className="zed-helper">You can close this popup. The download continues in the background.</p>
      {error && <Notice title="Couldn’t cancel">{error}</Notice>}
    </div>
  }

  if (state.phase === "results" && media && !editing) {
    const clipLength = clipRange.end - clipRange.start
    const clipBytes = estimateClipSize(selected, clipLength, duration)
    const clipFormatSummary = selected ? (mode === "audio" ? selected.label.split(" · ")[0] : `${selected.label} · ${selected.meta.split(" · ")[0]}`) : "Choose another media type"

    return <div className="zed-stack zed-downloader-results">
      {mediaCard}
      <div className="zed-downloader-controls">
        <div className="zed-actions" aria-label="Media type">
          {(["video", "audio"] as const).map(value => (
            <Button key={value} aria-pressed={mode === value} variant={mode === value ? "default" : "outline"}
              onClick={() => { setMode(value); setSelection(defaultDownloadFormat(media[value])) }}>
              {value === "video" ? "Video" : "Audio only"}
            </Button>
          ))}
        </div>
        <span className="zed-downloader-divider" aria-hidden="true" />
        <div className="zed-actions" aria-label="Download range">
          <Button type="button" aria-pressed={effectiveRangeMode === "full"} variant={effectiveRangeMode === "full" ? "default" : "outline"}
            onClick={() => { setRangeMode("full"); setTimeError("") }}>
            Full video
          </Button>
          <Button type="button" aria-pressed={effectiveRangeMode === "clip"} variant={effectiveRangeMode === "clip" ? "default" : "outline"}
            disabled={!canClip} onClick={() => setRangeMode("clip")}>
            <Icon name="scissors" size={16} />Clip
          </Button>
        </div>
      </div>
      {!canClip && <p className="zed-helper">Live streams and videos with unknown duration can’t be clipped.</p>}

      {effectiveRangeMode === "clip" ? (
        <div className="zed-stack">
          {!helperSupportsClip && (
            <Notice title="Update the Zed helper to cut clips">
              Your installed helper is from an older version and cannot cut clips yet. Re-run the setup command, then click Check again.
              <div className="zed-actions">
                <Button type="button" disabled={pending} onClick={() => void run("ping")}>Check again</Button>
                {setupCommands}
              </div>
            </Notice>
          )}
          {state.ffmpeg === false && (
            <Notice title="Cutting a clip needs ffmpeg.">
              Install ffmpeg to cut clips, then click Check again.
              <div className="zed-actions">
                <Button type="button" disabled={pending} onClick={() => void run("ping")}>Check again</Button>
                {setupCommands}
              </div>
            </Notice>
          )}
          <TimelineTrimmer duration={duration} start={clipRange.start} end={clipRange.end} disabled={pending} onChange={applyRange} />
          <div className="zed-time-row">
            <div className="zed-time-field">
              <label className="zed-time-label" htmlFor="zed-clip-start">Start</label>
              <div className="zed-time-controls">
                <button type="button" className="zed-time-step" aria-label="Start 1 second earlier"
                  disabled={pending || clipRange.start <= 0} onClick={() => applyRange({ start: clipRange.start - 1, end: clipRange.end })}>
                  <Icon name="minus" size={18} />
                </button>
                <input id="zed-clip-start" className="zed-input zed-time-input" aria-label="Start time" value={startText} disabled={pending}
                  onChange={event => onTimeInput("start", event.target.value)} onBlur={() => syncTimeFieldOnBlur("start")} />
                <button type="button" className="zed-time-step" aria-label="Start 1 second later"
                  disabled={pending || clipRange.start >= clipRange.end - 1} onClick={() => applyRange({ start: clipRange.start + 1, end: clipRange.end })}>
                  <Icon name="plus" size={18} />
                </button>
              </div>
              {tabMatches && tabVideo && (
                <button type="button" className="zed-btn zed-btn--inline" disabled={pending} onClick={() => setBoundToNow("start")}>
                  Set to now · {formatTime(tabVideo.currentTime)}
                </button>
              )}
            </div>
            <div className="zed-time-length">Clip length<strong>{formatTime(clipLength)}</strong></div>
            <div className="zed-time-field zed-time-field--end">
              <label className="zed-time-label" htmlFor="zed-clip-end">End</label>
              <div className="zed-time-controls">
                <button type="button" className="zed-time-step" aria-label="End 1 second earlier"
                  disabled={pending || clipRange.end <= clipRange.start + 1} onClick={() => applyRange({ start: clipRange.start, end: clipRange.end - 1 })}>
                  <Icon name="minus" size={18} />
                </button>
                <input id="zed-clip-end" className="zed-input zed-time-input" aria-label="End time" value={endText} disabled={pending}
                  onChange={event => onTimeInput("end", event.target.value)} onBlur={() => syncTimeFieldOnBlur("end")} />
                <button type="button" className="zed-time-step" aria-label="End 1 second later"
                  disabled={pending || clipRange.end >= duration} onClick={() => applyRange({ start: clipRange.start, end: clipRange.end + 1 })}>
                  <Icon name="plus" size={18} />
                </button>
              </div>
              {tabMatches && tabVideo && (
                <button type="button" className="zed-btn zed-btn--inline" disabled={pending} onClick={() => setBoundToNow("end")}>
                  Set to now · {formatTime(tabVideo.currentTime)}
                </button>
              )}
            </div>
          </div>
          {timeError && <p className="zed-downloader-error" role="alert">{timeError}</p>}

          <div className="zed-chip-row" role="radiogroup" aria-label={`${mode === "video" ? "Video" : "Audio"} clip quality`} onKeyDown={event => {
            if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !formats.length) return
            event.preventDefault()
            const current = formats.findIndex(f => f.id === selectedId)
            const index = event.key === "Home" ? 0 : event.key === "End" ? formats.length - 1 : (current + (event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1) + formats.length) % formats.length
            setSelection(formats[index].id)
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus()
          }}>
            {formats.map(format => (
              <button type="button" key={format.id} className="zed-chip" role="radio" aria-checked={selectedId === format.id}
                tabIndex={selectedId === format.id ? 0 : -1} title={format.meta} onClick={() => setSelection(format.id)}>
                {mode === "audio" ? format.label.split(" · ")[0] : format.label}
              </button>
            ))}
            {!formats.length && <p className="zed-empty">No {mode === "video" ? "video" : "audio"} formats are available for this link.</p>}
          </div>

          <SwitchRow
            label="Precise cut"
            description={precise ? "Re-encodes so the clip starts exactly at the start time. Slower." : "Fast. May start a few seconds before the start time."}
            checked={precise}
            disabled={pending}
            onChange={setPrecise}
          />
        </div>
      ) : (
        <div className="zed-stack" role="radiogroup" aria-label={`${mode === "video" ? "Video" : "Audio"} formats`} onKeyDown={event => {
          if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key) || !formats.length) return
          event.preventDefault()
          const current = formats.findIndex(f => f.id === selectedId)
          const index = event.key === "Home" ? 0 : event.key === "End" ? formats.length - 1 : (current + (event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1) + formats.length) % formats.length
          setSelection(formats[index].id)
          event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus()
        }}>
          {formats.map(format => <button type="button" className="zed-format" key={format.id} role="radio" aria-checked={selectedId === format.id} tabIndex={selectedId === format.id ? 0 : -1} onClick={() => setSelection(format.id)}>
            <span className="zed-format-radio" aria-hidden="true" /><span className="zed-downloader-text"><strong>{format.label}</strong>{format.tags.map(tag => <span className="zed-pill" key={tag}>{tag}</span>)}<span className="zed-helper block">{format.meta}</span></span>
            <span>{downloadSize(format.size, format.approximate)}</span>
          </button>)}
          {!formats.length && <p className="zed-empty">No {mode === "video" ? "video" : "audio"} formats are available for this link.</p>}
        </div>
      )}

      <div className="zed-stack">
        <label className="zed-helper" htmlFor="zed-download-name">File name</label>
        <input id="zed-download-name" className="zed-input zed-downloader-link" value={filename} maxLength={120}
          autoComplete="off" placeholder={defaultName} onChange={event => setEnteredName(event.target.value)} />
        <p className="zed-helper">The file extension is added automatically. Leave blank to use the default name.</p>
      </div>
      {folderField}
      <footer className="zed-downloader-footer">
        <div className="zed-downloader-text">
          {effectiveRangeMode === "clip" ? (
            <>
              <strong>{selected ? `${clipFormatSummary} · ${downloadSize(clipBytes, true)}` : "Choose another media type"}</strong>
              <p className="zed-helper">{formatTime(clipLength)} clip · {formatTime(clipRange.start)} – {formatTime(clipRange.end)}</p>
            </>
          ) : (
            <>
              <strong>{selected ? `${selected.label} · ${downloadSize(selected.size, selected.approximate)}` : "Choose another media type"}</strong>
              <p className="zed-helper">{mode === "audio" ? "Audio only, no video" : state.ffmpeg ? "Video + best audio, merged into one file" : "Single-file formats only. Install ffmpeg to merge video and audio."}</p>
            </>
          )}
        </div>
        <Button variant="default" disabled={!selected || pending || (effectiveRangeMode === "clip" && (!helperSupportsClip || !state.ffmpeg || Boolean(timeError)))} onClick={download}>
          <Icon name="download" />{effectiveRangeMode === "clip" ? "Download clip" : "Download"}
        </Button>
      </footer>
      {error && <Notice title="Couldn’t start download">{error}</Notice>}
    </div>
  }

  return <div className="zed-stack">
    <div className="zed-helper-row"><span className="zed-pill zed-pill--active">{working ? "Working" : "Ready"}</span><span className="zed-helper">yt-dlp {state.version || "checking…"}</span>
      <Button variant="ghost" disabled={pending || working} onClick={() => void run("update")}>Update</Button></div>
    {setupCommands}
    {state.ffmpeg === false && <Notice title="ffmpeg is not installed">Merging video and audio and cutting clips need ffmpeg. Single-file videos and original audio are still available.
      <Button type="button" disabled={working || pending} onClick={() => void run("ping")}>Check again</Button></Notice>}
    {state.phase === "error" && <Notice title="Couldn’t read this link">yt-dlp reported “{state.error}”. Check the link, or update yt-dlp and try again.</Notice>}
    {tabVideo && (
      <div className="zed-row zed-downloader-media">
        <span className="zed-downloader-thumbnail zed-downloader-thumbnail--tab" aria-hidden="true"><Icon name="play" size={22} /></span>
        <div className="zed-downloader-text">
          <p className="zed-helper">Video in this tab</p>
          <strong>{tabVideo.title}</strong>
          <p className="zed-helper">youtube.com · {tabVideo.isLive ? "Live" : `playing at ${formatTime(tabVideo.currentTime)}`}</p>
        </div>
        <Button type="button" variant="default" disabled={working || pending} onClick={() => {
          setLink(tabVideo.url)
          setError("")
          read(tabVideo.url, tabVideo.currentTime)
        }}>Use this video</Button>
      </div>
    )}
    <form className="zed-stack" onSubmit={event => { event.preventDefault(); read() }}>
      <label className="zed-helper" htmlFor="zed-video-link">Video link</label>
      <div className="zed-actions"><input ref={input} id="zed-video-link" className="zed-input zed-downloader-link" type="text" inputMode="url" autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? "zed-download-error" : undefined}
        placeholder="Paste a link from YouTube, X, Instagram, TikTok…" value={link} disabled={working} onChange={event => { setLink(event.target.value); setError("") }} />
        <Button type="button" disabled={working} onClick={() => void (async () => { try { setLink(await navigator.clipboard.readText()); setError("") } catch { input.current?.focus() } })()}><Icon name="clipboard" />Paste</Button></div>
      {error && <p id="zed-download-error" className="zed-downloader-error" role="alert">{error}</p>}
      {working ? <Card><div className="zed-stack"><strong>{state.phase === "reading" ? "Reading link…" : state.phase === "updating" ? "Updating yt-dlp…" : "Checking helper…"}</strong>
        <p className="zed-helper">{state.phase === "reading" ? "Asking yt-dlp for available formats" : "Waiting for the local helper"}</p>
        <progress className="zed-download-progress" aria-label="Waiting for yt-dlp" />
        <Button type="button" disabled={pending} onClick={() => void run("cancel")}>Cancel</Button></div></Card>
        : <Button type="submit" variant="default" disabled={pending}>Get formats</Button>}
    </form>
    {folderField}
    {footnote}
  </div>
}
