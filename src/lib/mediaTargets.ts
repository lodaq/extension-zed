import { mediaUrl } from "./saved"

// Prefer the whole media card so title and thumbnail links share one button.
const CARD = "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer, ytd-reel-video-renderer, yt-lockup-view-model, yt-shorts-lockup-view-model, ytm-shorts-lockup-view-model, article, [role=article], [data-pagelet^=FeedUnit]"
export function findMediaTargets(root: Document, pageUrl: string): Map<HTMLElement, string | null> {
  const targets = new Map<HTMLElement, string | null>()
  const facebook = /^(?:www\.|m\.)?facebook\.com$/.test(new URL(pageUrl).hostname)
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    let destination: URL
    try { destination = new URL(anchor.href) } catch { continue }
    if (destination.searchParams.has("comment_id") || destination.searchParams.has("reply_comment_id")) continue
    const url = mediaUrl(anchor.href)
    // Feed experiments omit article wrappers and hydrate timestamp links on hover.
    const timestamp = facebook && /^(?:www\.|m\.)?facebook\.com$/.test(destination.hostname) && /(?:\b(?:ago|yesterday|just now|[0-9]+\s*[smhdwy])\b|منذ|ساعة|ساعات|دقيقة|دقائق|ثانية|أمس)/i.test(
      `${anchor.textContent ?? ""} ${anchor.getAttribute?.("aria-label") ?? ""} ${anchor.getAttribute?.("title") ?? ""}`,
    )
    const rawHref = anchor.getAttribute?.("href")
    if ((rawHref === "#" || rawHref === "") && !timestamp) continue
    if (!url && !timestamp) continue
    const card = anchor.closest<HTMLElement>(CARD)
    // Prefer the post timestamp to a separate link opening only its photo.
    if (facebook && !card && destination.pathname.startsWith("/photo") && !timestamp) continue
    const target = card ?? anchor.parentElement
    if (!target) continue
    if (!targets.has(target) || targets.get(target) === null) targets.set(target, url)
  }
  const videos = root.querySelectorAll("video")
  // Reel viewers preload hidden/neighboring videos. Only the most visible player
  // may use the address-bar permalink when its card has no link of its own.
  const view = root.defaultView
  let pageVideo: HTMLVideoElement | undefined
  let largestArea = 0
  if (view && mediaUrl(pageUrl)) {
    for (const video of videos) {
      const rect = video.getBoundingClientRect()
      const style = view.getComputedStyle(video)
      if (style.visibility === "hidden" || style.display === "none" || video.closest('[hidden]')) continue
      const area = Math.max(0, Math.min(rect.right, view.innerWidth) - Math.max(rect.left, 0)) *
        Math.max(0, Math.min(rect.bottom, view.innerHeight) - Math.max(rect.top, 0))
      if (area > largestArea) { largestArea = area; pageVideo = video }
    }
  }
  for (const video of videos) {
    const target = video.closest<HTMLElement>(CARD) ?? video.parentElement
    if (!target || targets.has(target)) continue
    const card = video.closest<HTMLElement>(CARD)
    const id = card?.getAttribute("video-id") ?? card?.getAttribute("data-video-id")
    const ownUrl = id ? mediaUrl(`https://www.youtube.com/watch?v=${id}`) : null
    if (ownUrl) { targets.set(target, ownUrl); continue }
    // Find a permalink in this video's nearest container, never in another feed item.
    let parent = video.parentElement
    let url: string | null = null
    for (let depth = 0; parent && depth < 6; depth++, parent = parent.parentElement) {
      if (parent.querySelectorAll("video").length > 1) break
      url = [...parent.querySelectorAll<HTMLAnchorElement>("a[href]")].map(link => mediaUrl(link.href)).find(Boolean) ?? null
      if (url || parent === card) break
    }
    // Never assign the active reel URL to a preloaded or neighboring player.
    if (!url && video === pageVideo) url = mediaUrl(pageUrl)
    if (url) targets.set(target, url)
  }
  // Facebook may expose a post's permalink only after its timestamp is hovered.
  // Keep a control on those cards too; resolve their link again when saving.
  if (/^(?:www\.|m\.)?(?:facebook|instagram)\.com$/.test(new URL(pageUrl).hostname)) {
    for (const card of root.querySelectorAll<HTMLElement>('article, [role=article], [data-pagelet^=FeedUnit]')) {
      if (card.parentElement?.closest('article, [role=article], [data-pagelet^=FeedUnit]')) continue
      if (![...targets.keys()].some(target => card.contains(target))) targets.set(card, null)
    }
  }
  return targets
}
