import type { ReactNode } from "react"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

export type MiscSectionProps = {
  dragHandle?: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function MiscSection({ title, id, children, dragHandle, open, onOpenChange }: MiscSectionProps & { title: string; id: string; children: ReactNode }) {
  return (
    <div className="relative">
      {dragHandle && <div className="absolute left-1.5 top-1.5 z-10">{dragHandle}</div>}
      <details
        open={open}
        onToggle={(event) => onOpenChange(event.currentTarget.open)}
        className={cn(popupPanel, "group")}
        aria-labelledby={id}
      >
        <summary className={cn("-m-3 flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-none py-3 pr-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden", dragHandle ? "pl-12" : "pl-3")}>
          <h2 id={id} className={cn(popupSectionTitle, "flex-1")}>{title}</h2>
          <ChevronDownIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-180" />
        </summary>
        <div className={cn(popupSectionInner, "pt-5")}>{children}</div>
      </details>
    </div>
  )
}
