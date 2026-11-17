import { defineConfig } from "vite"

const builds = {
  playback: { entry: "src/content/playback.ts", name: "ZedPlayback", fileName: "scripts/playbackRatePersist.js" },
  shortcuts: { entry: "src/content/shortcuts.ts", name: "ZedShortcuts", fileName: "scripts/shortcuts.js" },
  youtube: { entry: "src/content/youtubeStyles.ts", name: "ZedYoutubeStyles", fileName: "scripts/youtubeStyles.js" },
} as const

export default defineConfig(({ mode }) => {
  const build = builds[mode as keyof typeof builds] ?? builds.playback
  return {
    publicDir: false,
    build: {
      emptyOutDir: false,
      lib: {
        entry: build.entry,
        formats: ["iife"],
        name: build.name,
        fileName: () => build.fileName,
      },
    },
  }
})
