import assert from "node:assert/strict"
import { createServer } from "node:http"
import { once } from "node:events"
import { DevToolsClient, EXTENSION_DIST, parseTextContent } from "./test-browser.mjs"

const client = new DevToolsClient()
const filename = `zed-e2e-${Date.now()}.wav`
const wave = Buffer.from("524946462500000057415645666d74201000000001000100401f0000401f000001000800646174610100000080", "hex")
const server = createServer((request, response) => {
  if (request.url === `/${filename}`) {
    response.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": wave.length })
    response.end(wave)
  } else {
    response.writeHead(200, { "Content-Type": "text/html" })
    response.end(`<a href="/${filename}">Media fixture</a>`)
  }
})
server.listen(0, "127.0.0.1")
await once(server, "listening")
const base = `http://127.0.0.1:${server.address().port}`

async function call(name, params) {
  const result = await client.callTool(name, params)
  const text = parseTextContent(result)
  assert.ok(!result.isError, `${name}: ${text}`)
  return text
}

async function check(fn) {
  const result = await call("evaluate_script", { pageId: 1, function: fn })
  assert.match(result, /\btrue\b/, result)
}

try {
  await client.start()
  await call("install_extension", { path: EXTENSION_DIST })
  const id = (await call("list_extensions")).match(/[a-p]{32}/)?.[0]
  assert.ok(id)
  await call("navigate_page", { pageId: 1, url: `chrome-extension://${id}/index.html` })
  await check(`async () => {
    await chrome.storage.local.set({ popupLocation: { tab: "Misc", detail: "downloader", settings: false } })
    return true
  }`)
  await call("wait_for", { pageId: 1, text: ["Media link"] })
  await check(`async () => {
    const send = (command, url) => chrome.runtime.sendMessage({ type: "downloader:command", command, url })
    const rejected = await send("download", ${JSON.stringify(base)})
    return rejected.state.phase === "error" && rejected.state.error.includes("webpage")
  }`)
  await check(`async () => {
    const url = ${JSON.stringify(base)}
    const tab = await chrome.tabs.create({ url })
    try {
      for (let i = 0; i < 50; i++) {
        if ((await chrome.tabs.get(tab.id)).status === "complete") break
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      const result = await chrome.runtime.sendMessage({ type: "downloader:command", command: "scan" })
      return result.state.sources.some(source => source.url === url + "/${filename}")
    } finally { await chrome.tabs.remove(tab.id) }
  }`)
  await check(`async () => {
    const send = (command, url) => chrome.runtime.sendMessage({ type: "downloader:command", command, url })
    const started = await send("download", ${JSON.stringify(`${base}/${filename}`)})
    const id = started.state.downloadId
    if (id === undefined) return started
    try {
      for (let i = 0; i < 50; i++) {
        const { state } = await send("state")
        if (state.phase === "done") return state.filename === ${JSON.stringify(filename)} && state.downloaded === ${wave.length}
        if (state.phase === "error") return state
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return false
    } finally {
      const [item] = await chrome.downloads.search({ id })
      if (item?.state === "complete") await chrome.downloads.removeFile(id)
      else await chrome.downloads.cancel(id)
      await chrome.downloads.erase({ id })
    }
  }`)
  await call("wait_for", { pageId: 1, text: ["Download complete"] })
  console.log("Downloader found page media, rejected HTML, and completed a real browser download.")
} finally {
  server.close()
  await client.close()
}
