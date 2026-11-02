import MiscSection from "@/components/MiscSection"
import { popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import { Suspense, lazy, useEffect, useId, useRef, useState, type ComponentType } from "react"
import { DragHandleDots2Icon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useStoredValue } from "@/lib/useStoredValue"
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
const ChangeColors = lazy(() => import("@/components/ChangeColors"))
const ScrollbarsSection = lazy(() => import("@/components/ScrollbarsSection"))
const ModesSection = lazy(() => import("@/components/ModesSection"))

const sections: Record<MiscSectionId, { title: string; Component: ComponentType<SectionProps> }> = {
  password: { title: "Password generator", Component: PasswordGenerator },
  playback: { title: "Playback speed", Component: ChangePlaybackRate },
  volume: { title: "Volume boost", Component: VolumeBooster },
  colors: { title: "Page colors", Component: ChangeColors },
  scrollbars: { title: "Scrollbars", Component: ScrollbarsSection },
  modes: { title: "Modes", Component: ModesSection },
}
const NO_EXPANDED_SECTIONS: readonly MiscSectionId[] = []

export default function MiscTab() {
  const [order, saveOrder] = useStoredValue<readonly MiscSectionId[]>("miscSectionOrder", MISC_SECTION_ORDER)
  const [expandedSections, saveExpandedSections] = useStoredValue<readonly MiscSectionId[]>("miscExpandedSections", NO_EXPANDED_SECTIONS)
  const [dragging, setDragging] = useState<MiscSectionId | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: MiscSectionId; after: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [everOpened, setEverOpened] = useState<ReadonlySet<MiscSectionId>>(() => new Set())
  const [optimisticOpen, setOptimisticOpen] = useState<ReadonlySet<MiscSectionId>>(() => new Set())
  const instructionsId = useId()
  const pointerDrag = useRef<{ id: MiscSectionId; pointerId: number; x: number; y: number; target: { id: MiscSectionId; after: boolean } | null } | null>(null)
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
      setAnnouncement(`Moved ${sections[moved].title} to position ${to + 1} of ${order.length}`)
    } catch (error) {
      toast({ title: "Failed to reorder sections", description: String(error), variant: "destructive" })
    } finally { setSaving(false) }
  }

  return (
    <div
      data-misc-list
      className={cn(popupSectionStack, "px-0.5 pb-1 pt-3")}
      onPointerMove={(event) => {
        const drag = pointerDrag.current
        if (!drag || drag.pointerId !== event.pointerId) return
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 4) {
          drag.target = null
          setDropTarget(null)
          return
        }
        const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-misc-section]")
        const targetId = order.find(section => section === row?.dataset.miscSection)
        const list = event.currentTarget.closest("[data-misc-list]")
        if (!row || !targetId || !list?.contains(row)) {
          drag.target = null
          setDropTarget(null)
          return
        }
        const bounds = row.getBoundingClientRect()
        drag.target = { id: targetId, after: event.clientY > bounds.top + bounds.height / 2 }
        setDragging(drag.id)
        setDropTarget(drag.target)
      }}
      onPointerUp={(event) => {
        const drag = pointerDrag.current
        if (!drag || drag.pointerId !== event.pointerId) return
        cancelDrag()
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (!drag?.target) return
        const source = order.indexOf(drag.id)
        const insertion = order.indexOf(drag.target.id) + (drag.target.after ? 1 : 0)
        void move(source, insertion - (source < insertion ? 1 : 0))
      }}
      onPointerCancel={cancelDrag}
      onLostPointerCapture={cancelDrag}
    >
      <p id={instructionsId} className="sr-only">Drag to reorder sections, or focus a handle and use the Up and Down arrow keys.</p>
      <p role="status" className="sr-only">{announcement}</p>
      {order.map((id, index) => {
        const { title, Component } = sections[id]
        const open = expandedSections.includes(id) || optimisticOpen.has(id)
        const mounted = open || everOpened.has(id)
        const dragHandle = (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 touch-none select-none cursor-grab text-muted-foreground active:cursor-grabbing"
            aria-label={`Reorder ${title}`}
            aria-describedby={instructionsId}
            aria-disabled={saving}
            title={`Drag to reorder ${title}; arrow keys move up or down`}
            draggable={false}
            onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              if (saving || !event.isPrimary || event.button !== 0) return
              event.preventDefault()
              event.currentTarget.focus({ preventScroll: true })
              event.currentTarget.closest<HTMLElement>("[data-misc-list]")?.setPointerCapture(event.pointerId)
              pointerDrag.current = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, target: null }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                cancelDrag()
                return
              }
              if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
              event.preventDefault()
              const handle = event.currentTarget
              void move(index, index + (event.key === "ArrowUp" ? -1 : 1)).then(() => requestAnimationFrame(() => handle.focus()))
            }}
          >
            <DragHandleDots2Icon aria-hidden="true" className="h-4 w-4" />
          </Button>
        )
        return (
          <div
            key={id}
            data-misc-section={id}
            className={cn("relative", dragging === id && "opacity-50")}
          >
            {dropTarget?.id === id && dragging !== id && <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary", dropTarget.after ? "-bottom-1.5" : "-top-1.5")} />}
            {mounted ? (
              <Suspense fallback={
                <MiscSection
                  title={title}
                  id={`zed-${id}-heading`}
                  open={open}
                  onOpenChange={(next) => setSectionOpen(id, next)}
                  dragHandle={dragHandle}
                >{null}</MiscSection>
              }>
                <Component
                  open={open}
                  onOpenChange={(next) => setSectionOpen(id, next)}
                  dragHandle={dragHandle}
                />
              </Suspense>
            ) : (
              <MiscSection
                title={title}
                id={`zed-${id}-heading`}
                open={false}
                onOpenChange={(next) => setSectionOpen(id, next)}
                dragHandle={dragHandle}
              >{null}</MiscSection>
            )}
          </div>
        )
      })}
    </div>
  )
}
