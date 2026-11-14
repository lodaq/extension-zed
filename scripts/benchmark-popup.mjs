import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { rmSync, mkdirSync } from 'node:fs'

const PORT = 38999
const EXT_PATH = '/home/sebaq/repos/extension-zed/dist'
const PROFILE_DIR = '/tmp/zed-bench-profile'
const EXT_ID = 'apdiglgkoffmefeejgokhplnohmlclca'
const BASE = `http://127.0.0.1:${PORT}`
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

try { rmSync(PROFILE_DIR, { recursive: true, force: true }) } catch {}
mkdirSync(PROFILE_DIR, { recursive: true })

const brave = spawn('brave', [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE_DIR}`,
  `--load-extension=${EXT_PATH}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], {
  env: { ...process.env, TMPDIR: '/tmp' },
  stdio: 'ignore'
})

brave.on('error', (err) => {
  console.error('Brave error:', err)
  process.exit(1)
})

async function cleanup() {
  try { brave.kill('SIGKILL') } catch {}
}
process.on('exit', cleanup)
process.on('SIGINT', cleanup)

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${BASE}/json/version`)
      if (res.ok) return true
    } catch {}
    await pause(50)
  }
  throw new Error('Brave did not start in time')
}

function connect(url) {
  const ws = new WebSocket(url)
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id
    pending.set(n, { resolve, reject })
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
  return { ws, send, evaluate, ready: new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }) }) }
}

const targets = async () => (await (await fetch(`${BASE}/json/list`)).json())
const isPopup = (t) => t.type === 'page' && t.url.startsWith('chrome-extension:')

async function run() {
  await waitReady()
  const created = await (await fetch(`${BASE}/json/new?chrome-extension://${EXT_ID}/index.html`, { method: 'PUT' })).json()
  const tab = connect(created.webSocketDebuggerUrl)
  await tab.ready
  for (let i = 0; i < 100; i++) {
    if (await tab.evaluate('Boolean(globalThis.chrome?.action?.openPopup)').catch(() => false)) break
    await pause(25)
  }

  const samples = []
  for (let i = 0; i < 3; i++) {
    await tab.evaluate('chrome.extension.getViews({type:"popup"}).forEach(view => view.close())')
    await pause(50)

    const before = new Set((await targets()).map((t) => t.id))
    await tab.evaluate(`(async () => {
      const current = await chrome.windows.getCurrent();
      await chrome.windows.update(current.id, { focused: true });
      for (let i = 0; i < 200; i++) {
        if ((await chrome.windows.getCurrent()).focused) return chrome.action.openPopup({ windowId: current.id });
        await new Promise((r) => setTimeout(r, 5));
      }
    })()`)

    let target = null
    for (let j = 0; j < 300; j++) {
      target = (await targets()).find((t) => !before.has(t.id) && isPopup(t))
      if (target) break
      await pause(5)
    }

    assert.ok(target, 'Toolbar popup did not open')
    const popup = connect(target.webSocketDebuggerUrl)
    await popup.ready

    let state = null
    for (let j = 0; j < 200; j++) {
      state = await popup.evaluate(`(() => {
        const paints = Object.fromEntries(performance.getEntriesByType('paint').map(e => [e.name, +e.startTime.toFixed(1)]));
        const navigation = [...document.querySelectorAll('nav button')];
        const tiles = [...document.querySelectorAll('.zed-tile')];
        const ready = ['Misc', 'Extensions', 'YouTube', 'Links', 'Saved', 'Shortcuts'].every(name =>
          navigation.some(button => button.textContent === name)) &&
          ['Playback speed', 'Video quality', 'Password generator', 'Volume boost', 'Scrollbars', 'Modes', 'Capture screenshot', 'Save & close tab'].every(name =>
            tiles.some(button => button.textContent.includes(name)));
        const nav = performance.getEntriesByType('navigation')[0];
        const marks = Object.fromEntries(performance.getEntriesByType('mark').map(m => [m.name, +m.startTime.toFixed(1)]));
        return {
          fcp: paints['first-contentful-paint'] ?? null,
          fp: paints['first-paint'] ?? null,
          dcl: nav ? +nav.domContentLoadedEventEnd.toFixed(1) : null,
          load: nav ? +nav.loadEventEnd.toFixed(1) : null,
          marks,
          now: +performance.now().toFixed(1),
          ready
        };
      })()`).catch(() => null)
      if (state?.ready && state.fcp) break
      await pause(5)
    }
    assert.ok(state?.ready && state.fcp, 'Toolbar popup did not become ready')
    // Buffered entries include paints before CDP attached; allow late candidates.
    state.lcp = await popup.evaluate(`new Promise(resolve => {
      let latest = null;
      const observer = new PerformanceObserver(list => {
        latest = list.getEntries().at(-1).startTime;
      });
      observer.observe({type: 'largest-contentful-paint', buffered: true});
      setTimeout(() => { observer.disconnect(); resolve(latest); }, 1000);
    })`)
    assert.ok(Number.isFinite(state.lcp) && state.lcp > 0, 'Missing popup LCP measurement')
    samples.push(state)
    popup.ws.close()
  }

  tab.ws.close()
  await cleanup()
  console.log(JSON.stringify(samples, null, 2))
  const values = samples.map(sample => sample.lcp).sort((a, b) => a - b)
  const median = values[1]
  console.log(`Toolbar popup LCP: median ${median} ms; range ${values[0]}–${values[2]} ms`)
  assert.ok(median < 1000, `Popup LCP budget exceeded: ${median} ms (must be below 1000 ms)`)
}

run().catch((e) => {
  console.error(e)
  cleanup()
  process.exit(1)
})
