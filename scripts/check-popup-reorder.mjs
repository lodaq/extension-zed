// Run against an isolated Chrome instance with the built extension loaded.
// Usage: node scripts/check-popup-reorder.mjs http://127.0.0.1:<debugging-port>
import assert from "node:assert/strict"

const endpoint = process.argv[2]
if (!endpoint) throw new Error("Supply an isolated Chrome debugging endpoint")
const sockets = []
const targets = async () => (await (await fetch(`${endpoint}/json/list`)).json())
const pause = () => new Promise(resolve => setTimeout(resolve, 25))
async function until(read, accept) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await read()
    if (accept(value)) return value
    await pause()
  }
  throw new Error("Timed out waiting for popup state")
}
async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  sockets.push(socket)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  socket.addEventListener("message", event => {
    const response = JSON.parse(event.data)
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    clearTimeout(request.timer)
    if (response.error) request.reject(new Error(response.error.message))
    else request.resolve(response.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`Timed out: ${method}`)) }, 5000)
    pending.set(requestId, { resolve, reject, timer })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  return { send, evaluate }
}

try {
  const pages = (await targets()).filter(target => target.type === "page" && target.url.startsWith("chrome-extension:"))
  // Keep a regular extension tab open to inspect storage without focusing the popup.
  let tab
  for (const page of pages) {
    const connection = await connect(page)
    await until(() => connection.evaluate('Boolean(globalThis.chrome?.extension?.getViews)'), Boolean)
    if (!await connection.evaluate('chrome.extension.getViews({type:"popup"}).includes(window)')) { tab = connection; break }
  }
  assert.ok(tab, "Open the extension URL in a regular tab first")
  await tab.evaluate('chrome.extension.getViews({type:"popup"}).forEach(view => view.close())')
  await tab.evaluate('chrome.storage.local.set({popupActiveTab:"misc", miscSectionOrder:["password","playback","volume","quality","colors","scrollbars","modes"], miscExpandedSections:[]})')
  const openPopup = async () => {
    const previous = new Set((await targets()).map(target => target.id))
    await tab.send("Page.bringToFront")
    await tab.evaluate(`(async () => {
      const current = await chrome.windows.getCurrent();
      await chrome.windows.update(current.id, {focused:true});
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await chrome.windows.getCurrent()).focused) return chrome.action.openPopup({windowId:current.id});
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error('Isolated browser window did not gain focus');
    })()`)
    const page = await until(targets, list => list.some(target => !previous.has(target.id) && target.type === "page" && target.url.startsWith("chrome-extension:")))
    const target = page.find(target => !previous.has(target.id) && target.type === "page" && target.url.startsWith("chrome-extension:"))
    const connection = await connect(target)
    await until(() => connection.evaluate('document.querySelectorAll("details").length'), count => count === 7)
    return { ...connection, id: target.id }
  }
  const popup = await openPopup()
  assert.equal(await popup.evaluate(`Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).every(handle => {
    const summary = handle.closest('[data-misc-section-id]').querySelector('summary').getBoundingClientRect();
    const bounds = handle.getBoundingClientRect();
    return bounds.left >= summary.left && bounds.right <= summary.right && bounds.top >= summary.top && bounds.bottom <= summary.bottom;
  })`), true, "Every reorder handle belongs inside its collapsible title row")
  assert.equal(await popup.evaluate(`Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).some(handle => handle.draggable)`), false, "Reorder handles must not start Chrome native drags")
  const points = await popup.evaluate(`(() => {
    const handles = document.querySelectorAll('button[aria-label^="Reorder "]');
    const source = handles[0].getBoundingClientRect();
    const destination = handles[3].closest('[data-misc-section-id]').getBoundingClientRect();
    return {x:source.x+source.width/2, y:source.y+source.height/2, endY:destination.bottom-4};
  })()`)
  await popup.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: points.x, y: points.y })
  // A handle click must not write an order or expand its section.
  await popup.send("Input.dispatchMouseEvent", { type: "mousePressed", x: points.x, y: points.y, button: "left", clickCount: 1 })
  await popup.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: points.x, y: points.y, button: "left", clickCount: 1 })
  assert.equal(await popup.evaluate('Array.from(document.querySelectorAll("details")).some(section => section.open)'), false)
  // Returning to the start after crossing a row must discard the stale target.
  await popup.send("Input.dispatchMouseEvent", { type: "mousePressed", x: points.x, y: points.y, button: "left", clickCount: 1 })
  await popup.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: points.x, y: points.endY, buttons: 1 })
  await popup.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: points.x, y: points.y, buttons: 1 })
  await popup.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: points.x, y: points.y, button: "left", clickCount: 1 })
  assert.deepEqual(await until(() => tab.evaluate('(async () => (await chrome.storage.local.get("miscSectionOrder")).miscSectionOrder)()'), value => value.join(",") === "password,playback,volume,quality,colors,scrollbars,modes"), ["password", "playback", "volume", "quality", "colors", "scrollbars", "modes"])
  // Dragging forward reorders and saves storage.
  const expected = ["playback", "volume", "quality", "password", "colors", "scrollbars", "modes"]
  await pause()
  await popup.send("Input.dispatchMouseEvent", { type: "mousePressed", x: points.x, y: points.y, button: "left", clickCount: 1 })
  await popup.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: points.x, y: points.endY, buttons: 1 })
  // Repeated movement within the same insertion target must preserve the drop.
  await popup.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: points.x, y: points.endY - 1, buttons: 1 })
  await pause()
  await popup.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: points.x, y: points.endY, button: "left", clickCount: 1 })
  const stored = await until(() => tab.evaluate('(async () => (await chrome.storage.local.get("miscSectionOrder")).miscSectionOrder)()'), value => JSON.stringify(value) === JSON.stringify(expected))
  assert.deepEqual(stored, expected)
  // Collapsed sections should not mount controls or load their feature code.
  assert.equal(await popup.evaluate(`document.querySelector('[aria-label="Generated password"]') !== null`), false)
  const passwordSummary = '[data-misc-section-id="password"] summary'
  await popup.evaluate(`document.querySelector('${passwordSummary}').click()`)
  const password = await until(() => popup.evaluate(`document.querySelector('[aria-label="Generated password"]')?.value`), Boolean)
  await popup.evaluate(`document.querySelector('${passwordSummary}').click()`)
  await until(() => popup.evaluate(`document.querySelector('[data-misc-section-id="password"] details').open`), value => !value)
  await until(() => tab.evaluate('(async () => (await chrome.storage.local.get("miscExpandedSections")).miscExpandedSections)()'), value => Array.isArray(value) && !value.includes("password"))
  await popup.evaluate(`document.querySelector('${passwordSummary}').click()`)
  assert.equal(await popup.evaluate(`document.querySelector('[aria-label="Generated password"]').value`), password, "Closing a section preserves its state")
  await until(() => tab.evaluate('(async () => (await chrome.storage.local.get("miscExpandedSections")).miscExpandedSections)()'), value => value?.includes("password"))
  await tab.evaluate('chrome.extension.getViews({type:"popup"}).forEach(view => view.close())')
  const reopened = await openPopup()
  await until(() => reopened.evaluate(`document.querySelector('[aria-label="Generated password"]')?.value`), Boolean)
  assert.equal(await reopened.evaluate(`document.querySelector('[data-misc-section-id="password"] details').open`), true, "Saved expanded sections load on startup")
  console.log("popup drag reorder and lazy sections: ok")
} finally {
  for (const socket of sockets) {
    try { socket.close() } catch {}
  }
}
