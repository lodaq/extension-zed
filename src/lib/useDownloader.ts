import { useEffect, useState } from "react"
import * as advanced from "./advancedDownloader"
import * as direct from "./downloader"

function useDownloaderState<State extends { phase: string; error?: string }>(
  initial: State, key: string, command: (name: string) => Promise<State>, errorPhase: State["phase"],
) {
  const [state, setState] = useState(initial)
  useEffect(() => {
    if (!direct.DOWNLOADER_ENABLED) return
    let active = true
    let changed = false
    const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, area) => {
      if (area === "session" && changes[key]?.newValue) {
        changed = true
        setState(changes[key].newValue as State)
      }
    }
    chrome.storage.onChanged.addListener(listener)
    void command("state").then(value => { if (active && !changed) setState(value) }).catch(error => {
      if (active) setState({ ...initial, phase: errorPhase, error: String(error) })
    })
    return () => { active = false; chrome.storage.onChanged.removeListener(listener) }
  }, [command, errorPhase, initial, key])
  return state
}

export function useDownloader() {
  const state = useDownloaderState(direct.EMPTY_DOWNLOADER, direct.DOWNLOADER_STATE_KEY, direct.downloaderCommand, "error")
  useEffect(() => {
    if (state.phase !== "downloading") return
    const timer = window.setInterval(() => {
      void direct.downloaderCommand("state").catch(console.error)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [state.phase])
  return state
}

export function useAdvancedDownloader() {
  return useDownloaderState(advanced.EMPTY_DOWNLOADER, advanced.DOWNLOADER_STATE_KEY, advanced.downloaderCommand, "setup")
}

export function useDownloadActions(
  { phase, seen }: { phase: string; seen?: boolean },
  command: (name: string, data?: Record<string, unknown>) => Promise<unknown>,
) {
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (phase === "done" && !seen) void command("seen").catch(console.error)
  }, [command, phase, seen])

  async function run(name: string, data?: Record<string, unknown>) {
    setError("")
    setPending(true)
    try { await command(name, data) }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setPending(false) }
  }
  return { error, pending, run, setError }
}
