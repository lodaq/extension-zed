import { DOWNLOADER_ENABLED, DOWNLOADER_STATE_KEY, EMPTY_DOWNLOADER, validDownloadDirectory, validDownloadName, validDownloadUrl, type DownloaderState } from "./downloader"

const HOST = "com.extension_zed.downloader"
let port: chrome.runtime.Port | undefined
let serial = 0
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
let writes = Promise.resolve()

function save(state: DownloaderState) {
  // Serialize updates so a slow progress write cannot replace completion.
  writes = writes.catch(console.error).then(() => chrome.storage.session.set({ [DOWNLOADER_STATE_KEY]: state }))
  return writes
}

function disconnect(connection: chrome.runtime.Port, error: Error) {
  if (port !== connection) return
  port = undefined
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error) }
  pending.clear()
  void save({ phase: "setup", error: error.message }).catch(console.error)
  connection.disconnect()
}

function validState(value: unknown): value is DownloaderState {
  if (!value || typeof value !== "object") return false
  const state = value as DownloaderState
  if (!["checking", "ready", "reading", "updating", "results", "downloading", "done", "error"].includes(state.phase)) return false
  if (state.ffmpeg !== undefined && typeof state.ffmpeg !== "boolean") return false
  for (const key of ["version", "url", "error", "stage", "filename", "summary", "directory"] as const) {
    if (state[key] !== undefined && (typeof state[key] !== "string" || state[key]!.length > 8192)) return false
  }
  for (const key of ["pct", "downloaded", "total", "speed", "eta", "size"] as const) {
    if (state[key] !== undefined && state[key] !== null && (typeof state[key] !== "number" || !Number.isFinite(state[key]) || state[key]! < 0)) return false
  }
  if (state.pct != null && state.pct > 100) return false
  if (state.media) {
    const media = state.media
    if (![media.title, media.uploader, media.host].every(v => typeof v === "string") || !Number.isFinite(media.duration)) return false
    for (const formats of [media.video, media.audio]) {
      if (!Array.isArray(formats) || formats.length > 500 || !formats.every(f => f &&
        [f.id, f.label, f.meta].every(v => typeof v === "string") && Number.isFinite(f.size) && f.size >= 0 &&
        typeof f.approximate === "boolean" && Array.isArray(f.tags) && f.tags.every(t => typeof t === "string"))) return false
    }
  }
  return true
}

export async function readDownloaderState(): Promise<DownloaderState> {
  await writes
  const stored = (await chrome.storage.session.get(DOWNLOADER_STATE_KEY))[DOWNLOADER_STATE_KEY] as DownloaderState | undefined
  if (!stored) return EMPTY_DOWNLOADER
  if (!port && ["downloading", "reading", "checking", "updating", "results"].includes(stored.phase)) {
    const state: DownloaderState = { phase: "error", error: "The helper disconnected. Read the link again to start a new task." }
    await save(state)
    return state
  }
  return stored
}

export async function handleDownloaderCommand(data: Record<string, unknown>, sender: chrome.runtime.MessageSender) {
  if (!DOWNLOADER_ENABLED || sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("index.html")) throw new Error("Downloader access denied")
  const command = data.command
  if (command === "state") return { ok: true, state: await readDownloaderState() }
  if (command === "connect") {
    const state = await readDownloaderState()
    if (port || state.phase === "done") return { ok: true, state }
    return handleDownloaderCommand({ command: "ping" }, sender)
  }
  if (command === "seen") {
    const state = await readDownloaderState()
    if (state.phase === "done") await save({ ...state, seen: true })
    return { ok: true, state }
  }
  if (typeof command !== "string" || !["ping", "formats", "download", "cancel", "open", "reveal", "update", "reset"].includes(command)) throw new Error("Invalid downloader command")
  if (command === "formats" && (typeof data.url !== "string" || !validDownloadUrl(data.url))) throw new Error("Only HTTP(S) video links are supported")
  if (command === "download") {
    if (typeof data.formatId !== "string" || !/^(video|audio|mp3):[\w.-]{1,100}$/.test(data.formatId)) throw new Error("Invalid format")
    if (data.filename !== undefined && (typeof data.filename !== "string" || !validDownloadName(data.filename.trim()))) throw new Error("Invalid file name")
    if (data.directory !== undefined && (typeof data.directory !== "string" || !validDownloadDirectory(data.directory))) throw new Error("Invalid download folder")
  }
  if (!port) {
    if (["download", "cancel", "open", "reveal"].includes(command)) throw new Error("The helper disconnected. Start a new download.")
    const connection = chrome.runtime.connectNative(HOST)
    port = connection
    connection.onMessage.addListener((message: { id?: string; ok?: boolean; error?: string; state?: unknown; event?: string } | null) => {
      if (!message || typeof message !== "object" || (message.state !== undefined && !validState(message.state))) {
        disconnect(connection, new Error("The downloader helper sent an invalid response"))
        return
      }
      if (message.event === "state" && message.state) void save(message.state as DownloaderState).catch(console.error)
      const request = message.id ? pending.get(message.id) : undefined
      if (!request) return
      clearTimeout(request.timer)
      pending.delete(message.id!)
      if (!message.ok) request.reject(new Error(message.error || "The helper could not complete this task"))
      else request.resolve({ ok: true, state: message.state })
    })
    connection.onDisconnect.addListener(() => {
      const error = new Error(chrome.runtime.lastError?.message || "The downloader helper disconnected")
      disconnect(connection, error)
    })
  }
  const connection = port
  const id = String(++serial)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      disconnect(connection, new Error("The downloader helper did not respond. Check the setup guide."))
    }, 15000)
    pending.set(id, { resolve, reject, timer })
    try { connection.postMessage({ id, command, url: data.url, formatId: data.formatId, filename: typeof data.filename === "string" ? data.filename.trim() : undefined, directory: typeof data.directory === "string" ? data.directory.trim() : undefined }) }
    catch (error) { disconnect(connection, error instanceof Error ? error : new Error(String(error))) }
  })
}
