import { defineConfig } from "vite"

export default defineConfig({
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
