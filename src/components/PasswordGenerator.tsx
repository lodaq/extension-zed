import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import { useState } from "react"
import { ReloadIcon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { popupDescription } from "@/lib/popupLayout"
import { generatePassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type PasswordOptions } from "@/lib/passwordGenerator"

const DEFAULT_OPTIONS: PasswordOptions = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true }
const CHARACTER_OPTIONS = [
  ["uppercase", "Uppercase", "A–Z"],
  ["lowercase", "Lowercase", "a–z"],
  ["numbers", "Numbers", "0–9"],
  ["symbols", "Symbols", "!@#"],
] as const

function generate(options: PasswordOptions) {
  try {
    return { options, password: generatePassword(options), error: "" }
  } catch (error) {
    return { options, password: "", error: error instanceof Error ? error.message : "Password generation failed" }
  }
}

export default function PasswordGenerator({ dragHandle, open, onOpenChange }: MiscSectionProps) {
  const [{ options, password, error }, setState] = useState(() => generate(DEFAULT_OPTIONS))
  const update = (patch: Partial<PasswordOptions>) => setState(generate({ ...options, ...patch }))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      toast({ title: "Password copied" })
    } catch {
      toast({ title: "Could not copy password", description: "Select the password and copy it manually.", variant: "destructive" })
    }
  }

  return (
    <MiscSection dragHandle={dragHandle} open={open} onOpenChange={onOpenChange} title="Password generator" id="zed-password-heading">
      <div className="flex items-center gap-2">
        <input
          aria-label="Generated password"
          className="h-10 min-w-0 flex-1 select-text rounded-md border border-input bg-background px-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={password}
          placeholder="Choose character types"
          readOnly
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button variant="outline" size="icon" onClick={() => update({})} aria-label="Generate a new password">
          <ReloadIcon className="h-4 w-4" />
        </Button>
        <Button onClick={copy}>Copy</Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span>Length: {options.length}</span>
          <span className="text-muted-foreground">({PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH})</span>
        </div>
        <input
          type="range"
          min={PASSWORD_MIN_LENGTH}
          max={PASSWORD_MAX_LENGTH}
          value={options.length}
          onChange={(event) => update({ length: Number(event.target.value) })}
          aria-label="Password length"
          className="w-full cursor-pointer accent-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        {CHARACTER_OPTIONS.map(([key, label, hint]) => {
          const checked = options[key]
          return (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 p-2 text-xs hover:bg-muted/40"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => update({ [key]: event.target.checked })}
                aria-label={`Include ${label.toLowerCase()} characters`}
                className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-primary"
              />
              <div className="flex flex-col">
                <Label className="cursor-pointer text-xs font-medium leading-none">{label}</Label>
                <span className={popupDescription}>{hint}</span>
              </div>
            </label>
          )
        })}
      </div>
    </MiscSection>
  )
}
