import { execFileSync, spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"

const required = [
  "CWS_CLIENT_ID",
  "CWS_CLIENT_SECRET",
  "CWS_REFRESH_TOKEN",
  "CWS_PUBLISHER_ID",
  "CWS_EXTENSION_ID",
]
const dryRun = process.argv.includes("--dry-run")
const envFileArg = process.argv.find((arg) => arg.startsWith("--env-file="))
const envFile = envFileArg ? envFileArg.slice("--env-file=".length) : ".env.local"

function parseEnv(text) {
  const values = new Map()
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!match || match[1].startsWith("#")) continue
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2")
    values.set(match[1], value)
  }
  return values
}

const values = parseEnv(await readFile(envFile, "utf8"))
const missing = required.filter((name) => !values.get(name))
if (missing.length) {
  throw new Error(`Missing values in ${envFile}: ${missing.join(", ")}`)
}

const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
  encoding: "utf8",
}).trim()
const repositoryMatch = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/)
if (!repositoryMatch) throw new Error("Could not determine the GitHub owner/repository from origin.")
const repository = repositoryMatch[1]

if (dryRun) {
  console.log(`Would upload ${required.length} repository secrets to ${repository}: ${required.join(", ")}`)
  process.exit(0)
}

const auth = spawnSync("gh", ["auth", "status"], { stdio: "ignore" })
if (auth.error || auth.status !== 0) {
  throw new Error("GitHub CLI is not authenticated. Run `gh auth login` and try again.")
}

for (const name of required) {
  const result = spawnSync("gh", ["secret", "set", name, "--repo", repository], {
    input: values.get(name),
    encoding: "utf8",
    stdio: ["pipe", "ignore", "pipe"],
  })
  if (result.error || result.status !== 0) {
    throw new Error(`Could not upload ${name} to ${repository}: ${result.stderr?.trim() || "gh failed"}`)
  }
}

console.log(`Uploaded ${required.length} CWS secrets to ${repository}. Secret values were not printed.`)
