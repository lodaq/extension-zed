import { useEffect, useId, useState } from "react"
import { Button } from "./ui/button"
import { SYSTEM_LIMITER_VIEW, type SystemSiteLimit } from "@/lib/systemSiteLimiter"
import { Card } from "@/design-system/components"
import { LIMITER_KEY, type SiteLimit } from "@/lib/siteLimiter"

export default function SiteLimiter() {
  const id = useId()
  const [url, setUrl] = useState("")
  const [mode, setMode] = useState<"block" | "daily">("block")
  const [minutes, setMinutes] = useState("30")
  const [rules, setRules] = useState<SiteLimit[]>([])
  const [system, setSystem] = useState(false)
  const [systemRules, setSystemRules] = useState<SystemSiteLimit[]>([])
  const [systemStatus, setSystemStatus] = useState("Checking administrator protection…")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  useEffect(() => {
    const load = async () => {
      try {
        const result = await chrome.runtime.sendMessage({ type: "limiter:list" })
        if (!result?.ok) throw new Error(result?.error || "Could not load website rules")
        setRules(result.rules)
      } catch (error) { setError(String(error).replace(/^(Error:\s*)+/, "")) }
    }
    void load()
    void chrome.runtime.sendMessage({ type: "limiter:system-status" }).then(result => {
      if (!result?.ok) throw new Error(result?.error || "Administrator service is unavailable")
      setSystemRules(result.rules)
      setSystemStatus("Administrator service connected. The administrator must verify mandatory Chrome policies before relying on protection.")
    }).catch(error => {
      setSystemStatus(String(error).replace(/^(Error:\s*)+/, ""))
      void chrome.storage.local.get(SYSTEM_LIMITER_VIEW).then(stored => setSystemRules((stored[SYSTEM_LIMITER_VIEW] ?? []) as SystemSiteLimit[])).catch(() => {})
    })
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === "local" && changes[SYSTEM_LIMITER_VIEW]) setSystemRules((changes[SYSTEM_LIMITER_VIEW].newValue ?? []) as SystemSiteLimit[])
      if (area === "local" && changes[LIMITER_KEY]) setRules((changes[LIMITER_KEY].newValue ?? []) as SiteLimit[])
    }
    chrome.storage.onChanged.addListener(changed)
    return () => chrome.storage.onChanged.removeListener(changed)
  }, [])
  return <section className="zed-stack zed-root">
    <p className="zed-helper">Rules cover the website and its subdomains on HTTP and HTTPS, regardless of the URL path. Once started, rules cannot be edited, paused or deleted here.</p>
    <p className="zed-helper" role="status">{notice}</p>
    <form className="zed-stack" aria-label="Create website rule" onSubmit={event => {
      event.preventDefault()
      setBusy(true); setError(""); setNotice("")
      void (async () => {
        try {
          const result = await chrome.runtime.sendMessage({ type: "limiter:add", url, mode, minutes: Number(minutes), system })
          if (!result?.ok) throw new Error(result?.error || "Could not create rule")
          if (system) setSystemRules(result.rules)
          else setRules(result.rules)
          setUrl("")
          setNotice("Website rule started. There is no early unblock control.")
        } catch (error) { setError(String(error).replace(/^(Error:\s*)+/, "")) } finally { setBusy(false) }
      })()
    }}>
      <label htmlFor={`${id}-url`}>Website URL</label>
      <input id={`${id}-url`} name="url" className="zed-input" value={url} onChange={e => setUrl(e.target.value)} placeholder="example.com or https://example.com" autoCapitalize="none" autoCorrect="off" spellCheck={false} required maxLength={2048} />
      <fieldset className="zed-stack"><legend>Rule type</legend>
        <label><input type="radio" name="mode" checked={mode === "block"} onChange={() => setMode("block")} /> Block for a duration</label>
        <label><input type="radio" name="mode" checked={mode === "daily"} onChange={() => setMode("daily")} /> Limit daily usage</label>
      </fieldset>
      <label htmlFor={`${id}-minutes`}>{mode === "block" ? "Block duration" : "Daily allowance"} (minutes)</label>
      <input id={`${id}-minutes`} name="minutes" type="number" className="zed-input" min={1} max={mode === "daily" ? 1440 : 525600} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} required />
      <p className="zed-helper">{mode === "daily" ? "Recurring every day, with no removal control. Counts the active tab in the focused window while the computer is in use. Browser-only rules reset at local midnight; administrator rules reset at midnight UTC. Cutoff may be delayed by browser alarms." : "Automatically allows access after the duration. No early unblock control."}</p>
      <details>
        <summary className="zed-helper">Advanced: administrator protection</summary>
        <div className="zed-stack">
          <p className="zed-helper">Optional. Ordinary timed blocks work without administrator setup.</p>
          <p className="zed-helper" role="status">{systemStatus}</p>
      <label><input name="system" type="checkbox" checked={system} onChange={e => setSystem(e.target.checked)} /> Administrator protection for this new rule</label>
      <p className="zed-helper">{system ? "Requires mandatory Zed and the administrator companion. Missing foreground reports for 75 seconds, including closing the browser or sleeping, blocks daily sites until midnight UTC. Changing this choice cannot change existing rules." : "Browser-only protection stops if Zed is disabled. Existing administrator rules remain enforced."}</p>
        </div>
      </details>
      <Button type="submit" disabled={busy}>{busy ? "Starting…" : mode === "block" ? "Block website" : "Start daily limit"}</Button>
    </form>
    {error && <p role="alert">{error}</p>}
    <p className="zed-helper">For browser-only rules, Chrome stops enforcement if this extension is disabled or removed. Rules survive browser restarts and settings resets, but cannot prevent changes made outside the extension.</p>
    {systemRules.map(rule => <Card key={`system-${rule.host}`}><strong className="break-all">{rule.host}</strong><p className="zed-helper">Administrator protected · {rule.mode === "block" ? `Blocked until ${new Date(rule.until).toLocaleString()}` : `${rule.locked ? "Blocked until midnight UTC" : "Foreground daily limit active"} · ${Math.ceil(rule.used / 60_000)} / ${rule.minutes} minutes today`}</p></Card>)}
    <div aria-live="polite" className="zed-stack">{rules.length ? rules.map(rule => <Card key={rule.id}><strong className="break-all">{rule.host}</strong><p className="zed-helper">Browser only · {rule.mode === "block" ? `Blocked until ${new Date(rule.until).toLocaleString()}` : `${rule.used >= rule.minutes * 60_000 ? "Blocked until local midnight" : "Daily limit active"} · ${Math.ceil(rule.used / 60_000)} / ${rule.minutes} minutes today`}</p></Card>) : !systemRules.length ? <p className="zed-empty">No website rules yet.</p> : null}</div>
  </section>
}
