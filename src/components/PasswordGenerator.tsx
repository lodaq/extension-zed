import { useState } from "react"
import { ReloadIcon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { popupDescription, popupPanel, popupSectionInner, popupSectionTitle } from "@/lib/popupLayout"
import { generatePassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type PasswordOptions } from "@/lib/passwordGenerator"
import { cn } from "@/lib/utils"

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

export default function PasswordGenerator() {
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
    <section className={cn(popupPanel, popupSectionInner)} aria-labelledby="zed-password-heading">
      <h2 id="zed-password-heading" className={popupSectionTitle}>Password generator</h2>
      <div className="flex items-center gap-2">
        <input
          aria-label="Generated password"
          className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={password}
          placeholder="Choose character types"
          readOnly
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" size="icon" className="h-10 w-10 shrink-0" aria-label="Generate a new password" title="Generate a new password" disabled={Boolean(error)} onClick={() => setState(generate(options))}>
          <ReloadIcon aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
      <Button type="button" variant="default" disabled={!password} onClick={() => void copy()}>Copy password</Button>

      <div className="mt-1 flex items-center justify-between gap-3">
        <Label htmlFor="zed-password-length">Password length</Label>
        <input
          id="zed-password-length"
          type="number"
          min={PASSWORD_MIN_LENGTH}
          max={PASSWORD_MAX_LENGTH}
          step={1}
          value={Number.isFinite(options.length) ? options.length : ""}
          aria-invalid={!Number.isInteger(options.length) || options.length < PASSWORD_MIN_LENGTH || options.length > PASSWORD_MAX_LENGTH}
          aria-describedby={error ? "zed-password-error" : undefined}
          onChange={(event) => update({ length: event.currentTarget.valueAsNumber })}
          className="h-9 w-20 rounded-md border border-input bg-background px-2 text-center text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <input
        type="range"
        min={PASSWORD_MIN_LENGTH}
        max={PASSWORD_MAX_LENGTH}
        step={1}
        value={Number.isFinite(options.length) ? options.length : PASSWORD_MIN_LENGTH}
        aria-label="Password length slider"
        onChange={(event) => update({ length: event.currentTarget.valueAsNumber })}
        className="w-full accent-primary"
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Characters used</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {CHARACTER_OPTIONS.map(([key, label, example]) => (
            <label key={key} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={options[key]} onChange={(event) => update({ [key]: event.currentTarget.checked })} className="h-4 w-4 accent-primary" />
              <span>{label} <span className="text-xs text-muted-foreground">{example}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p id="zed-password-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <p className={popupDescription}>Generated on your device. Passwords are not saved.</p>
    </section>
  )
}
