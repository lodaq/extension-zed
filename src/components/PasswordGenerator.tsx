import MiscSection, { type MiscSectionProps } from "@/components/MiscSection"
import { useState } from "react"
import { Icon } from "@/design-system/Icon"
import { Button } from "@/components/ui/button"
import { Card, CheckboxTile } from "@/design-system/components"
import { toast } from "@/components/ui/use-toast"
import { DEFAULT_PASSWORD_OPTIONS, generatePassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type PasswordOptions } from "@/lib/passwordGenerator"

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

export default function PasswordGenerator({ dragHandle, open, onOpenChange, initialOptions=DEFAULT_PASSWORD_OPTIONS, onOptionsChange }: MiscSectionProps & {initialOptions?:PasswordOptions;onOptionsChange?:(options:PasswordOptions)=>void}) {
  const [{ options, password, error }, setState] = useState(() => generate(initialOptions))
  const update = (patch: Partial<PasswordOptions>) => {
    const next = {...options,...patch}
    onOptionsChange?.(next)
    setState(generate(next))
  }

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
          className="zed-input zed-password flex-1 min-w-0"
          value={password}
          placeholder="Choose character types"
          readOnly
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <Button variant="outline" size="icon" onClick={() => update({})} aria-label="Generate new password">
          <Icon name="reload"/>
        </Button>
        <Button variant="default" className="zed-password-copy" disabled={!password} onClick={copy}>Copy</Button>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <Card><div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span>Length <strong>{options.length}</strong></span>
          <span className="text-muted-foreground">{PASSWORD_MIN_LENGTH}–{PASSWORD_MAX_LENGTH}</span>
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

      </Card><div className="grid grid-cols-2 gap-2 pt-1">
        {CHARACTER_OPTIONS.map(([key,label,hint])=><CheckboxTile key={key} label={label} hint={hint} checked={options[key]} onChange={checked=>update({[key]:checked})}/>)}
      </div>
    </MiscSection>
  )
}
