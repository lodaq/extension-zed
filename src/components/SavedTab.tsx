import { useStoredValue } from "@/lib/useStoredValue"
import { SAVED_KEY, readSaved, type SavedItem } from "@/lib/saved"
import { Button } from "./ui/button"
import { useState } from "react"

const EMPTY: SavedItem[] = []
export default function SavedTab() {
  const [stored] = useStoredValue<SavedItem[]>(SAVED_KEY, EMPTY)
  const items = readSaved(stored)
  const [error, setError] = useState("")
  return <section className="zed-stack zed-root zed-saved" aria-label="Saved items">
    <h2 className="zed-title">Saved</h2>
    <p className="zed-helper">Save videos and reels with the page’s Save to Zed button. Right-click selected text to save it here. Stored on this device.</p>
    {error && <p role="alert" className="zed-saved-error">{error}</p>}
    {!items.length && <p className="zed-helper">No saved items yet.</p>}
    {items.map(item => <article key={item.id} className="zed-card zed-saved-item">
      <p className="select-text whitespace-pre-wrap break-words">{item.text}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a className="zed-saved-link truncate underline" href={item.url} target="_blank" rel="noopener noreferrer">{item.kind === "text" ? "Open source" : "Open video"}</a>
        <Button size="sm" variant="ghost" onClick={async () => {
          try {
            const result = await chrome.runtime.sendMessage({ type: "saved:remove", id: item.id })
            if (!result?.ok) throw new Error(result?.error || "Could not remove item")
            setError("")
          } catch (error) { setError(String(error)) }
        }}>Remove</Button>
      </div>
    </article>)}
  </section>
}
