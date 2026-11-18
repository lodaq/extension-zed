import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, Notice } from "@/design-system/components"
import { downloadSize, downloaderCommand, validDownloadUrl, type DownloaderState } from "@/lib/downloader"

import { useDownloadActions } from "@/lib/useDownloader"

export default function VideoDownloader({ state }: { state: DownloaderState }) {
  const [enteredLink, setLink] = useState<string | null>(null)
  const { error, pending, run, setError } = useDownloadActions(state, downloaderCommand)
  const input = useRef<HTMLInputElement>(null)
  const link = enteredLink ?? state.url ?? ""
  const busy = pending || state.phase === "reading"

  const message = error || state.error
  return <div className="zed-stack">
    {state.phase === "downloading" ? <>
      <Card><div className="zed-stack">
        <p className="zed-helper">Downloading {state.filename}</p>
        <progress className="zed-download-progress" aria-label="Download progress" max={100} value={state.pct ?? undefined} />
        {state.total !== undefined && <p className="zed-helper">{downloadSize(state.downloaded)} of {downloadSize(state.total)}</p>}
      </div></Card>
      <Button disabled={pending} onClick={() => void run("cancel")}>Cancel download</Button>
      <p className="zed-helper">The browser keeps downloading if you close this popup.</p>
    </> : state.phase === "done" ? <>
      <Card><div className="zed-stack zed-downloader-done" role="status">
        <h2 className="zed-title">Download complete</h2>
        <strong className="zed-downloader-filename" title={state.filename}>{state.filename}</strong>
      </div></Card>
      <div className="zed-grid">
        <Button variant="default" disabled={pending} onClick={() => void run("reveal")}>Show in folder</Button>
        <Button disabled={pending} onClick={() => { setLink(""); void run("reset") }}>New download</Button>
      </div>
    </> : <>
      <form className="zed-stack" onSubmit={event => {
        event.preventDefault()
        if (busy) return
        if (!validDownloadUrl(link.trim())) {
          setError("Enter an HTTP(S) media link without embedded credentials.")
          input.current?.focus()
          return
        }
        void run("download", { url: link.trim() })
      }}>
        <label className="zed-helper" htmlFor="zed-video-link">Media link</label>
        <input ref={input} id="zed-video-link" className="zed-input zed-downloader-link" value={link}
          type="url" autoComplete="off" maxLength={8192} readOnly={busy}
          onChange={event => setLink(event.target.value)} />
        <div className="zed-grid">
          <Button variant="default" type="submit" disabled={busy}>Download</Button>
          <Button type="button" disabled={busy} onClick={() => void run("scan")}>Find media on this page</Button>
        </div>
      </form>
      {state.phase === "reading" && <p role="status" className="zed-helper">Checking media link…</p>}
      {state.cancelled && <p role="status" className="zed-helper">Download cancelled.</p>}
      {state.sources?.map(source => <Button key={source.url} disabled={busy} className="zed-downloader-source"
        onClick={() => { setLink(source.url); setError(""); input.current?.focus() }}>
        {source.label}
      </Button>)}
      <p className="zed-helper">Paste a direct file link or a link to the Instagram Reel open in this tab. The Reel must expose a direct video file.</p>
    </>}
    {message && <Notice title="Video downloader">{message}</Notice>}
  </div>
}
