import { ChoiceGroup } from "@/design-system/components"
import { toast } from "@/components/ui/use-toast"
import { DEFAULT_HINT_MODE, HINT_MODES, type HintMode } from "@/lib/clickHints"
import { useStoredValue } from "@/lib/useStoredValue"

export default function KeyboardHintsSection() {
  const [hintMode, setHintMode] = useStoredValue<HintMode>("hintMode", DEFAULT_HINT_MODE)
  return (
    <section className="zed-stack">
      <ChoiceGroup
        label="Keyboard hints"
        value={hintMode}
        options={HINT_MODES}
        onChange={(mode) =>
          void setHintMode(mode).catch((error) =>
            toast({
              title: "Could not save keyboard hints",
              description: String(error),
              variant: "destructive",
            })
          )
        }
      />
    </section>
  )
}
