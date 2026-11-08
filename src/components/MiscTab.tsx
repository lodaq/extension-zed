import { useId, type ComponentType } from "react"
import { DragHandleDots2Icon } from "@radix-ui/react-icons"
import ChangePlaybackRate from "@/components/ChangePlaybackRate"
import MiscSection from "@/components/MiscSection"
import ModesSection from "@/components/ModesSection"
import PasswordGenerator from "@/components/PasswordGenerator"
import ScrollbarsSection from "@/components/ScrollbarsSection"
import VideoQualitySection from "@/components/VideoQualitySection"
import VolumeBooster from "@/components/VolumeBooster"
import { Button } from "@/components/ui/button"
import { popupSectionStack } from "@/lib/popupLayout"
import type { MiscSectionId } from "@/lib/settings"
import {
  useMiscExpandedSections,
  useMiscSectionReorder,
} from "@/lib/useMiscTabState"
import { cn } from "@/lib/utils"

type SectionProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dragHandle?: React.ReactNode
}

const sections: Record<MiscSectionId, { title: string; Component: ComponentType<SectionProps> }> = {
  password: { title: "Password generator", Component: PasswordGenerator },
  playback: { title: "Playback speed", Component: ChangePlaybackRate },
  volume: { title: "Volume boost", Component: VolumeBooster },
  quality: { title: "Video quality", Component: VideoQualitySection },
  scrollbars: { title: "Scrollbars", Component: ScrollbarsSection },
  modes: { title: "Modes", Component: ModesSection },
}

interface DragHandleProps {
  title: string
  index: number
  saving: boolean
  instructionsId: string
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void
  onMove: (from: number, to: number) => Promise<void>
  onCancelDrag: () => void
}

function MiscSectionDragHandle({
  title,
  index,
  saving,
  instructionsId,
  onPointerDown,
  onMove,
  onCancelDrag,
}: DragHandleProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 touch-none select-none cursor-grab text-muted-foreground active:cursor-grabbing"
      aria-label={`Reorder ${title}`}
      aria-describedby={instructionsId}
      aria-disabled={saving}
      title={`Drag to reorder ${title}; use the arrow keys to move`}
      draggable={false}
      onClick={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancelDrag()
          return
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
        event.preventDefault()
        const handle = event.currentTarget
        void onMove(index, index + (event.key === "ArrowUp" ? -1 : 1)).then(() =>
          requestAnimationFrame(() => handle.focus())
        )
      }}
    >
      <DragHandleDots2Icon aria-hidden="true" className="h-4 w-4" />
    </Button>
  )
}

export default function MiscTab() {
  const instructionsId = useId()
  const { isSectionOpen, isSectionRendered, setSectionOpen } = useMiscExpandedSections()
  const {
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
  } = useMiscSectionReorder(sections)

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

          const isOpen = isSectionOpen(id)
          const isRendered = isSectionRendered(id)
          const isDrop = dropTarget?.id === id
          const isDragged = dragging === id
          const { Component } = item

          const dragHandle = (
            <MiscSectionDragHandle
              title={item.title}
              index={index}
              saving={saving}
              instructionsId={instructionsId}
              onPointerDown={(event) => onPointerDown(id, event)}
              onMove={move}
              onCancelDrag={cancelDrag}
            />
          )

          const placeholder = (
            <MiscSection
              title={item.title}
              id={`zed-${id}-heading`}
              open={isOpen}
              onOpenChange={(next) => setSectionOpen(id, next)}
              dragHandle={dragHandle}
            >
              {null}
            </MiscSection>
          )

          return (
            <div
              key={id}
              data-misc-section-id={id}
              className={cn(
                "relative rounded-md",
                isDragged && "opacity-40",
                isDrop && !dropTarget?.after && "border-t-2 border-primary",
                isDrop && dropTarget?.after && "border-b-2 border-primary"
              )}
            >
              {isRendered ? (
                <Component
                  open={isOpen}
                  onOpenChange={(next) => setSectionOpen(id, next)}
                  dragHandle={dragHandle}
                />
              ) : (
                placeholder
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
