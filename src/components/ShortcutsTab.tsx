import { useEffect, useState } from "react"

const ShortcutsTab = () => {
  const [cmds, setCmds] = useState<chrome.commands.Command[]>([])

  useEffect(() => {
    chrome.commands.getAll((list) => {
      const ours = list.filter(
        (c) => c.name === "_execute_action" || (c.name && c.name.startsWith("zed_"))
      )
      ours.sort((a, b) => {
        if (a.name === "_execute_action") return -1
        if (b.name === "_execute_action") return 1
        return (a.description || a.name || "").localeCompare(b.description || b.name || "")
      })
      setCmds(ours)
    })
  }, [])

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border text-sm shadow-sm">
      {cmds.map((c) => (
        <li
          key={c.name}
          className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <span className="min-w-0 text-foreground">{c.description || c.name}</span>
          <kbd className="shrink-0 whitespace-nowrap rounded border border-border bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
            {c.shortcut?.replace(/\+/g, " + ") || "Not set"}
          </kbd>
        </li>
      ))}
    </ul>
  )
}

export default ShortcutsTab
