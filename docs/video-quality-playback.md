# Video Quality & Playback Speed — Supported Websites

These two Extension Zed features work on the sites listed below. Support depends on each site's video player; players the extension cannot control keep their own quality/speed settings.

## How the features work

- **Playback speed (0.1×–10×):** Applied directly to native `<video>` elements. Works on virtually any site that plays video through a standard HTML5 video element, including all Video.js, HLS.js, Shaka, and native players.
- **Video quality (Auto/144p–8K):** Controlled through each player's API where available (YouTube, Meta/Facebook/Instagram, TikTok, HLS.js, Shaka, Video.js). Falls back to a higher or lower available resolution when the exact choice isn't offered.

## Sites where both features work well

| Site | Player | Notes |
|------|--------|-------|
| [edx.org](https://learning.edx.org/) | Video.js | Both speed and quality work. `window.videojs` is exposed by the page player. |
| [YouTube](https://www.youtube.com/) | YouTube native | Speed and quality (including 4K/8K when available) work through the YouTube player API. |
| [Facebook](https://www.facebook.com/) / [Instagram](https://www.instagram.com/) | Meta player | Speed via the Meta controller; quality through Meta's quality API. |
| [TikTok](https://www.tiktok.com/) | TikTok native | Speed and resolution selection through TikTok's player API. |
| Sites using **HLS.js** (`video.hls`) | HLS.js | Speed on the video element; quality by selecting the HLS load level. |
| Sites using **Shaka Player** | Shaka | Speed on the video element; quality by selecting variant tracks (audio/language preserved). |
| Sites using **Video.js** (incl. [LinkedIn](https://www.linkedin.com/)) | Video.js | Speed on the video element; quality through `qualityLevels`. |

## Sites where playback speed works but quality control is limited

Any site playing video through a standard `<video>` element gets playback speed. If the player doesn't expose a quality API (for example, a plain native player without HLS/Shaka/Video.js controls), only speed can be adjusted; quality remains at the player's default.

## Adding a site

Support is player-based, not domain-based, so no code change is usually needed for a new site. If a site's player exposes a standard API (Video.js, HLS.js, Shaka, etc.), both features should work once the extension's content scripts run on that domain (they run on all `https://*/*` pages by default).

If you find a site where speed or quality doesn't work, open an issue with the page URL and the player type (check the browser console for `window.videojs`, `video.hls`, `shaka.Player`, etc.).