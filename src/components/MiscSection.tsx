import type { ReactNode } from "react"
export type MiscSectionProps = { dragHandle?: ReactNode; open:boolean; onOpenChange:(open:boolean)=>void }
export default function MiscSection({children}:MiscSectionProps & {title:string;id:string;children:ReactNode}) {return <section className="zed-stack">{children}</section>}
