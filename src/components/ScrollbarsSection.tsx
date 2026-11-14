import { useEffect, useState } from "react"
import MiscSection, { type MiscSectionProps } from "./MiscSection"
import { Button } from "./ui/button"
import { Card, StatusPill } from "@/design-system/components"
import { sendPageAction } from "@/lib/withActiveTab"
import type { PageAction } from "@/lib/actionRegistry"
const cards: { title: string; description: string; apply: PageAction; reset: PageAction; label: string; styleId: string }[] = [
  { title: "Custom style", description: "Sleek, unobtrusive modern scrollbars without layout shifting.", apply: "applyCustomScrollbar", reset: "resetCustomScrollbar", label: "Apply", styleId: "zed-custom-scrollbar" },
  { title: "Main scrollbar", description: "Only the document / viewport scrollbar.", apply: "hideMainScrollBar", reset: "resetMainScrollBar", label: "Hide", styleId: "zed-hide-main-scrollbar" },
  { title: "All scrollbars", description: "Every scrollable region, including nested areas.", apply: "hideAllScrollBars", reset: "resetAllScrollBars", label: "Hide", styleId: "zed-hide-all-scrollbars" },
]
export default function ScrollbarsSection(props: MiscSectionProps) {
  const [active, setActive] = useState<boolean[]>([false, false, false])
  const [busy, setBusy] = useState(false)
  async function refresh() { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (tab?.id === undefined) return; const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (ids: string[]) => ids.map(id => !!document.getElementById(id)), args: [cards.map(c => c.styleId)] }); if (result[0]?.result) setActive(result[0].result) }
  useEffect(() => { void Promise.resolve().then(refresh).catch(() => { }) }, [])
  return <MiscSection {...props} title="Scrollbars" id="scrollbars">{cards.map((card, i) => <Card key={card.title} active={active[i]}><div className="flex items-center gap-3"><div className="flex-1"><div className="flex items-center gap-2"><strong>{card.title}</strong><StatusPill active={active[i]} /></div><p className="zed-helper">{card.description}</p></div><Button size="sm" disabled={busy} onClick={() => { setBusy(true); void sendPageAction(active[i] ? card.reset : card.apply).then(() => refresh()).catch(() => { }).finally(() => setBusy(false)) }}>{active[i] ? "Restore" : card.label}</Button></div></Card>)}<p className="zed-helper">Changes apply to the current tab.</p></MiscSection>
}
