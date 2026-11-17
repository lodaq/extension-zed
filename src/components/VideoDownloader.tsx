import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Card, Notice } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
import { defaultDownloadFormat, downloadSize, downloaderCommand, validDownloadUrl, type DownloaderState } from "@/lib/downloader"

export default function VideoDownloader({ state }: { state: DownloaderState }) {
  const [enteredLink, setLink] = useState<string | null>(null)
  const link = enteredLink ?? state.url ?? ""
  const [mode, setMode] = useState<"video" | "audio">("video")
  const [selection, setSelection] = useState("")
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const previous = useRef(state)
  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (before.phase === "checking" && state.phase === "ready") toast({ title: "Helper connected" })
    if (before.phase === "updating" && state.phase !== "updating" && state.phase !== "error") {
      toast({ title: before.version === state.version ? "yt-dlp is up to date" : `yt-dlp updated to ${state.version}` })
    }
    if (before.phase === "downloading" && state.phase === "results" && state.cancelled) toast({ title: "Download cancelled" })
    if (before.phase !== "done" && state.phase === "done") toast({ title: "Download complete" })
  }, [state])
  useEffect(() => {
    if (state.phase === "done" && !state.seen) void downloaderCommand("seen").catch(console.error)
  }, [state.phase, state.seen])

  const run = async (command: string, data?: Record<string, unknown>) => {
    setError("")
    setPending(true)
    try { await downloaderCommand(command, data) }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setPending(false) }
  }
  const read = () => {
    if (!link.trim()) { setError("Paste a link first."); input.current?.focus(); return }
    if (!validDownloadUrl(link)) { setError("That doesn’t look like a link."); input.current?.focus(); return }
    setEditing(false)
    setSelection("")
    void run("formats", { url: link.trim() })
  }
  const media = state.media
  const formats = media?.[mode] ?? []
  const selectedId = formats.some(f => f.id === selection) ? selection : defaultDownloadFormat(formats)
  const selected = formats.find(f => f.id === selectedId)
  const working = ["reading", "checking", "updating"].includes(state.phase)
  const mediaCard = media && <div className="zed-row zed-downloader-media">
    <span className="zed-downloader-thumbnail" aria-hidden="true"><Icon name="quality" size={32} /><span>{Math.floor(media.duration / 60)}:{String(Math.floor(media.duration % 60)).padStart(2, "0")}</span></span>
    <div className="zed-downloader-text"><strong>{media.title}</strong><p className="zed-helper">{[media.uploader, media.host].filter(Boolean).join(" · ")}</p>
      {state.phase === "results" && <Button variant="ghost" onClick={() => { setEditing(true); setLink(state.url ?? link) }}>Change link</Button>}</div>
  </div>
  const footnote = <p className="zed-helper">Works with YouTube and the 1,000+ other sites yt-dlp supports. Download only content you own or have permission to save.</p>

  if (state.phase === "setup") return <div className="zed-stack">
    <Notice title="Downloader helper not found">Video downloads need yt-dlp and the Zed helper installed on this computer. Nothing is sent to any server.{state.error && <p>{state.error}</p>}</Notice>
    <div className="zed-grid"><Button onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL("downloader-setup.html") }).catch(error => setError(String(error)))}>Setup guide</Button>
      <Button variant="default" disabled={pending} onClick={() => void run("ping")}>Check again</Button></div>
    {error && <Notice title="Couldn’t connect">{error}</Notice>}
  </div>

  if (state.phase === "done") return <div className="zed-stack">
    <Card><div className="zed-stack zed-downloader-done" role="status"><span className="zed-well"><Icon name="check" size={32} /></span>
      <h2 className="zed-title">Download complete</h2><strong className="zed-downloader-filename">{state.filename}</strong>
      <p className="zed-helper">{state.summary} · {downloadSize(state.size)} · Downloads/Zed</p></div></Card>
    <Button variant="default" disabled={pending} onClick={() => void run("reveal")}><Icon name="folder" />Show in folder</Button>
    <div className="zed-grid"><Button disabled={pending} onClick={() => void run("open")}><Icon name="open" />Open file</Button>
      <Button disabled={pending} onClick={() => { setLink(""); setEditing(false); void run("reset") }}>New download</Button></div>
    {error && <Notice title="Couldn’t open the file">{error}</Notice>}
  </div>

  if (state.phase === "downloading") return <div className="zed-stack">
    <Card><div className="zed-stack">{mediaCard}<p className="zed-helper">{state.summary || selected?.label}</p>
      <progress className="zed-download-progress" aria-label="Download progress" max={100} value={state.pct ?? undefined} />
      <div className="zed-helper-row zed-helper"><span><strong>{state.pct == null ? "Working" : `${state.pct}%`}</strong> · {downloadSize(state.downloaded)} of {downloadSize(state.total)}</span>
        <span>{state.speed ? `${downloadSize(state.speed)}/s` : "Speed unknown"} · {state.eta ? `${Math.ceil(state.eta)}s left` : "Estimating time"}</span></div>
      <p className="zed-helper" role="status">{state.stage || "Downloading…"}</p></div></Card>
    <Button disabled={pending} onClick={() => void run("cancel")}>Cancel download</Button>
    <p className="zed-helper">You can close this popup. The download continues in the background.</p>
    {error && <Notice title="Couldn’t cancel">{error}</Notice>}
  </div>

  if (state.phase === "results" && media && !editing) return <div className="zed-stack zed-downloader-results">
    {mediaCard}
    <div className="zed-actions" aria-label="Media type">{(["video", "audio"] as const).map(value => <Button key={value} aria-pressed={mode === value}
      variant={mode === value ? "default" : "outline"} onClick={() => { setMode(value); setSelection(defaultDownloadFormat(media[value])) }}>{value === "video" ? "Video" : "Audio only"}</Button>)}</div>
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
    <footer className="zed-downloader-footer"><div className="zed-downloader-text"><strong>{selected ? `${selected.label} · ${downloadSize(selected.size, selected.approximate)}` : "Choose another media type"}</strong>
      <p className="zed-helper">{mode === "audio" ? "Audio only, no video" : state.ffmpeg ? "Video + best audio, merged into one file" : "Single-file formats only. Install ffmpeg to merge video and audio."}</p></div>
      <Button variant="default" disabled={!selected || pending} onClick={() => void run("download", { formatId: selectedId })}><Icon name="download" />Download</Button></footer>
    {error && <Notice title="Couldn’t start download">{error}</Notice>}
  </div>

  return <div className="zed-stack">
    <div className="zed-helper-row"><span className="zed-pill zed-pill--active">{working ? "Working" : "Ready"}</span><span className="zed-helper">yt-dlp {state.version || "checking…"}</span>
      <Button variant="ghost" disabled={pending || working} onClick={() => void run("update")}>Update</Button></div>
    {state.ffmpeg === false && <Notice title="ffmpeg is not installed">Merging video and audio needs ffmpeg. Single-file videos and original audio are still available.
      <Button type="button" disabled={working || pending} onClick={() => void run("ping")}>Check again</Button></Notice>}
    {state.phase === "error" && <Notice title="Couldn’t read this link">yt-dlp reported “{state.error}”. Check the link, or update yt-dlp and try again.</Notice>}
    <form className="zed-stack" onSubmit={event => { event.preventDefault(); read() }}>
      <label className="zed-helper" htmlFor="zed-video-link">Video link</label>
      <div className="zed-actions"><input ref={input} id="zed-video-link" className="zed-input zed-downloader-link" type="text" inputMode="url" autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? "zed-download-error" : undefined}
        placeholder="Paste a link from YouTube, X, Instagram, TikTok…" value={link} disabled={working} onChange={event => { setLink(event.target.value); setError("") }} />
        <Button type="button" disabled={working} onClick={() => void (async () => { try { setLink(await navigator.clipboard.readText()); setError("") } catch { input.current?.focus() } })()}><Icon name="copy" />Paste</Button></div>
      {error && <p id="zed-download-error" className="zed-downloader-error" role="alert">{error}</p>}
      {working ? <Card><div className="zed-stack"><strong>{state.phase === "reading" ? "Reading link…" : state.phase === "updating" ? "Updating yt-dlp…" : "Checking helper…"}</strong>
        <p className="zed-helper">{state.phase === "reading" ? "Asking yt-dlp for available formats" : "Waiting for the local helper"}</p>
        <progress className="zed-download-progress" aria-label="Waiting for yt-dlp" />
        <Button type="button" disabled={pending} onClick={() => void run("cancel")}>Cancel</Button></div></Card>
        : <Button type="submit" variant="default" disabled={pending}>Get formats</Button>}
    </form>
    {footnote}
  </div>
}
