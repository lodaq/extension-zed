export function mediaUrl(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    const host = url.hostname.replace(/^(www|m)\./, "")
    if (host === "youtube.com") {
      const id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/shorts\/([\w-]+)/)?.[1]
      if (id && /^[\w-]+$/.test(id)) return `https://www.youtube.com/watch?v=${id}`
    }
    if (host === "youtu.be" && /^\/[\w-]+$/.test(url.pathname)) return `https://www.youtube.com/watch?v=${url.pathname.slice(1)}`
    if (host === "linkedin.com") {
      const update = decodeURIComponent(url.pathname).match(/^\/feed\/update\/urn:li:(activity|share|ugcPost):(\d+)\/?$/)
      if (update) return `https://www.linkedin.com/feed/update/urn:li:${update[1]}:${update[2]}/`
      const post = url.pathname.match(/^\/posts\/[\w-]+-activity-(\d+)-[\w-]+\/?$/)
      if (post) return `https://www.linkedin.com/feed/update/urn:li:activity:${post[1]}/`
    }
    if (host === "instagram.com" || host === "facebook.com") {
      if (host === "instagram.com") {
        const post = url.pathname.match(/^\/p\/([\w-]+)(?:\/|$)/)
        if (post) return `https://www.instagram.com/p/${post[1]}/`
      }
      if (host === "facebook.com") {
        const group = url.pathname.match(/^\/groups\/([\w.-]+)(?:\/(?:posts|permalink)\/([\w-]+))?\/?$/)
        const groupPost = group?.[2] ?? url.searchParams.get("multi_permalinks")
        if (group && groupPost && /^[\w-]+$/.test(groupPost)) return `https://www.facebook.com/groups/${group[1]}/posts/${groupPost}/`
        if (["/photo", "/photo/", "/photo.php"].includes(url.pathname) && /^\d+$/.test(url.searchParams.get("fbid") ?? "")) {
          return `https://www.facebook.com/photo/?fbid=${url.searchParams.get("fbid")}`
        }
        const post = url.pathname.match(/^(\/(?:[\w.-]+\/)?posts\/[\w-]+|\/groups\/[\w.-]+\/(?:posts|permalink)\/[\w-]+|\/share\/[pv]\/[\w-]+)(?:\/|$)/)
        if (post) return `https://www.facebook.com${post[1]}/`
        if (["/permalink.php", "/story.php"].includes(url.pathname) && url.searchParams.get("story_fbid") && url.searchParams.get("id")) {
          return `https://www.facebook.com/permalink.php?${new URLSearchParams({ story_fbid: url.searchParams.get("story_fbid")!, id: url.searchParams.get("id")! })}`
        }
      }
      const match = url.pathname.match(host === "instagram.com" ? /^\/reels?\/([\w-]+)(?:\/|$)/ : /^\/reels?\/([0-9]+)(?:\/|$)/)
      if (match) return `https://www.${host}/reel/${match[1]}/`
    }
  } catch { /* Invalid URL */ }
  return null
}
