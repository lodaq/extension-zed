import { useStoredValue } from "@/lib/useStoredValue"
import { COLLECTIONS_KEY, SAVED_KEY, SAVED_BUTTONS_KEY, type SavedItem } from "@/lib/saved"
import { Button } from "./ui/button"
import { Icon } from "@/design-system/Icon"
import { LetterAvatar } from "@/design-system/components"
import { SwitchRow } from "@/design-system/components"
import { Activity, memo, useMemo, useState } from "react"

const EMPTY_COLLECTIONS: string[] = []
const EMPTY: SavedItem[] = []
const INITIAL_ROWS = 16
export default function SavedTab({ visible }: { visible: boolean }) {
  const [stored] = useStoredValue<SavedItem[]>(SAVED_KEY, EMPTY)
  const [storedCollections] = useStoredValue<string[]>(COLLECTIONS_KEY, EMPTY_COLLECTIONS)
  return <Activity mode={visible ? "visible" : "hidden"}>
    <LibraryItems allItems={stored} collections={storedCollections} />
  </Activity>
}

const LibraryItems = memo(function LibraryItems({ allItems, collections }: { allItems: SavedItem[]; collections: string[] }) {
  const [renderAll, setRenderAll] = useState(false)
  const [collection, setCollection] = useState("")
  const [rename, setRename] = useState("")
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [openPickers, setOpenPickers] = useState<ReadonlySet<string>>(() => new Set())
  const items = useMemo(() => collection ? allItems.filter(item => item.collection === collection) : allItems, [allItems, collection])
  const visibleItems = renderAll ? items : items.slice(0, INITIAL_ROWS)
  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of allItems) {
      if (item.collection) counts.set(item.collection, (counts.get(item.collection) ?? 0) + 1)
    }
    return counts
  }, [allItems])
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
  return <section className="zed-stack zed-root zed-saved" aria-label="Library items">
    <div className="zed-saved-heading"><h2 className="zed-title">Library</h2><span className="zed-helper">{allItems.length} {allItems.length === 1 ? "item" : "items"}</span></div>
    <p className="zed-helper">Save posts, videos and reels with the page’s Save to Zed button. Right-click selected text to save it here. Stored on this device.</p>
    <SwitchRow label="Show Save to Zed buttons" description="Show save/remove controls on posts, reels and videos." checked={buttonsEnabled} onChange={checked => {
      void setButtonsEnabled(checked).catch(error => setError(String(error)))
    }} />
    <div className="zed-collection-bar" role="group" aria-label="Collections">
      {["", ...collections].map(value => <Button key={value} variant={collection === value ? "default" : "outline"} aria-pressed={collection === value} onClick={() => { setCollection(value); setRename(value) }}>
        {value || "All items"}<span>{value ? (collectionCounts.get(value) ?? 0) : allItems.length}</span>
      </Button>)}
      <Button variant="ghost" className="zed-new-collection" aria-expanded={creating} onClick={() => setCreating(!creating)}><Icon name="plus" size={16} />New</Button>
    </div>
    {collection && <details className="zed-collection-manage"><summary>Manage collection</summary><form className="zed-stack" onSubmit={async event => {
      event.preventDefault()
      if (await request({ type: "saved:rename", collection, name: rename })) setCollection(rename.trim())
    }}>
      <label className="zed-stack">Collection name (required)
        <input className="zed-input" required maxLength={80} value={rename} onChange={event => setRename(event.target.value)} />
      </label>
      <div className="zed-actions">
        <Button type="submit">Rename</Button>
        <Button type="button" variant="ghost" onClick={async () => {
          if (await request({ type: "saved:delete-collection", collection })) { setCollection(""); setRename("") }
        }}>Delete collection</Button>
      </div>
      <p className="zed-helper">Deleting this collection keeps its items in All items.</p>
    </form></details>}
    {creating && <form className="zed-actions" onSubmit={async event => {
      event.preventDefault()
      if (await request({ type: "saved:collection", collection: name })) { setName(""); setCreating(false) }
    }}>
      <label className="zed-stack">New collection name (required)<input className="zed-input" placeholder="New collection" maxLength={80} required value={name} onChange={event => setName(event.target.value)} /></label>
      <Button type="submit">Create</Button>
    </form>}
    {error && <p role="alert" className="zed-saved-error">{error}</p>}
    {!items.length && <p className="zed-helper">No saved items yet.</p>}
    {visibleItems.map(item => {
      let url: URL
      try { url = new URL(item.url) } catch { return null }
      const title = item.kind === "text" ? item.text : url.hostname.replace(/^www\./, "")
      return <article key={item.id} className="zed-card zed-saved-row">
        {item.kind === "text" ? <span className="zed-well"><Icon name="full" /></span> : <LetterAvatar title={title} />}
        <div className="zed-saved-copy"><strong dir="auto">{title}</strong><p className="zed-helper">{item.kind === "text" ? "Selected text" : url.pathname.replace(/^\//, "") + url.search}</p></div>
        {item.collection && <span className="zed-pill zed-saved-tag">{item.collection}</span>}
        <a className="zed-icon-button" aria-label={item.kind === "text" ? "Open source" : "Open saved link"} href={item.url} target="_blank" rel="noopener noreferrer"><Icon name="open" size={18} /></a>
        <details className="zed-collection-picker" onToggle={event => {
          const open = event.currentTarget.open
          setOpenPickers(current => {
            if (current.has(item.id) === open) return current
            const next = new Set(current)
            if (open) next.add(item.id)
            else next.delete(item.id)
            return next
          })
        }} onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.removeAttribute("open")
            event.currentTarget.querySelector("summary")?.focus()
          }
        }}>
          <summary className="zed-icon-button" aria-label="Move to collection"><Icon name="folder" size={18} /></summary>
          {openPickers.has(item.id) && <div className="zed-collection-menu">
            <p className="zed-helper">Move to collection</p>
            {["", ...collections].map(value => <Button key={value} variant="ghost" aria-pressed={(item.collection || "") === value} onClick={async event => {
              const details = event.currentTarget.closest("details")
              if (await request({ type: "saved:move", id: item.id, collection: value })) { details?.removeAttribute("open"); details?.querySelector("summary")?.focus() }
            }}>{value || "No collection"}{(item.collection || "") === value && <Icon name="check" size={16} />}</Button>)}
            <Button variant="ghost" onClick={() => setCreating(true)}><Icon name="plus" size={16} />New collection…</Button>
          </div>}
        </details>
        <Button size="icon" variant="ghost" aria-label="Remove saved item" onClick={() => void request({ type: "saved:remove", id: item.id })}><Icon name="delete" size={18} /></Button>
      </article>
    })}
    {items.length > visibleItems.length && <div className="zed-actions"><Button variant="ghost" onClick={() => setRenderAll(true)}>Show more ({items.length - visibleItems.length})</Button></div>}
  </section>
})
