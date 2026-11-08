import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { readBootState } from "@/lib/bootCache"
import { moveMiscSection } from "@/lib/miscSectionOrder"
import { MISC_SECTION_ORDER, type MiscSectionId } from "@/lib/settings"
import { useStoredValue } from "@/lib/useStoredValue"

const NO_EXPANDED_SECTIONS: readonly MiscSectionId[] = []

export function useMiscExpandedSections() {
  const [expandedSections, saveExpandedSections] = useStoredValue<readonly MiscSectionId[]>(
    "miscExpandedSections",
    readBootState().expanded ?? NO_EXPANDED_SECTIONS
  )
  const [everOpened, setEverOpened] = useState<ReadonlySet<MiscSectionId>>(() => new Set())
  const [optimisticOpen, setOptimisticOpen] = useState<ReadonlySet<MiscSectionId>>(() => new Set())
  const expandedSectionsRef = useRef(expandedSections)
  const expandedWritePending = useRef(false)

  useEffect(() => {
    if (
      expandedSections.every((id) => expandedSectionsRef.current.includes(id)) &&
      expandedSectionsRef.current.every((id) => expandedSections.includes(id))
    ) {
      expandedWritePending.current = false
    } else if (!expandedWritePending.current) {
      expandedSectionsRef.current = expandedSections
    }
  }, [expandedSections])

  const setSectionOpen = useCallback(
    (id: MiscSectionId, next: boolean) => {
      setEverOpened((current) => (current.has(id) ? current : new Set([...current, id])))
      setOptimisticOpen((current) => {
        const copy = new Set(current)
        if (next) copy.add(id)
        else copy.delete(id)
        return copy
      })
      const base = expandedSectionsRef.current
      const active = base.includes(id)
      if (active === next) return
      const updated = next ? [...base, id] : base.filter((x) => x !== id)
      expandedSectionsRef.current = updated
      expandedWritePending.current = true
      void saveExpandedSections(updated).catch((error) => {
        expandedWritePending.current = false
        toast({
          title: "Failed to save section state",
          description: String(error),
          variant: "destructive",
        })
      })
    },
    [saveExpandedSections]
  )

  const isSectionOpen = useCallback(
    (id: MiscSectionId) => optimisticOpen.has(id) || expandedSections.includes(id),
    [expandedSections, optimisticOpen]
  )

  const isSectionRendered = useCallback(
    (id: MiscSectionId) => isSectionOpen(id) || everOpened.has(id),
    [everOpened, isSectionOpen]
  )

  return {
    expandedSections,
    setSectionOpen,
    isSectionOpen,
    isSectionRendered,
  }
}

export interface DropTarget {
  id: MiscSectionId
  after: boolean
}

export function useMiscSectionReorder(
  sections: Record<MiscSectionId, { title: string }>
) {
  const [order, saveOrder] = useStoredValue<readonly MiscSectionId[]>(
    "miscSectionOrder",
    readBootState().order ?? MISC_SECTION_ORDER
  )
  const [dragging, setDragging] = useState<MiscSectionId | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const listRef = useRef<HTMLDivElement>(null)
  const pointerDrag = useRef<{
    id: MiscSectionId
    pointerId: number
    x: number
    y: number
    started: boolean
    target: DropTarget | null
  } | null>(null)

  const cancelDrag = useCallback(() => {
    pointerDrag.current = null
    setDragging(null)
    setDropTarget(null)
  }, [])

  const move = useCallback(
    async (from: number, to: number) => {
      if (saving) return
      const next = moveMiscSection(order, from, to)
      if (next === order) return
      const moved = order[from]
      setSaving(true)
      try {
        await saveOrder(next)
        setAnnouncement(
          `Moved ${sections[moved]?.title ?? moved} to position ${to + 1} of ${order.length}`
        )
      } catch (error) {
        toast({
          title: "Failed to reorder sections",
          description: String(error),
          variant: "destructive",
        })
      } finally {
        setSaving(false)
      }
    },
    [order, saving, saveOrder, sections]
  )

  const onPointerDown = useCallback(
    (id: MiscSectionId, event: React.PointerEvent<HTMLButtonElement>) => {
      if (saving || !event.isPrimary || event.button !== 0) return
      event.preventDefault()
      event.currentTarget.focus({ preventScroll: true })
      listRef.current?.setPointerCapture(event.pointerId)
      pointerDrag.current = {
        id,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        started: false,
        target: null,
      }
    },
    [saving]
  )

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointerDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    if (!active.started) {
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6) return
      active.started = true
      setDragging(active.id)
    }
    const elements = document.elementsFromPoint(event.clientX, event.clientY)
    const targetElement = elements
      .map((node) => (node as HTMLElement).closest?.("[data-misc-section-id]"))
      .find((node): node is HTMLElement => Boolean(node))
    if (!targetElement) {
      active.target = null
      setDropTarget(null)
      return
    }
    const targetId = targetElement.dataset.miscSectionId as MiscSectionId | undefined
    if (!targetId || targetId === active.id) {
      active.target = null
      setDropTarget(null)
      return
    }
    const rect = targetElement.getBoundingClientRect()
    const after = event.clientY > rect.top + rect.height / 2
    if (active.target?.id === targetId && active.target.after === after) return
    active.target = { id: targetId, after }
    setDropTarget(active.target)
  }, [])

  const cancelPointerDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointerDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    if (listRef.current?.hasPointerCapture(event.pointerId)) {
      listRef.current.releasePointerCapture(event.pointerId)
    }
    cancelDrag()
  }, [cancelDrag])

  const endPointerDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const active = pointerDrag.current
      if (!active || active.pointerId !== event.pointerId) return
      if (listRef.current?.hasPointerCapture(event.pointerId)) {
        listRef.current.releasePointerCapture(event.pointerId)
      }
      const target = active.target
      cancelDrag()
      if (!active.started || !target || target.id === active.id) return
      const from = order.indexOf(active.id)
      const rawTo = order.indexOf(target.id)
      if (from < 0 || rawTo < 0) return
      const to = target.after
        ? from < rawTo
          ? rawTo
          : rawTo + 1
        : from < rawTo
        ? Math.max(0, rawTo - 1)
        : rawTo
      if (from === to) return
      void move(from, to)
    },
    [cancelDrag, move, order]
  )

  return {
    order,
    saving,
    dragging,
    dropTarget,
    announcement,
    listRef,
    move,
    cancelDrag,
    onPointerDown,
    onPointerMove,
    cancelPointerDrag,
    endPointerDrag,
  }
}
