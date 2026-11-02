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
  await tab.evaluate('chrome.storage.local.set({popupActiveTab:"misc", miscSectionOrder:["password","playback","volume","colors","scrollbars","modes"], miscExpandedSections:[]})')
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
    await until(() => connection.evaluate('document.querySelectorAll("details").length'), count => count === 6)
    return { ...connection, id: target.id }
  }
  const popup = await openPopup()
  assert.equal(await popup.evaluate(`Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).every(handle => {
    const summary = handle.closest('[data-misc-section]').querySelector('summary').getBoundingClientRect();
    const bounds = handle.getBoundingClientRect();
    return bounds.left >= summary.left && bounds.right <= summary.right && bounds.top >= summary.top && bounds.bottom <= summary.bottom;
  })`), true, "Every reorder handle belongs inside its collapsible title row")
  assert.equal(await popup.evaluate(`Array.from(document.querySelectorAll('button[aria-label^="Reorder "]')).some(handle => handle.draggable)`), false, "Reorder handles must not start Chrome native drags")
  const points = await popup.evaluate(`(() => {
    const handles = document.querySelectorAll('button[aria-label^="Reorder "]');
    const source = handles[0].getBoundingClientRect();
    const destination = handles[3].closest('[data-misc-section]').getBoundingClientRect();
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
  assert.deepEqual(await tab.evaluate('(async () => (await chrome.storage.local.get("miscSectionOrder")).miscSectionOrder)()'), ["password", "playback", "volume", "colors", "scrollbars", "modes"])
  await popup.send("Input.dispatchMouseEvent", { type: "mousePressed", x: points.x, y: points.y, button: "left", clickCount: 1 })
  for (let step = 1; step <= 12; step++) {
    await popup.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: points.x, y: points.y + (points.endY - points.y) * step / 12, buttons: 1 })
  }
  await popup.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: points.x, y: points.endY, button: "left", clickCount: 1 })
  assert.ok((await targets()).some(target => target.id === popup.id), "Toolbar popup closed during drop")
  const expected = ["playback", "volume", "colors", "password", "scrollbars", "modes"]
  const stored = await until(() => tab.evaluate('(async () => (await chrome.storage.local.get("miscSectionOrder")).miscSectionOrder)()'), value => JSON.stringify(value) === JSON.stringify(expected))
  assert.deepEqual(stored, expected)
  await popup.evaluate("window.close()")
  await until(targets, list => !list.some(target => target.id === popup.id))
  const reopened = await openPopup()
  const headings = await until(() => reopened.evaluate('Array.from(document.querySelectorAll("details h2"), heading => heading.textContent)'), value => value[0] === "Playback speed")
  assert.deepEqual(headings, ["Playback speed", "Volume boost", "Page colors", "Password generator", "Scrollbars", "Modes"])
  const clickFirstSummary = async popup => {
    const point = await popup.evaluate(`(() => {
      const bounds = document.querySelector("details summary").getBoundingClientRect();
      return {x:bounds.x+bounds.width/2, y:bounds.y+bounds.height/2};
    })()`)
    await popup.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 })
    await popup.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 })
  }
  await clickFirstSummary(reopened)
  assert.equal(await reopened.evaluate('document.querySelector("details").open'), true)
  assert.deepEqual(await until(
    () => tab.evaluate('(async () => (await chrome.storage.local.get("miscExpandedSections")).miscExpandedSections)()'),
    value => JSON.stringify(value) === JSON.stringify(["playback"]),
  ), ["playback"])
  await reopened.evaluate("window.close()")
  await until(targets, list => !list.some(target => target.id === reopened.id))
  const expandedAgain = await openPopup()
  assert.equal(await expandedAgain.evaluate('document.querySelector("details").open'), true)
  await clickFirstSummary(expandedAgain)
  assert.equal(await expandedAgain.evaluate('document.querySelector("details").open'), false)
  assert.deepEqual(await until(
    () => tab.evaluate('(async () => (await chrome.storage.local.get("miscExpandedSections")).miscExpandedSections)()'),
    value => Array.isArray(value) && value.length === 0,
  ), [])
  await expandedAgain.evaluate("window.close()")
  await until(targets, list => !list.some(target => target.id === expandedAgain.id))
  console.log("Toolbar popup stayed open through pointer drop; section order and expanded state survived closing and reopening.")
} finally {
  for (const socket of sockets) socket.close()
}
