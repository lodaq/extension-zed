import { useStoredValue } from "@/lib/useStoredValue"
import { COLLECTIONS_KEY, readCollections, SAVED_KEY, SAVED_BUTTONS_KEY, readSaved, type SavedItem } from "@/lib/saved"
import { Button } from "./ui/button"
import { SwitchRow } from "@/design-system/components"
import { useState } from "react"

const EMPTY_COLLECTIONS: string[] = []
const EMPTY: SavedItem[] = []
export default function SavedTab() {
  const [stored] = useStoredValue<SavedItem[]>(SAVED_KEY, EMPTY)
  const [storedCollections] = useStoredValue<string[]>(COLLECTIONS_KEY, EMPTY_COLLECTIONS)
  const collections = readCollections(storedCollections)
  const [collection, setCollection] = useState("")
  const [rename, setRename] = useState("")
  const [name, setName] = useState("")
  const items = readSaved(stored).filter(item => !collection || item.collection === collection)
  async function request(data: object) {
    try {
      const result = await chrome.runtime.sendMessage(data)
      if (!result?.ok) throw new Error(result?.error || "Could not update collection")
      setError("")
      return true
    } catch (error) { setError(String(error)); return false }
  }
  const [buttonsEnabled, setButtonsEnabled] = useStoredValue(SAVED_BUTTONS_KEY, true)
  const [error, setError] = useState("")
  return <section className="zed-stack zed-root zed-saved" aria-label="Saved items">
    <h2 className="zed-title">Saved</h2>
    <p className="zed-helper">Save posts, videos and reels with the page’s Save to Zed button. Right-click selected text to save it here. Stored on this device.</p>
    <SwitchRow label="Show Save to Zed buttons" description="Show save/remove controls on posts, reels and videos." checked={buttonsEnabled} onChange={checked => {
      void setButtonsEnabled(checked).catch(error => setError(String(error)))
    }} />
    <label className="zed-stack">Collections
      <select className="zed-input" value={collection} onChange={event => { setCollection(event.target.value); setRename(event.target.value) }}>
        <option value="">All saved</option>
        {collections.map(name => <option key={name}>{name}</option>)}
      </select>
    </label>
    {collection && <form className="zed-stack" onSubmit={async event => {
      event.preventDefault()
      if (await request({ type: "saved:rename", collection, name: rename })) setCollection(rename.trim())
    }}>
      <label className="zed-stack">Collection name (required)
        <input className="zed-input" required maxLength={80} value={rename} onChange={event => setRename(event.target.value)} />
      </label>
      <div className="flex gap-2">
        <Button type="submit">Rename</Button>
        <Button type="button" variant="ghost" onClick={async () => {
          if (await request({ type: "saved:delete-collection", collection })) { setCollection(""); setRename("") }
        }}>Delete collection</Button>
      </div>
      <p className="zed-helper">Deleting this collection keeps its items in All saved.</p>
    </form>}
    <form className="flex gap-2" onSubmit={async event => {
      event.preventDefault()
      if (await request({ type: "saved:collection", collection: name })) setName("")
    }}>
      <label className="zed-stack">New collection name (required)<input className="zed-input" placeholder="New collection" maxLength={80} required value={name} onChange={event => setName(event.target.value)} /></label>
      <Button type="submit">Create</Button>
    </form>
    {error && <p role="alert" className="zed-saved-error">{error}</p>}
    {!items.length && <p className="zed-helper">No saved items yet.</p>}
    {items.map(item => <article key={item.id} className="zed-card zed-saved-item">
      <p className="select-text whitespace-pre-wrap break-words">{item.text}</p>
      <label className="zed-stack">Move to collection
        <select className="zed-input" value={item.collection || ""} onChange={event => void request({ type: "saved:move", id: item.id, collection: event.target.value })}>
          <option value="">All saved</option>
          {collections.map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a className="zed-saved-link truncate underline" href={item.url} target="_blank" rel="noopener noreferrer">{item.kind === "text" ? "Open source" : "Open saved link"}</a>
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
