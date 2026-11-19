import { watch } from "node:fs"
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { zipSync } from "fflate"
import postcss from "postcss"
import tailwind from "@tailwindcss/postcss"
import autoprefixer from "autoprefixer"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const popupCssEntry = join(root, "src/main.css")
const watchMode = process.argv.includes("--watch")

const define = {
  "import.meta.env.VITE_VIDEO_DOWNLOADER": JSON.stringify(process.env.VITE_VIDEO_DOWNLOADER ?? "true"),
  "process.env.NODE_ENV": '"production"',
}

const contentScripts = [
  { entry: "src/content/playback.ts", output: "scripts/playbackRatePersist.js" },
  { entry: "src/content/shortcuts.ts", output: "scripts/shortcuts.js" },
  { entry: "src/content/youtubeStyles.ts", output: "scripts/youtubeStyles.js" },
]

async function inlineCssImports(filePath, css) {
  const pattern = /@import\s+(?:url\(\s*)?["'](\.{1,2}\/[^"']+)["']\s*\)?[^;]*;/g
  let output = ""
  let lastIndex = 0
  for (const match of css.matchAll(pattern)) {
    output += css.slice(lastIndex, match.index)
    const importedPath = resolve(dirname(filePath), match[1])
    const imported = await readFile(importedPath, "utf8")
    output += await inlineCssImports(importedPath, imported)
    lastIndex = (match.index ?? 0) + match[0].length
  }
  return output + css.slice(lastIndex)
}

function textAssets() {
  return {
    name: "zed-text-assets",
    setup(build) {
      build.onResolve({ filter: /\?(?:raw|inline)$/ }, (args) => {
        const kind = args.path.endsWith("?inline") ? "inline" : "raw"
        return {
          path: resolve(args.resolveDir, args.path.slice(0, -(kind.length + 1))),
          namespace: `zed-${kind}`,
        }
      })
      build.onLoad({ filter: /.*/, namespace: "zed-raw" }, async (args) => ({
        contents: await readFile(args.path, "utf8"),
        loader: "text",
      }))
      build.onLoad({ filter: /.*/, namespace: "zed-inline" }, async (args) => ({
        contents: await inlineCssImports(args.path, await readFile(args.path, "utf8")),
        loader: "text",
      }))
    },
  }
}

function stubPopupCss() {
  return {
    name: "zed-popup-css",
    setup(build) {
      build.onResolve({ filter: /(?:^|\/)main\.css$/ }, (args) => {
        if (resolve(args.resolveDir, args.path) !== popupCssEntry) return
        return { path: popupCssEntry, namespace: "zed-popup-css" }
      })
      build.onLoad({ filter: /.*/, namespace: "zed-popup-css" }, () => ({
        contents: "export default undefined",
        loader: "js",
      }))
    },
  }
}

async function compilePopupCss() {
  return (await postcss([tailwind(), autoprefixer()]).process(await readFile(popupCssEntry, "utf8"), {
    from: popupCssEntry,
  })).css
}

async function emitStaticAssets() {
  const fontFace = '@font-face{font-family:Inter;font-weight:100 900;font-display:swap;src:url("fonts/Inter.woff2") format("woff2")}\n'
  const tokens = (await readFile(join(root, "src/design-system/tokens.css"), "utf8")).replaceAll(":root", ":root, :host")
  const theme = (await readFile(join(root, "src/theme.css"), "utf8")).replace(/@import[^;]+;/g, "")
  await writeFile(join(dist, "theme.css"), fontFace + tokens + theme)
  await writeFile(join(dist, "scrollbar.css"), await readFile(join(root, "src/scrollbar.css"), "utf8"))
  await writeFile(join(dist, "downloader-setup.css"), await readFile(join(root, "src/design-system/downloader-setup.css"), "utf8"))

  const helperFiles = ["install.py", "zed_downloader.py", "native-launcher.cs"]
  const helperEntries = await Promise.all(helperFiles.map(async (name) => [name, await readFile(join(root, "downloader", name))]))
  const helper = zipSync(Object.fromEntries(helperEntries))
  const setup = {
    helper: Buffer.from(helper).toString("base64"),
    unix: await readFile(join(root, "downloader/setup-dependencies.sh"), "utf8"),
    windows: await readFile(join(root, "downloader/setup-dependencies.ps1"), "utf8"),
  }
  await writeFile(join(dist, "downloader-setup-data.js"), `export default ${JSON.stringify(setup)}\n`)
}

async function buildOnce() {
  await rm(dist, { recursive: true, force: true })
  await mkdir(dist, { recursive: true })
  await cp(join(root, "public"), dist, { recursive: true })

  const css = await compilePopupCss()
  const popup = await Bun.build({
    entrypoints: [join(root, "src/main.tsx")],
    outdir: dist,
    target: "browser",
    format: "esm",
    splitting: true,
    minify: true,
    define,
    naming: { entry: "assets/popup-[hash].[ext]", chunk: "assets/[name]-[hash].[ext]", asset: "assets/[name]-[hash].[ext]" },
    plugins: [stubPopupCss(), textAssets()],
  })
  if (!popup.success) throw new AggregateError(popup.logs, "Popup build failed")
  const popupScript = popup.outputs.find((output) => output.kind === "entry-point")
  if (!popupScript) throw new Error("Popup build did not emit a script")

  const safeCss = css.replace(/<\/style/gi, "<\\/style")
  const popupUrl = `/${relative(dist, popupScript.path).replaceAll("\\", "/")}`
  const html = (await readFile(join(root, "index.html"), "utf8"))
    .replace('<script type="module" src="/src/main.tsx"></script>', `<script type="module" src="${popupUrl}"></script>`)
    .replace("</head>", `<style>${safeCss}</style></head>`)
  await writeFile(join(dist, "index.html"), html)

  const background = await Bun.build({
    entrypoints: [join(root, "src/background.ts")],
    outdir: dist,
    target: "browser",
    format: "esm",
    minify: true,
    define,
    naming: { entry: "background.js" },
    plugins: [textAssets()],
  })
  if (!background.success) throw new AggregateError(background.logs, "Background build failed")

  for (const { entry, output } of contentScripts) {
    const result = await Bun.build({
      entrypoints: [join(root, entry)],
      outdir: dist,
      target: "browser",
      format: "iife",
      minify: true,
      define,
      naming: { entry: output },
      plugins: [textAssets()],
    })
    if (!result.success) throw new AggregateError(result.logs, `${output} build failed`)
  }

  await emitStaticAssets()
  console.log("Built extension into dist/")
}

if (!watchMode) {
  await buildOnce()
} else {
  let building = false
  let queued = false
  const rebuild = async () => {
    if (building) {
      queued = true
      return
    }
    building = true
    try {
      await buildOnce()
    } catch (error) {
      console.error(error)
    } finally {
      building = false
      if (queued) {
        queued = false
        void rebuild()
      }
    }
  }
  watch(join(root, "src"), { recursive: true }, () => void rebuild())
  watch(join(root, "public"), { recursive: true }, () => void rebuild())
  watch(join(root, "index.html"), () => void rebuild())
  await rebuild()
  console.log("Watching src/, public/, and index.html for changes…")
}
