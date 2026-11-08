import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { fetchCwsItemStatus, getCwsAccessToken, readJson, requireCwsEnvironment } from "./chrome-web-store-api.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
requireCwsEnvironment()

const [manifest, packageInfo] = await Promise.all([
  readFile(join(root, "public/manifest.json"), "utf8").then(JSON.parse),
  readFile(join(root, "package.json"), "utf8").then(JSON.parse),
])

if (manifest.version !== packageInfo.version) {
  throw new Error(
    `Version mismatch: manifest is ${manifest.version}, package.json is ${packageInfo.version}`
  )
}

function compareVersions(left, right) {
  const parts = (version) => {
    if (!/^\d+(?:\.\d+){0,3}$/.test(version)) {
      throw new Error(`Invalid extension version: ${version}`)
    }
    return version.split(".").map(Number)
  }
  const a = parts(left)
  const b = parts(right)

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

const accessToken = await getCwsAccessToken()
const itemPath = `publishers/${encodeURIComponent(process.env.CWS_PUBLISHER_ID)}/items/${encodeURIComponent(process.env.CWS_EXTENSION_ID)}`
const apiUrl = `https://chromewebstore.googleapis.com/v2/${itemPath}`
const headers = { authorization: `Bearer ${accessToken}` }
const status = await fetchCwsItemStatus(
  accessToken,
  process.env.CWS_PUBLISHER_ID,
  process.env.CWS_EXTENSION_ID
)

const latestPublished = status.publishedItemRevisionStatus
const publishedVersion = latestPublished?.distributionChannels?.[0]?.crxVersion
const submitted = status.submittedItemRevisionStatus
const submittedVersion = submitted?.distributionChannels?.[0]?.crxVersion

if (submittedVersion === manifest.version && ["PENDING_REVIEW", "STAGED"].includes(submitted?.state)) {
  console.log(`Version ${manifest.version} is already submitted (${submitted.state}); skipping.`)
  process.exit(0)
}

if (publishedVersion === manifest.version) {
  console.log(`Version ${manifest.version} is already published; skipping.`)
  process.exit(0)
}

if (!publishedVersion) {
  throw new Error("No published version found. Create and submit the first listing in the Developer Dashboard.")
}

if (compareVersions(manifest.version, publishedVersion) <= 0) {
  throw new Error(
    `Local version ${manifest.version} must be greater than the published version ${publishedVersion}.`
  )
}

const archivePath = join(root, "artifacts", `extension-zed-v${manifest.version}.zip`)
const archive = Bun.file(archivePath)
if (!(await archive.exists())) {
  throw new Error(`Package not found: ${archivePath}. Run bun run package:store first.`)
}

const upload = await readJson(
  await fetch(`https://chromewebstore.googleapis.com/upload/v2/${itemPath}:upload`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/zip" },
    body: await archive.arrayBuffer(),
  }),
  "Package upload"
)

let uploadState = upload.uploadState
if (uploadState === "IN_PROGRESS" || uploadState === "UPLOAD_IN_PROGRESS") {
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    const nextStatus = await readJson(
      await fetch(`${apiUrl}:fetchStatus`, { headers }),
      "Upload status request"
    )
    uploadState = nextStatus.lastAsyncUploadState
    if (uploadState !== "IN_PROGRESS") break
  }
}

if (uploadState !== "SUCCEEDED") {
  throw new Error(`Package upload did not succeed (state: ${uploadState ?? "missing"}).`)
}

await readJson(
  await fetch(`${apiUrl}:publish`, { method: "POST", headers }),
  "Publish request"
)
console.log(`Version ${manifest.version} uploaded and submitted for Chrome Web Store review.`)
