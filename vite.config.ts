import { readFileSync } from "node:fs"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Chrome extension pages cannot use inline scripts, but inline styles are
 * allowed. Inlining the popup stylesheet removes the render-blocking request
 * that otherwise delays the first-frame shell until the CSS file arrives.
 */
function inlinePopupCss(): Plugin {
  return {
    name: "inline-popup-css",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find(
        (file): file is Extract<typeof file, { type: "asset" }> =>
          file.type === "asset" && file.fileName.endsWith(".html"),
      )
      if (!html) return
      let source = String(html.source)
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue
        const link = new RegExp(`<link[^>]*href="[^"]*${escapeRegExp(file.fileName)}"[^>]*>`)
        if (!link.test(source)) continue
        const css = String(file.source).replace(/<\/style/gi, "<\\/style")
        source = source.replace(link, `<style>${css}</style>`)
        delete bundle[file.fileName]
      }
      html.source = source
    },
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export default defineConfig({
  plugins: [react(), inlinePopupCss(), {
    name: "extension-ui-styles",
    generateBundle() {
      for (const name of ["theme", "scrollbar"]) {
        this.emitFile({ type: "asset", fileName: `${name}.css`, source: name === "theme" ? '@font-face{font-family:Inter;font-weight:100 900;font-display:swap;src:url("fonts/Inter.woff2") format("woff2")}\n' + readFileSync("src/design-system/tokens.css", "utf8").replaceAll(":root", ":root, :host") + readFileSync("src/theme.css", "utf8").replace(/@import[^;]+;/g, "") : readFileSync(`src/${name}.css`, "utf8") })
      }
    },
  }],
  build: {
    rollupOptions: {
      input: { popup: "index.html", background: "src/background.ts" },
      output: { entryFileNames: (chunk) => chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js" },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
})
