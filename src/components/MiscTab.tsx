import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { lazy, useEffect, useId, useRef, useState, type ComponentType } from "react"
import { DragHandleDots2Icon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useStoredValue } from "@/lib/useStoredValue"
import { readBootState } from "@/lib/bootCache"
import { MISC_SECTION_ORDER, type MiscSectionId } from "@/lib/settings"
import { moveMiscSection } from "@/lib/miscSectionOrder"

type SectionProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dragHandle?: React.ReactNode
}

const PasswordGenerator = lazy(() => import("@/components/PasswordGenerator"))
const ChangePlaybackRate = lazy(() => import("@/components/ChangePlaybackRate"))
const VolumeBooster = lazy(() => import("@/components/VolumeBooster"))
const VideoQualitySection = lazy(() => import("@/components/VideoQualitySection"))
const ChangeColors = lazy(() => import("@/components/ChangeColors"))
const ScrollbarsSection = lazy(() => import("@/components/ScrollbarsSection"))
const ModesSection = lazy(() => import("@/components/ModesSection"))

const sections: Record<MiscSectionId, { title: string; Component: ComponentType<SectionProps> }> = {
  password: { title: "Password generator", Component: PasswordGenerator },
  playback: { title: "Playback speed", Component: ChangePlaybackRate },
  volume: { title: "Volume boost", Component: VolumeBooster },
  quality: { title: "Video quality", Component: VideoQualitySection },
  colors: { title: "Page colors", Component: ChangeColors },
  scrollbars: { title: "Scrollbars", Component: ScrollbarsSection },
  modes: { title: "Modes", Component: ModesSection },
}
const NO_EXPANDED_SECTIONS: readonly MiscSectionId[] = []

export default function MiscTab() {
  const [order, saveOrder] = useStoredValue<readonly MiscSectionId[]>(
    "miscSectionOrder",
    readBootState().order ?? MISC_SECTION_ORDER
  )
  const [expandedSections, saveExpandedSections] = useStoredValue<readonly MiscSectionId[]>(
    "miscExpandedSections",
    readBootState().expanded ?? NO_EXPANDED_SECTIONS
  )
  const [dragging, setDragging] = useState<MiscSectionId | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: MiscSectionId; after: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [everOpened, setEverOpened] = useState<ReadonlySet<MiscSectionId>>(() => new Set())
  const [optimisticOpen, setOptimisticOpen] = useState<ReadonlySet<MiscSectionId>>(() => new Set())
  const instructionsId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const pointerDrag = useRef<{
    id: MiscSectionId
    pointerId: number
    x: number
    y: number
    started: boolean
    target: { id: MiscSectionId; after: boolean } | null
  } | null>(null)
  const expandedSectionsRef = useRef(expandedSections)
  const expandedWritePending = useRef(false)

  useEffect(() => {
    if (expandedSections.every(id => expandedSectionsRef.current.includes(id)) &&
      expandedSectionsRef.current.every(id => expandedSections.includes(id))) {
      expandedWritePending.current = false
    } else if (!expandedWritePending.current) {
      expandedSectionsRef.current = expandedSections
    }
  }, [expandedSections])

  const setSectionOpen = (id: MiscSectionId, next: boolean) => {
    setEverOpened(current => current.has(id) ? current : new Set([...current, id]))
    setOptimisticOpen(current => {
      const copy = new Set(current)
      if (next) copy.add(id); else copy.delete(id)
      return copy
    })
    const base = expandedSectionsRef.current
    const active = base.includes(id)
    if (active === next) return
    const updated = next ? [...base, id] : base.filter(x => x !== id)
    expandedSectionsRef.current = updated
    expandedWritePending.current = true
    void saveExpandedSections(updated).catch(error => {
      expandedWritePending.current = false
      toast({ title: "Failed to save section state", description: String(error), variant: "destructive" })
    })
  }

  const cancelDrag = () => {
    pointerDrag.current = null
    setDragging(null)
    setDropTarget(null)
  }

  const move = async (from: number, to: number) => {
    if (saving) return
    const next = moveMiscSection(order, from, to)
    if (next === order) return
    const moved = order[from]
    setSaving(true)
    try {
      await saveOrder(next)
      setAnnouncement(`Moved ${sections[moved]?.title ?? moved} to position ${to + 1} of ${order.length}`)
    } catch (error) {
      toast({ title: "Failed to reorder sections", description: String(error), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const onPointerDown = (id: MiscSectionId, event: React.PointerEvent<HTMLButtonElement>) => {
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
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointerDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    if (!active.started) {
      if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 6) return
      active.started = true
      setDragging(active.id)
    }
    const elements = document.elementsFromPoint(event.clientX, event.clientY)
    const targetElement = elements.map(node => (node as HTMLElement).closest?.("[data-misc-section-id]"))
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
    active.target = { id: targetId, after }
    setDropTarget(active.target)
  }

  const cancelPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const active = pointerDrag.current
    if (!active || active.pointerId !== event.pointerId) return
    if (listRef.current?.hasPointerCapture(event.pointerId)) {
      listRef.current.releasePointerCapture(event.pointerId)
    }
    cancelDrag()
  }

  const endPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
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
    const to = target.after ? (from < rawTo ? rawTo : rawTo + 1) : from < rawTo ? Math.max(0, rawTo - 1) : rawTo
    if (from === to) return
    void move(from, to)
  }

  return (
    <div className={cn(popupSectionStack, "relative pb-2")}>
      <p id={instructionsId} className="sr-only">
        Use up and down arrow keys to reorder sections. Changes save immediately.
      </p>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div
        ref={listRef}
        data-misc-list
        className="space-y-1.5"
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={cancelPointerDrag}
        onLostPointerCapture={() => cancelDrag()}
      >
        {order.map((id, index) => {
          const item = sections[id]
          if (!item) return null
          const isOptimistic = optimisticOpen.has(id)
          const isOpen = isOptimistic || expandedSections.includes(id)
          const isRendered = isOpen || everOpened.has(id)
          const isDrop = dropTarget?.id === id
          const isDragged = dragging === id
          const { Component } = item

          return (
            <div
              key={id}
              data-misc-section-id={id}
              className={cn(
                "relative rounded-md transition-shadow",
                isDragged && "opacity-40",
                isDrop && !dropTarget?.after && "border-t-2 border-primary",
                isDrop && dropTarget?.after && "border-b-2 border-primary"
              )}
            >
              <Component
                open={isOpen}
                onOpenChange={(next) => setSectionOpen(id, next)}
                dragHandle={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 touch-none select-none cursor-grab text-muted-foreground active:cursor-grabbing"
                    aria-label={`Reorder ${item.title}`}
                    aria-describedby={instructionsId}
                    aria-disabled={saving}
                    title={`Drag to reorder ${item.title}; use the arrow keys to move`}
                    draggable={false}
                    onClick={(event) => event.preventDefault()}
                    onDragStart={(event) => event.preventDefault()}
                    onPointerDown={(event) => onPointerDown(id, event)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        cancelDrag()
                        return
                      }
                      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
                      event.preventDefault()
                      const handle = event.currentTarget
                      void move(index, index + (event.key === "ArrowUp" ? -1 : 1))
                        .then(() => requestAnimationFrame(() => handle.focus()))
                    }}
                  >
                    <DragHandleDots2Icon aria-hidden="true" className="h-4 w-4" />
                  </Button>
                }
              />
              {!isRendered && null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
