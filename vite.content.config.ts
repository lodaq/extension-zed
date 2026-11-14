import { defineConfig } from "vite"

const playback = defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/content/playback.ts",
      formats: ["iife"],
      name: "ZedPlayback",
      fileName: () => "scripts/playbackRatePersist.js",
    },
  },
})

export default defineConfig(({mode}) => mode === "shortcuts" ? { ...playback, build: { ...playback.build, lib: { entry: "src/content/shortcuts.ts", formats: ["iife"], name: "ZedShortcuts", fileName: () => "scripts/shortcuts.js" } } } : playback)
