import { Icon } from "@/design-system/Icon"
import { LetterAvatar } from "@/design-system/components"
import { useCallback, useEffect, useRef, useState } from "react"
import { LockClosedIcon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import * as Switch from "@radix-ui/react-switch"
import { toast } from "@/components/ui/use-toast"
import { popupDescription, popupSectionStack } from "@/lib/popupLayout"
import { cn } from "@/lib/utils"
import {
  isManagementCancellation,
  listExtensions,
  managementErrorMessage,
  openBraveExtensionsTab,
  openExtensionSettings,
  reloadExtension,
  setExtensionEnabled,
  subscribeToManagementEvents,
  uninstallExtension,
  type ExtensionAction,
  type ManagedExtension,
} from "@/lib/extensionManager"

function ExtensionIcon({ extension }: { extension: ManagedExtension }) {
  const [failed, setFailed] = useState(false)
  if (!extension.iconUrl || failed) return <LetterAvatar title={extension.name} />
  return <img src={extension.iconUrl} alt="" width={28} height={28} className={cn("h-7 w-7 shrink-0", !extension.enabled && "grayscale")} onError={() => setFailed(true)} />
}

export default function ExtensionsTab() {
  const permissions = typeof chrome !== "undefined" ? chrome.permissions : undefined
  const [extensions, setExtensions] = useState<ManagedExtension[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<"checking" | "missing" | "granted">(permissions ? "checking" : "missing")
  const [permissionError, setPermissionError] = useState<string | null>(permissions ? null : "Extension permissions are unavailable in this browser.")
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [pending, setPending] = useState<Record<string, ExtensionAction>>({})
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const next = await listExtensions()
      if (alive.current) { setExtensions(next); setError(null) }
    } catch (loadError) {
      if (alive.current) setError(managementErrorMessage(loadError))
    }
  }, [])

  useEffect(() => {
    if (!permissions) return
    let active = true
    void permissions.contains({ permissions: ["management"] })
      .then((granted) => { if (active) setPermissionState(granted ? "granted" : "missing") })
      .catch((err: unknown) => { if (active) { setPermissionState("missing"); setPermissionError(managementErrorMessage(err)) } })
    return () => { active = false }
  }, [permissions])

  useEffect(() => {
    if (permissionState !== "granted") return
    alive.current = true
    void Promise.resolve().then(load)
    const unsubscribe = subscribeToManagementEvents(typeof chrome === "undefined" ? undefined : chrome.management, () => void load())
    return () => { alive.current = false; unsubscribe() }
  }, [load, permissionState])

  const requestManagementPermission = async () => {
    if (!permissions) { setPermissionError("Extension permissions are unavailable in this browser."); return }
    setRequestingPermission(true); setPermissionError(null)
    try {
      if (await permissions.request({ permissions: ["management"] })) setPermissionState("granted")
      else setPermissionError("Permission was not granted. You can try again at any time.")
    } catch (err) {
      setPermissionError(managementErrorMessage(err))
    } finally { setRequestingPermission(false) }
  }

  const perform = async (extension: ManagedExtension, action: ExtensionAction, enabled = !extension.enabled) => {
    const operation = {
      toggle: { allowed: extension.canToggle, run: () => setExtensionEnabled(extension.id, enabled), success: `${extension.name} turned ${enabled ? "on" : "off"}` },
      reload: { allowed: extension.canReload, run: () => reloadExtension(extension.id), success: `Reloaded ${extension.name}` },
      uninstall: { allowed: extension.canUninstall, run: () => uninstallExtension(extension.id), success: `Uninstalled ${extension.name}` },
    }[action]
    if (!operation.allowed || pending[extension.id]) return
    setPending(current => ({ ...current, [extension.id]: action }))
    if (action === "toggle") setExtensions(current => current?.map(item => item.id === extension.id ? { ...item, enabled } : item) ?? current)
    try {
      await operation.run()
      toast({ title: operation.success })
    } catch (err) {
      if (!isManagementCancellation(err)) toast({ title: `Could not ${action === "toggle" ? "change" : action} ${extension.name}`, description: managementErrorMessage(err), variant: "destructive" })
    } finally {
      setPending(current => { const next = { ...current }; delete next[extension.id]; return next })
      void load()
    }
  }

  const navigate = async (operation: () => Promise<void>, title: string) => {
    try { await operation() }
    catch (err) { toast({ title, description: managementErrorMessage(err), variant: "destructive" }) }
  }

  const enabledCount = extensions?.filter((extension) => extension.enabled).length ?? 0
  const statusLine = permissionState === "checking" ? "Checking extension manager access…"
    : permissionState === "granted" && extensions === null && !error ? "Loading extensions…"
      : permissionState === "granted" && extensions?.length === 0 ? "No extensions found." : null

  return (
    <div className={cn(popupSectionStack, "zed-extensions px-0.5 pb-2 pt-3")}>
      <div className="flex items-center justify-between gap-1.5 px-1">
        <div className="flex items-center gap-1 min-w-0">
          <p className={popupDescription}>Click an extension to turn it on or off.</p>
          <button type="button" onClick={() => void navigate(openBraveExtensionsTab, "Could not open extensions tab")}
            aria-label="Open brave://extensions/ in a new tab" title="Open brave://extensions/ in a new tab"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--zed-radius-lg)] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <Icon name="open" size={16} />
          </button>
        </div>
        {permissionState === "granted" && extensions && extensions.length > 0 && (
          <span className="shrink-0 text-[length:var(--zed-fs-2xs)] tabular-nums text-muted-foreground">
            {enabledCount} on · {extensions.length - enabledCount} off
          </span>
        )}
      </div>

      {statusLine && <p className="px-1 text-xs text-muted-foreground">{statusLine}</p>}

      {permissionState === "missing" && (
        <div className="space-y-2 rounded-[var(--zed-radius-lg)] border border-border/70 bg-muted/40 p-3">
          <div>
            <p className="text-xs font-medium">Allow extension management</p>
            <p className="mt-1 text-[length:var(--zed-fs-2xs)] leading-relaxed text-muted-foreground">
              Grant access to list and manage your installed extensions. The browser will ask you to confirm.
            </p>
          </div>
          {permissionError && <p role="alert" className="text-[length:var(--zed-fs-2xs)] text-destructive">{permissionError}</p>}
          <Button type="button" size="sm" className="h-7 text-[length:var(--zed-fs-2xs)]" disabled={requestingPermission} onClick={() => void requestManagementPermission()}>
            {requestingPermission ? "Waiting for permission…" : "Allow access"}
          </Button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-2 rounded-[var(--zed-radius-lg)] border border-[var(--zed-warn-line)] bg-[var(--zed-warn-tint)] px-2 py-1.5 text-[length:var(--zed-fs-2xs)] text-[var(--zed-warn)]">
          <span className="min-w-0 flex-1">{error}</span>
          <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-[length:var(--zed-fs-2xs)]" onClick={() => void load()}>Retry</Button>
        </div>
      )}

      {permissionState === "granted" && extensions && extensions.length > 0 && (
        <ul className="space-y-1">
          {[...extensions].sort((a, b) => Number(b.enabled) - Number(a.enabled)).map((extension) => {
            const busy = Boolean(pending[extension.id])
            const locked = !extension.canToggle && !extension.canUninstall
            return (
              <li key={extension.id} aria-busy={busy || undefined}
                title={extension.canToggle ? `Click to turn ${extension.name} ${extension.enabled ? "off" : "on"}` : undefined}
                className={cn("zed-row", extension.canToggle && !busy && "cursor-pointer hover:bg-muted/60", !extension.enabled && "text-muted-foreground")}>
                <button className="flex items-center gap-2 min-w-0 flex-1" disabled={!extension.canToggle || busy} onClick={() => void perform(extension, "toggle")}>
                  <ExtensionIcon extension={extension} />
                  <span className="min-w-0 flex-1 text-left">
                    <div className="zed-extension-name truncate">{extension.name}</div>
                    <div className="truncate text-xs leading-4 text-muted-foreground">v{extension.version}{locked ? " · Managed by policy" : ""}</div>
                  </span>
                </button>
                {locked && <LockClosedIcon aria-label="Managed by Chrome policy" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <div className="flex shrink-0 items-center gap-0.5">
                  {([
                    { icon: "settings", label: `Open settings for ${extension.name}`, title: "Settings", disabled: false, run: () => navigate(() => openExtensionSettings(extension), `Could not open settings for ${extension.name}`) },
                    { icon: "reload", label: `Reload ${extension.name}`, title: "Reload (applies an update Chrome has already downloaded)", disabled: !extension.canReload, run: () => perform(extension, "reload") },
                    { icon: "delete", label: `Uninstall ${extension.name}`, title: "Uninstall", disabled: !extension.canUninstall, run: () => perform(extension, "uninstall") },
                  ] as const).map(action => (
                    <Button key={action.icon} type="button" variant="ghost" size="icon" className="zed-row-action"
                      aria-label={action.label} title={action.title} disabled={action.disabled || busy}
                      onClick={event => { event.stopPropagation(); void action.run() }}>
                      <Icon name={action.icon} size={16} />
                    </Button>
                  ))}
                  <Switch.Root type="button" checked={extension.enabled} disabled={!extension.canToggle || busy}
                    aria-label={`Turn ${extension.name} ${extension.enabled ? "off" : "on"}`} className="zed-radix-switch ml-0.5"
                    onClick={(event) => event.stopPropagation()} onCheckedChange={(checked) => void perform(extension, "toggle", checked)}>
                    <Switch.Thumb className="zed-radix-thumb" />
                  </Switch.Root>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
