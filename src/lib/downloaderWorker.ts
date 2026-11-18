import { DOWNLOADER_ENABLED, DOWNLOADER_STATE_KEY, EMPTY_DOWNLOADER, findInstagramReelMedia, findPageMedia, instagramReelCode, mediaExtension, mediaFilename, validDownloadUrl, type DownloaderState } from "./downloader"
import { isRestrictedPage } from "./withActiveTab"

let operations = Promise.resolve<unknown>(undefined)
function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const result = operations.then(run, run)
  operations = result.catch(() => {})
  return result
}
async function save(state: DownloaderState) {
  await chrome.storage.session.set({ [DOWNLOADER_STATE_KEY]: state })
  return state
}
async function storedState(): Promise<DownloaderState> {
  return (await chrome.storage.session.get(DOWNLOADER_STATE_KEY))[DOWNLOADER_STATE_KEY] as DownloaderState ?? EMPTY_DOWNLOADER
}
async function refresh(): Promise<DownloaderState> {
  const state = await storedState()
  if (state.phase === "reading") return save({ ...state, phase: "error", error: "The link check was interrupted. Try again." })
  if (state.downloadId === undefined || state.phase !== "downloading") return state
  const [item] = await chrome.downloads.search({ id: state.downloadId })
  if (!item) return save({ ...state, phase: "error", error: "This download is no longer available in the browser." })
  const cancelled = item.state === "interrupted" && item.error === "USER_CANCELED"
  return save({ ...state, phase: cancelled ? "ready" : item.state === "complete" ? "done" : item.state === "interrupted" ? "error" : "downloading",
    cancelled, error: item.state === "interrupted" && !cancelled ? `The browser stopped the download: ${item.error || "network error"}. Try the link again.` : undefined,
    filename: item.filename.split(/[\\/]/).pop() || state.filename, downloaded: item.bytesReceived,
    total: item.totalBytes > 0 ? item.totalBytes : undefined, pct: item.state === "complete" ? 100 : item.totalBytes > 0 ? Math.min(100, Math.round(item.bytesReceived / item.totalBytes * 100)) : null })
}

async function inspectMedia(url: string) {
  if (!validDownloadUrl(url)) throw new Error("Use a direct HTTP(S) media link without embedded credentials.")
  if (/\.(m3u8|mpd)(?:[?#]|$)/i.test(new URL(url).pathname)) throw new Error("Streaming playlists cannot be downloaded here. Use a direct media file link.")
  const signal = AbortSignal.timeout(10000)
  const response = await fetch(url, { headers: { Range: "bytes=0-0" }, credentials: "include", signal })
  await response.body?.cancel()
  if (!response.ok) throw new Error(`The media server returned HTTP ${response.status}. Check that the link is still accessible.`)
  if (!validDownloadUrl(response.url || url)) throw new Error("The link redirected to an unsupported address.")
  const type = (response.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase()
  if (!type.startsWith("video/") && !type.startsWith("audio/") && !(type === "application/octet-stream" && mediaExtension(response.url || url))) {
    throw new Error("This link is a webpage or unsupported stream. Paste a direct video/audio file link, or find media on the current page.")
  }
  return mediaFilename(response.url || url, type)
}

async function reelMedia(tab: chrome.tabs.Tab | undefined, code: string) {
  if (tab?.id === undefined || !tab.url || instagramReelCode(tab.url) !== code) {
    throw new Error("Open the matching Instagram Reel in the active tab, then try Download again.")
  }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: findInstagramReelMedia,
    args: [new URL(tab.url).origin, code],
  })
  if (!result || !validDownloadUrl(result)) {
    throw new Error("Instagram hasn’t exposed a direct video file for this Reel. Start playback and try again.")
  }
  return result
}

async function run(data: Record<string, unknown>) {
  const state = await refresh()
  if (data.command === "state") return state
  if (data.command === "seen") return state.phase === "done" ? save({ ...state, seen: true }) : state
  if (data.command === "reveal") {
    if (state.phase !== "done" || state.downloadId === undefined) throw new Error("Complete a download first.")
    await chrome.downloads.show(state.downloadId)
    return state
  }
  if (data.command === "cancel") {
    if (state.phase === "downloading" && state.downloadId !== undefined) await chrome.downloads.cancel(state.downloadId)
    return refresh()
  }
  if (state.phase === "downloading") throw new Error("Cancel the current download before starting another.")
  if (data.command === "reset") return save(EMPTY_DOWNLOADER)
  if (data.command === "scan") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id === undefined || isRestrictedPage(tab.url ?? "")) throw new Error("Open a regular website to find media. Direct links work on any page.")
    const code = instagramReelCode(tab.url ?? "")
    if (code) {
      const url = await reelMedia(tab, code)
      return save({ phase: "ready", sources: [{ url, label: "Instagram Reel video" }] })
    }
    const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: findPageMedia })
    const urls = [...new Set(frames.flatMap(frame => Array.isArray(frame.result) ? frame.result : []))].filter(url => typeof url === "string" && validDownloadUrl(url)).slice(0, 100)
    return save({ phase: "ready", sources: urls.map(url => ({ url, label: new URL(url).pathname.split("/").pop() || new URL(url).hostname })),
      error: urls.length ? undefined : "No direct media files were found. Start playback and try again. Streaming and protected players are not supported." })
  }
  if (data.command !== "download" || typeof data.url !== "string") throw new Error("Invalid downloader command")
  const url = data.url.trim()
  if (!validDownloadUrl(url)) throw new Error("Use a direct HTTP(S) media link without embedded credentials.")
  await save({ phase: "reading", url, sources: state.sources })
  try {
    const code = instagramReelCode(url)
    let mediaUrl = url
    if (code) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      mediaUrl = await reelMedia(tab, code)
    }
    const filename = await inspectMedia(mediaUrl)
    const downloadId = await chrome.downloads.download({ url: mediaUrl, filename, conflictAction: "uniquify", saveAs: false })
    await save({ phase: "downloading", url, downloadId, filename: filename.slice(4), sources: state.sources, pct: null })
    return refresh()
  } catch (error) {
    return save({ phase: "error", url, sources: state.sources, error: error instanceof Error ? error.message : String(error) })
  }
}

export async function handleDownloaderCommand(data: Record<string, unknown>, sender: chrome.runtime.MessageSender) {
  if (!DOWNLOADER_ENABLED || sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("index.html")) throw new Error("Downloader access denied")
  return { ok: true, state: await enqueue(() => run(data)) }
}

export function installDownloader() {
  if (!DOWNLOADER_ENABLED || !chrome.downloads) return
  chrome.downloads.onChanged.addListener(delta => {
    void enqueue(async () => { const state = await storedState(); if (state.downloadId === delta.id) await refresh() }).catch(console.error)
  })
}
