import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { zipSync } from "fflate"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const dist = join(root, "dist")
const artifacts = join(root, "artifacts")
const manifestPath = join(dist, "manifest.json")
const packagePath = join(root, "package.json")

const [manifest, packageInfo] = await Promise.all([
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(packagePath, "utf8").then(JSON.parse),
])

if (manifest.version !== packageInfo.version) {
  throw new Error(
    `Version mismatch: manifest is ${manifest.version}, package.json is ${packageInfo.version}`
  )
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = {}

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      Object.assign(files, await collectFiles(path))
    } else if (entry.isFile()) {
      const archivePath = relative(dist, path).split(sep).join("/")
      files[archivePath] = new Uint8Array(await readFile(path))
    }
  }

  return files
}

const files = await collectFiles(dist)
if (!files["manifest.json"]) throw new Error("Built package is missing manifest.json")

await mkdir(artifacts, { recursive: true })
const output = join(artifacts, `extension-zed-v${manifest.version}.zip`)
await writeFile(output, zipSync(files, { level: 9 }))
console.log(`Packaged ${Object.keys(files).length} files: ${relative(root, output)}`)
