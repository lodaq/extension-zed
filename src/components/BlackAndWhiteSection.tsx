import { SwitchRow } from "@/design-system/components"
import { toast } from "@/components/ui/use-toast"
import { useStoredValue } from "@/lib/useStoredValue"

export default function BlackAndWhiteSection() {
  const [blackAndWhite, setBlackAndWhite] = useStoredValue<boolean>("blackAndWhite", false)
  return (
    <section className="zed-stack">
      <SwitchRow
        label="Black and white"
        description="Show all websites in grayscale."
        checked={blackAndWhite}
        onChange={(enabled) =>
          void setBlackAndWhite(enabled).catch((error) =>
            toast({ title: String(error), variant: "destructive" })
          )
        }
      />
    </section>
  )
}
