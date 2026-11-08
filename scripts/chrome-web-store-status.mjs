import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fetchCwsItemStatus, getCwsAccessToken } from "./chrome-web-store-api.mjs"

const args = process.argv.slice(2)
const jsonOutput = args.includes("--json")

function optionValue(name) {
  const inline = args.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = args.indexOf(name)
  if (index >= 0) {
    const value = args[index + 1]
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a path`)
    return value
  }
  return undefined
}

function readEnvFile(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2")
  }
  return values
}

const envFile = optionValue("--env-file")
if (envFile) {
  Object.assign(process.env, readEnvFile(await readFile(resolve(envFile), "utf8")), process.env)
}

const manifestPath = resolve(optionValue("--manifest") ?? "public/manifest.json")
const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
const accessToken = await getCwsAccessToken()
const status = await fetchCwsItemStatus(
  accessToken,
  process.env.CWS_PUBLISHER_ID,
  process.env.CWS_EXTENSION_ID
)

const published = status.publishedItemRevisionStatus
const submitted = status.submittedItemRevisionStatus
const publishedVersion = published?.distributionChannels?.[0]?.crxVersion ?? null
const submittedVersion = submitted?.distributionChannels?.[0]?.crxVersion ?? null
const result = {
  itemId: status.itemId ?? process.env.CWS_EXTENSION_ID,
  localVersion: manifest.version ?? null,
  publishedVersion,
  publishedState: published?.state ?? null,
  submittedVersion,
  submittedState: submitted?.state ?? null,
  upToDate: Boolean(publishedVersion && manifest.version === publishedVersion),
  pendingReview: submitted?.state === "PENDING_REVIEW",
}

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`Chrome Web Store item: ${result.itemId}`)
  console.log(`Local version: ${result.localVersion ?? "unknown"}`)
  console.log(`Published version: ${result.publishedVersion ?? "not published"} (${result.publishedState ?? "none"})`)
  console.log(`Submitted version: ${result.submittedVersion ?? "none"} (${result.submittedState ?? "none"})`)
  console.log(`Up to date: ${result.upToDate ? "yes" : "no"}`)
  console.log(`Pending review: ${result.pendingReview ? "yes" : "no"}`)
}
