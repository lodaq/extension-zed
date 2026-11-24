const PLAYER_TIME_SELECTORS = `.ytp-time-display, .ytp-time-current, .ytp-time-duration, .ytp-time-separator, .ytp-chapter-container`
const THUMBNAIL_TIMESTAMP_SELECTORS = `ytd-thumbnail-overlay-time-status-renderer, yt-thumbnail-overlay-time-status-renderer, yt-thumbnail-overlay-badge-view-model, yt-thumbnail-badge-view-model, .thumbnail-overlay-time-status-renderer, ytm-thumbnail-overlay-time-status-renderer, .ytp-modern-videowall-still-info-duration, .ytp-videowall-still-info-duration, .ytInlinePlayerControlsTimeDisplay, .ytPlayerStoryboardTimestamp, ytd-video-preview [class*="TimeDisplay"], ytd-video-preview [class*="Timestamp"], #video-preview-container [class*="TimeDisplay"], #video-preview-container [class*="Timestamp"], yt-inline-player-controls [class*="TimeDisplay"], yt-inline-player-controls [class*="Timestamp"]`

export const YOUTUBE_STYLES = {
  hideYoutubeProgressBar: {
    id: "zed-youtube-progress-bar",
    settingKey: "youtubeHideProgress",
    css: `.ytp-progress-bar-container, .ytp-progress-bar, #progress-bar, ytd-player .ytp-progress-bar-container, .ytp-chapter-container { display: none !important; }`,
  },
  hideYoutubeControls: {
    id: "zed-youtube-controls",
    settingKey: "youtubeHideControls",
    css: `.ytp-chrome-bottom, .ytp-chrome-controls, .ytp-gradient-bottom, ytd-player .ytp-chrome-bottom { display: none !important; }`,
  },
  hideYoutubeDuration: {
    id: "zed-youtube-duration",
    settingKey: "youtubeHideDuration",
    css: `${PLAYER_TIME_SELECTORS} { display: none !important; }`,
  },
  hideYoutubeTimestamps: {
    id: "zed-youtube-timestamps",
    settingKey: "youtubeHideTimestamps",
    css: `${THUMBNAIL_TIMESTAMP_SELECTORS} { display: none !important; }`,
  },
  hideAllYoutubeTimestamps: {
    id: "zed-youtube-all-timestamps",
    settingKey: "youtubeHideAllTimestamps",
    css: `${PLAYER_TIME_SELECTORS},
    .ytp-preview .ytp-tooltip-text, .ytp-tooltip-duration, .ytp-tooltip-progress-bar-pill-time-stamp,
    .ytp-progress-bar-hover .ytp-tooltip-text, .ytp-progress-bar-hover .ytp-tooltip-bottom-text,
    .ytp-tooltip-progress-bar-pill:not(:has(.ytp-tooltip-progress-bar-pill-title:not(:empty))), .ytp-storyboard-framepreview-timestamp,
    ${THUMBNAIL_TIMESTAMP_SELECTORS},
    a[href*="&t="], a[href*="?t="], a[href*="#t="], a[href*="&start="], a[href*="?start="], a[href*="#start="],
    .segment-timestamp, #segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp, ytd-macro-markers-list-item-renderer #time { display: none !important; }`,
  },
  youtubeHalfScreen: {
    id: "zed-youtube-half-screen",
    settingKey: "youtubeHalfScreen",
    css: `ytd-watch-flexy[flexy] #primary.ytd-watch-flexy { max-width: 100% !important; min-width: 0 !important; }
    ytd-watch-flexy[flexy] #player-container-outer.ytd-watch-flexy { max-width: 100% !important; }
    #secondary.ytd-watch-flexy { width: 100% !important; }`,
  },
} as const

export type YoutubeStyleAction = keyof typeof YOUTUBE_STYLES
export type YoutubeStyleState = Partial<Record<(typeof YOUTUBE_STYLES)[YoutubeStyleAction]["settingKey"], boolean>>

const YOUTUBE_STYLE_ENTRIES = Object.values(YOUTUBE_STYLES)
export const YOUTUBE_STYLE_SETTING_KEYS = YOUTUBE_STYLE_ENTRIES.map(({ settingKey }) => settingKey)

export function cssForYoutubeStyles(state: YoutubeStyleState): string {
  return YOUTUBE_STYLE_ENTRIES
    .filter(({ settingKey }) => state[settingKey] === true)
    .map(({ css }) => css)
    .join("\n")
}
