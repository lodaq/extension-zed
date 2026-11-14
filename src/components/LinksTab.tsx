import { useState } from "react"
import { useStoredValue } from "@/lib/useStoredValue"
import { addLink, type SavedLink } from "@/lib/links"
import { Button } from "./ui/button"
import { toast } from "./ui/use-toast"
import { IconButton, LetterAvatar } from "@/design-system/components"
import { Icon } from "@/design-system/Icon"
const EMPTY: SavedLink[] = []
export function LinksTab() {
  const [links, setLinks] = useStoredValue<SavedLink[]>("savedLinks", EMPTY)
  const [input, setInput] = useState("")
  const [error, setError] = useState("")
  const [opening, setOpening] = useState<string | null>(null)
  async function open(link: SavedLink) {
    if (opening) return
    setOpening(link.url)
    try {
      const result = await chrome.runtime.sendMessage({ type: "zed:open-link", link })
      if (!result?.ok) throw new Error(result?.error)
    }
    catch { toast({ title: "Could not open or remove link", variant: "destructive" }) }
    finally { setOpening(null) }
  }
  async function add() { try { const added = await addLink(input); if (added === null) return; setInput(""); setError(""); toast({ title: added ? "Link added" : "Already saved" }) } catch (e) { setError(String(e)) } }
  return <section className="zed-stack zed-root"><form className="flex gap-2" onSubmit={event => { event.preventDefault(); void add() }}><input className="zed-input flex-1 min-w-0" aria-label="Link URL" placeholder="Paste a URL to save" value={input} onChange={e => setInput(e.target.value)} /><Button variant="default" className="zed-small" type="submit">Add</Button></form>{error && <p role="alert">{error}</p>}<div className="zed-helper-row"><span className="zed-helper">Open a link to remove it from this list.</span><span className="zed-count">{links.length} saved</span></div>{links.length ? links.map(link => <div className="zed-row" key={link.url}><button type="button" disabled={opening !== null} onClick={() => void open(link)} className="flex items-center gap-2 min-w-0 flex-1 text-left"><LetterAvatar title={link.title} compact /><span className="zed-row-text">{link.title}<span className="zed-helper block truncate">{link.url}</span></span></button><button type="button" className="zed-icon-button" disabled={opening !== null} onClick={() => void open(link)} aria-label={`Open ${link.title} in a new tab`}><Icon name="open" size={18} /></button><IconButton label="Copy link" icon="copy" onClick={() => void navigator.clipboard.writeText(link.href).then(() => toast({ title: "Link copied" })).catch(() => toast({ title: "Could not copy link", variant: "destructive" }))} /><IconButton label="Remove link" icon="delete" onClick={() => void setLinks(links.filter(item => item.url !== link.url)).catch(() => toast({ title: "Could not remove link", variant: "destructive" }))} /></div>) : <div className="zed-empty">No saved links yet. Add one above, or use “Save &amp; close tab” in Misc.</div>}</section>
}
