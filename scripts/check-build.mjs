import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { Script } from "node:vm"

const root = resolve("dist")
const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"))
assert.equal(manifest.background.type, "module")
const paths = [manifest.action.default_popup, manifest.background.service_worker,
  ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap((entry) => entry.js)]
for (const file of paths) assert.ok(existsSync(resolve(root, file)), `Missing manifest asset: ${file}`)
const worker = readFileSync(resolve(root, manifest.background.service_worker), "utf8")
for (const match of worker.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
  assert.ok(existsSync(resolve(root, dirname(manifest.background.service_worker), match[1])), `Missing worker import: ${match[1]}`)
}
for (const match of worker.matchAll(/["'](scripts\/[^"']+\.js)["']/g)) {
  assert.ok(existsSync(resolve(root, match[1])), `Missing injected script: ${match[1]}`)
}
const playback = readFileSync(resolve(root, "scripts/playbackRatePersist.js"), "utf8")
new Script(playback)
assert.ok(!existsSync(resolve(root, "scripts/changePlaybackRate.js")), "Obsolete playback script is still packaged")
console.log("Build assets, worker imports, injected scripts, and classic playback format verified")
