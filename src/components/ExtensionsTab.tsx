import { Icon } from "@/design-system/Icon"
import { LetterAvatar } from "@/design-system/components"
import { useCallback, useEffect, useRef, useState } from "react"
import { LockClosedIcon } from "@radix-ui/react-icons"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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

  if (!extension.iconUrl || failed) {
    return <LetterAvatar title={extension.name}/>
  }

  return (
    <img
      src={extension.iconUrl}
      alt=""
      width={28}
      height={28}
      className={cn("h-7 w-7 shrink-0", !extension.enabled && "grayscale")}
      onError={() => setFailed(true)}
    />
  )
}

export default function ExtensionsTab() {
  const permissionsAvailable =
    typeof chrome !== "undefined" && Boolean(chrome.permissions)
  const [extensions, setExtensions] = useState<ManagedExtension[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [permissionState, setPermissionState] = useState<"checking" | "missing" | "granted">(
    permissionsAvailable ? "checking" : "missing"
  )
  const [permissionError, setPermissionError] = useState<string | null>(
    permissionsAvailable ? null : "Extension permissions are unavailable in this browser."
  )
  const [requestingPermission, setRequestingPermission] = useState(false)
  const [pending, setPending] = useState<Record<string, ExtensionAction>>({})
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const next = await listExtensions()
      if (!alive.current) return
      setExtensions(next)
      setError(null)
    } catch (loadError) {
      if (!alive.current) return
      setError(managementErrorMessage(loadError))
    }
  }, [])

  useEffect(() => {
    let active = true
    const permissions = typeof chrome === "undefined" ? undefined : chrome.permissions
    if (!permissions) return

    void permissions
      .contains({ permissions: ["management"] })
      .then((granted) => {
        if (active) setPermissionState(granted ? "granted" : "missing")
      })
      .catch((permissionCheckError: unknown) => {
        if (!active) return
        setPermissionState("missing")
        setPermissionError(managementErrorMessage(permissionCheckError))
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (permissionState !== "granted") return
    alive.current = true
    void Promise.resolve().then(load)

    const api = typeof chrome === "undefined" ? undefined : chrome.management
    const refresh = () => void load()
    const unsubscribe = subscribeToManagementEvents(api, refresh)

    return () => {
      alive.current = false
      unsubscribe()
    }
  }, [load, permissionState])

  const requestManagementPermission = async () => {
    const permissions = typeof chrome === "undefined" ? undefined : chrome.permissions
    if (!permissions) {
      setPermissionError("Extension permissions are unavailable in this browser.")
      return
    }

    setRequestingPermission(true)
    setPermissionError(null)
    try {
      const granted = await permissions.request({ permissions: ["management"] })
      if (granted) {
        setPermissionState("granted")
      } else {
        setPermissionError("Permission was not granted. You can try again at any time.")
      }
    } catch (requestError: unknown) {
      setPermissionError(managementErrorMessage(requestError))
    } finally {
      setRequestingPermission(false)
    }
  }

  const perform = useCallback(
    async (
      extension: ManagedExtension,
      action: ExtensionAction,
      operation: () => Promise<void>,
      successTitle: string
    ) => {
      setPending((current) => ({ ...current, [extension.id]: action }))
      try {
        await operation()
        toast({ title: successTitle })
      } catch (actionError) {
        if (!isManagementCancellation(actionError)) {
          toast({
            title: `Could not ${action === "toggle" ? "change" : action} ${extension.name}`,
            description: managementErrorMessage(actionError),
            variant: "destructive",
          })
        }
      } finally {
        setPending((current) => {
          const next = { ...current }
          delete next[extension.id]
          return next
        })
        void load()
      }
    },
    [load]
  )

  const setEnabled = (extension: ManagedExtension, enabled: boolean) => {
    if (!extension.canToggle || pending[extension.id]) return
    setExtensions((current) =>
      current?.map((item) => (item.id === extension.id ? { ...item, enabled } : item)) ?? current
    )
    void perform(
      extension,
      "toggle",
      () => setExtensionEnabled(extension.id, enabled),
      `${extension.name} turned ${enabled ? "on" : "off"}`
    )
  }

  const reload = (extension: ManagedExtension) => {
    if (!extension.canReload || pending[extension.id]) return
    void perform(extension, "reload", () => reloadExtension(extension.id), `Reloaded ${extension.name}`)
  }

  const uninstall = (extension: ManagedExtension) => {
    if (!extension.canUninstall || pending[extension.id]) return
    void perform(extension, "uninstall", () => uninstallExtension(extension.id), `Uninstalled ${extension.name}`)
  }

  const openSettings = useCallback(
    (extension: ManagedExtension) => {
      void openExtensionSettings(extension).catch((settingsError: unknown) => {
        toast({
          title: `Could not open settings for ${extension.name}`,
          description: managementErrorMessage(settingsError),
          variant: "destructive",
        })
      })
    },
    []
  )

  const handleOpenBraveExtensions = async () => {
    try {
      await openBraveExtensionsTab()
    } catch (openError: unknown) {
      toast({
        title: "Could not open extensions tab",
        description: managementErrorMessage(openError),
        variant: "destructive",
      })
    }
  }

  const enabledCount = extensions?.filter((extension) => extension.enabled).length ?? 0
  const disabledCount = extensions ? extensions.length - enabledCount : 0

  return (
    <div className={cn(popupSectionStack, "zed-extensions px-0.5 pb-2 pt-3")}>
      <div className="flex items-center justify-between gap-1.5 px-1">
        <div className="flex items-center gap-1 min-w-0">
          <p className={popupDescription}>Click an extension to turn it on or off.</p>
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--zed-radius-lg)] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => void handleOpenBraveExtensions()}
            aria-label="Open brave://extensions/ in a new tab"
            title="Open brave://extensions/ in a new tab"
          >
            <Icon name="open" size={16}/>
          </button>
        </div>
        {permissionState === "granted" && extensions && extensions.length > 0 && (
          <span className="shrink-0 text-[length:var(--zed-fs-2xs)] tabular-nums text-muted-foreground">
            {enabledCount} on · {disabledCount} off
          </span>
        )}
      </div>

      {permissionState === "checking" && (
        <p className="px-1 text-xs text-muted-foreground">Checking extension manager access…</p>
      )}

      {permissionState === "missing" && (
        <div className="space-y-2 rounded-[var(--zed-radius-lg)] border border-border/70 bg-muted/40 p-3">
          <div>
            <p className="text-xs font-medium">Allow extension management</p>
            <p className="mt-1 text-[length:var(--zed-fs-2xs)] leading-relaxed text-muted-foreground">
              Grant access to list and manage your installed extensions. The browser will ask you to confirm.
            </p>
          </div>
          {permissionError && (
            <p role="alert" className="text-[length:var(--zed-fs-2xs)] text-destructive">
              {permissionError}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            className="h-7 text-[length:var(--zed-fs-2xs)]"
            disabled={requestingPermission}
            onClick={() => void requestManagementPermission()}
          >
            {requestingPermission ? "Waiting for permission…" : "Allow access"}
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-[var(--zed-radius-lg)] border border-[var(--zed-warn-line)] bg-[var(--zed-warn-tint)] px-2 py-1.5 text-[length:var(--zed-fs-2xs)] text-[var(--zed-warn)] "
        >
          <span className="min-w-0 flex-1">{error}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-2 text-[length:var(--zed-fs-2xs)]"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      )}

      {permissionState === "granted" && extensions === null && !error && (
        <p className="px-1 text-xs text-muted-foreground">Loading extensions…</p>
      )}

      {permissionState === "granted" && extensions?.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">No extensions found.</p>
      )}

      {permissionState === "granted" && extensions && extensions.length > 0 && (
        <ul className="space-y-1">
          {extensions.map((extension) => {
            const busy = pending[extension.id]
            const locked = !extension.isSelf && !extension.canToggle && !extension.canUninstall
            const rowTitle = extension.canToggle
              ? `Click to turn ${extension.name} ${extension.enabled ? "off" : "on"}`
              : undefined

            return (
              <li
                key={extension.id}
                aria-busy={busy ? true : undefined}
                title={rowTitle}
                className={cn(
                  "zed-row",
                  extension.isSelf && "zed-extension-self",
                  extension.canToggle && !busy && "cursor-pointer hover:bg-muted/60",
                  !extension.enabled && "text-muted-foreground"
                )}
              >
                <button className="flex items-center gap-2 min-w-0 flex-1" disabled={!extension.canToggle || Boolean(busy)} onClick={()=>setEnabled(extension,!extension.enabled)}><ExtensionIcon extension={extension} /><span className="min-w-0 flex-1 text-left">
                  <div className="zed-extension-name truncate">{extension.name}</div>
                  <div className="truncate text-xs leading-4 text-muted-foreground">
                    v{extension.version}
                    {extension.isSelf ? " · This extension" : ""}
                    {locked ? " · Managed by policy" : ""}
                  </div>
                </span></button>

                {locked && (
                  <LockClosedIcon
                    aria-label="Managed by Chrome policy"
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                )}

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="zed-row-action"
                    aria-label={`Open settings for ${extension.name}`}
                    title="Settings"
                    disabled={Boolean(busy)}
                    onClick={(event) => {
                      event.stopPropagation()
                      openSettings(extension)
                    }}
                  >
                    <Icon name="settings" size={16}/>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="zed-row-action"
                    aria-label={`Reload ${extension.name}`}
                    title={
                      extension.isSelf
                        ? "Reload this extension"
                        : "Reload (applies an update Chrome has already downloaded)"
                    }
                    disabled={!extension.canReload || Boolean(busy)}
                    onClick={(event) => {
                      event.stopPropagation()
                      reload(extension)
                    }}
                  >
                    <Icon name="reload" size={16}/>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="zed-row-action"
                    aria-label={`Uninstall ${extension.name}`}
                    title="Uninstall"
                    disabled={!extension.canUninstall || Boolean(busy)}
                    onClick={(event) => {
                      event.stopPropagation()
                      uninstall(extension)
                    }}
                  >
                    <Icon name="delete" size={16}/>
                  </Button>

                  <Switch
                    checked={extension.enabled}
                    disabled={!extension.canToggle || Boolean(busy)}
                    aria-label={`Turn ${extension.name} ${extension.enabled ? "off" : "on"}`}
                    className="ml-0.5"
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={(checked) => setEnabled(extension, checked)}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
