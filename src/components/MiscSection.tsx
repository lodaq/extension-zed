import type { ReactNode } from "react"
import { ChevronDownIcon } from "@radix-ui/react-icons"
import { popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"

export default function MiscSection({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <details open className={cn(popupPanel, "group")} aria-labelledby={id}>
      <summary className="-m-3 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-3 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h2 id={id} className={popupSectionTitle}>{title}</h2>
        <ChevronDownIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-open:rotate-180" />
      </summary>
      <div className={cn(popupSectionInner, "pt-5")}>{children}</div>
    </details>
  )
}
