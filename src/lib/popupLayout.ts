/** Vertical rhythm between major blocks (sections) in popup tabs */
export const popupSectionStack = "flex flex-col gap-3"

/** Bordered panel wrapping a labeled group of controls */
export const popupPanel = "rounded-lg border border-border/80 bg-card p-3"

/** Small caps section heading inside a panel */
/** Section headings are intentionally larger than their 14px form labels. */
export const popupSectionTitle = "text-base font-semibold leading-5 text-foreground"

/** Default stack inside a panel (title → body) */
export const popupSectionInner = "flex flex-col gap-2.5"

/** Wrapped rows of buttons or inputs */
export const popupControlRow = "flex flex-wrap items-center gap-2"

/** Subheading for a subsection (e.g. scrollbar row) */
export const popupSubhead = "text-sm font-medium leading-none text-foreground"

/** Short helper under a subhead */
export const popupDescription = "text-xs leading-relaxed text-muted-foreground"
