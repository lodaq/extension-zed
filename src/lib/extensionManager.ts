export type ExtensionAction = "reload" | "uninstall" | "toggle"

export type ManagedExtension = {
  id: string
  name: string
  version: string
  enabled: boolean
  isSelf: boolean
  canToggle: boolean
  canReload: boolean
  canUninstall: boolean
  iconUrl: string | null
  optionsUrl: string
}

type ManagementEvent = {
  addListener(listener: () => void): void
  removeListener(listener: () => void): void
}

type ManagementEvents = Partial<
  Record<"onEnabled" | "onDisabled" | "onInstalled" | "onUninstalled", ManagementEvent>
>

const MANAGEMENT_UNAVAILABLE =
  "Extension management is unavailable: this browser does not expose chrome.management.getAll. Reload the extension after granting its management permission, or use a compatible browser."

export function subscribeToManagementEvents(
  api: ManagementEvents | undefined,
  listener: () => void
): () => void {
  const events = [api?.onEnabled, api?.onDisabled, api?.onInstalled, api?.onUninstalled]
  events.forEach((event) => event?.addListener(listener))
  return () => events.forEach((event) => event?.removeListener(listener))
}

function getManagement(): typeof chrome.management {
  const api = typeof chrome === "undefined" ? undefined : chrome.management
  if (!api) throw new Error(MANAGEMENT_UNAVAILABLE)
  return api
}

function pickIconUrl(info: chrome.management.ExtensionInfo): string | null {
  const icons = [...(info.icons ?? [])].sort((a, b) => a.size - b.size)
  const icon = icons.find((candidate) => candidate.size >= 32) ?? icons[icons.length - 1]
  return icon?.url ?? null
}

/**
 * Keeps extensions only (apps and themes are not manager targets), decides
 * which actions Chrome will allow, and orders the list alphabetically so rows
 * do not jump around after a toggle.
 */
export function toManagedExtensions(
  infos: readonly chrome.management.ExtensionInfo[],
  selfId: string
): ManagedExtension[] {
  return infos
    .filter((info) => info.type === "extension")
    .map((info) => {
      const isSelf = info.id === selfId
      const canToggle = !isSelf && (info.enabled ? info.mayDisable : info.mayEnable !== false)
      return {
        id: info.id,
        name: info.name,
        version: info.versionName || info.version,
        enabled: info.enabled,
        isSelf,
        canToggle,
        canReload: canToggle && info.enabled,
        canUninstall: !isSelf && info.mayDisable,
        iconUrl: pickIconUrl(info),
        optionsUrl: info.optionsUrl || "",
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

export function currentExtensionId(): string {
  return typeof chrome === "undefined" ? "" : chrome.runtime?.id ?? ""
}

export async function listExtensions(selfId: string = currentExtensionId()): Promise<ManagedExtension[]> {
  const api = getManagement()
  if (typeof api.getAll !== "function") throw new Error(MANAGEMENT_UNAVAILABLE)
  const infos = await api.getAll()
  return toManagedExtensions(infos, selfId)
}

export async function setExtensionEnabled(id: string, enabled: boolean): Promise<void> {
  await getManagement().setEnabled(id, enabled)
}

/**
 * Chrome has no public "update another extension" API. Disabling and enabling
 * reloads an unpacked extension from disk and applies an update that Chrome has
 * already downloaded for a store extension.
 */
export async function reloadExtension(id: string): Promise<void> {
  const api = getManagement()
  await api.setEnabled(id, false)
  await api.setEnabled(id, true)
}

export async function uninstallExtension(id: string): Promise<void> {
  await getManagement().uninstall(id)
}

export function getExtensionSettingsUrl(extension: {
  id: string
  optionsUrl?: string | null
  enabled?: boolean
}): string {
  if (extension.enabled && extension.optionsUrl) {
    return extension.optionsUrl
  }
  return `chrome://extensions/?id=${extension.id}`
}

export async function openTab(url: string): Promise<void> {
  const tabs = typeof chrome === "undefined" ? undefined : chrome.tabs
  if (tabs && typeof tabs.create === "function") {
    await new Promise<void>((resolve, reject) => {
      try {
        const result: unknown = tabs.create({ url }, () => {
          const lastError = chrome.runtime?.lastError
          if (lastError) reject(new Error(lastError.message))
          else resolve()
        })
        if (result && typeof (result as Promise<unknown>).then === "function") {
          ;(result as Promise<unknown>).then(() => resolve(), reject)
        }
      } catch (err) {
        reject(err)
      }
    })
    return
  }

  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer")
    return
  }

  throw new Error("Cannot open new tab: browser tab API is unavailable.")
}

export async function openExtensionSettings(
  extension: ManagedExtension,
  options?: { onOpenSelf?: () => void }
): Promise<void> {
  if (extension.isSelf && options?.onOpenSelf) {
    options.onOpenSelf()
    return
  }

  const primaryUrl = getExtensionSettingsUrl(extension)
  const fallbackUrl = `chrome://extensions/?id=${extension.id}`

  try {
    await openTab(primaryUrl)
  } catch (primaryError) {
    if (primaryUrl !== fallbackUrl) {
      await openTab(fallbackUrl)
      return
    }
    throw primaryError
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : String(error ?? "")
}

/** Chrome reports a dismissed uninstall confirmation as an error; that is not a failure. */
export function isManagementCancellation(error: unknown): boolean {
  return /cancel/i.test(errorText(error))
}

export function managementErrorMessage(error: unknown): string {
  const message = errorText(error).trim()
  if (/cannot be modified|user cannot modify|policy|managed by|not allowed/i.test(message)) {
    return "Chrome policy does not allow changing this extension."
  }
  return message || "Chrome rejected the request."
}
