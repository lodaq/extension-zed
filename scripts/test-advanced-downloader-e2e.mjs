import assert from "node:assert/strict"
import { DevToolsClient, EXTENSION_DIST, parseTextContent } from "./test-browser.mjs"

const client = new DevToolsClient()
async function call(name, args) {
  const result = await client.callTool(name, args)
  assert.ok(!result.isError, `${name}: ${parseTextContent(result)}`)
  return parseTextContent(result)
}
async function evaluate(fn, worker) {
  return call("evaluate_script", { ...(worker ? { serviceWorkerId: worker } : { pageId: 1 }), function: fn })
}
async function check(fn) {
  const result = await evaluate(fn)
  assert.match(result, /\btrue\b/, result)
}
async function shot(name) {
  await check(`() => document.querySelector('.zed-shell').scrollWidth <= 640 && document.querySelector('.zed-content').scrollWidth <= document.querySelector('.zed-content').clientWidth`)
  console.log(`✓ ${name}`)
}

try {
  await client.start()
  await call("install_extension", { path: EXTENSION_DIST })
  const id = (await call("list_extensions")).match(/[a-p]{32}/)?.[0]
  assert.ok(id)
  const url = `chrome-extension://${id}/index.html`
  const navigation = await call("navigate_page", { pageId: 1, url })
  const worker = navigation.match(/sw-\d+/)?.[0]
  assert.ok(worker, navigation)
  await evaluate(`() => { chrome.runtime.connectNative = () => { throw new Error('Specified native messaging host not found.'); }; }`, worker)
  await call("resize_page", { pageId: 1, width: 640, height: 600 })
  await evaluate(`async () => {
    document.documentElement.style.setProperty('--zed-popup-width', '640px');
    document.documentElement.style.setProperty('--zed-popup-h', '600px');
    document.querySelector('#zed-tool-advanced-downloader').click();
    await new Promise(r => setTimeout(r, 100));
  }`)
  await shot("setup")
  await evaluate(`async () => { [...document.querySelectorAll('button')].find(b => b.textContent === 'Check again').click(); await new Promise(r => setTimeout(r, 100)); }`)
  await check(`() => document.querySelectorAll('[role=alert]').length === 1 && document.body.textContent.includes('Specified native messaging host not found.')`)
  await check(`async () => {
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Setup commands').click()
    const url = chrome.runtime.getURL('downloader-setup.html')
    for (let attempt = 0; attempt < 50; attempt++) {
      const [tab] = await chrome.tabs.query({ url })
      if (tab?.status === 'complete') {
        try {
          const html = await fetch(url).then(response => response.text())
          const guide = new DOMParser().parseFromString(html, 'text/html')
          return ['python3', 'python'].every(python => [...guide.querySelectorAll('button[data-python]')].some(button => button.dataset.python === python)) &&
            (await fetch(chrome.runtime.getURL('downloader-setup-data.js'))).ok &&
            ['apt', 'pacman', 'Homebrew', 'WinGet'].every(manager => html.includes(manager))
        } finally {
          await chrome.tabs.remove(tab.id)
        }
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  }`)
  // Mock only the native transport in this disposable profile. All popup/worker code is real.
  await evaluate(`() => {
    let listeners = [];
    const media = { title: 'A sample video', uploader: 'Example creator', host: 'example.com', duration: 123,
      video: [ { id: 'video:2160', label: '2160p', meta: 'WebM · VP9 · 30 fps', size: 800000000, approximate: true, tags: ['Best quality'] },
        { id: 'video:1080', label: '1080p', meta: 'MP4 · H.264 · 30 fps', size: 214000000, approximate: false, tags: ['Most compatible'] } ],
      audio: [ { id: 'audio:aac', label: 'M4A · AAC', meta: 'M4A · AAC · 128 kbps', size: 5000000, approximate: true, tags: ['Recommended'] },
        { id: 'mp3:aac', label: 'MP3 · Converted', meta: '128 kbps', size: 0, approximate: true, tags: [] } ] };
    let state = { phase: 'ready', version: '2026.11.17', ffmpeg: true };
    globalThis.zedTestEmit = patch => { state = { ...state, ...patch }; listeners.forEach(fn => fn({ event: 'state', state })); };
    chrome.runtime.connectNative = () => ({
      onMessage: { addListener: fn => listeners.push(fn) }, onDisconnect: { addListener: () => {} }, disconnect: () => {},
      postMessage: request => {
        if (request.command === "download") globalThis.zedTestFormat = request.formatId;
        const phase = { ping: 'ready', formats: 'reading', download: 'downloading', cancel: 'results', reset: 'ready', update: 'ready' }[request.command];
        if (phase) globalThis.zedTestEmit({ phase, ...(request.command === 'formats' ? { url: request.url } : {}),
          ...(request.command === 'download' ? { pct: 25, downloaded: 50000000, total: 214000000, speed: 3000000, eta: 55, stage: 'Downloading…' } : {}),
          ...(request.command === 'reset' ? { media: undefined, url: '' } : {}) });
        listeners.forEach(fn => fn({ id: request.id, ok: true, state }));
      }
    });
    globalThis.zedTestMedia = media;
  }`, worker)
  await call("navigate_page", { pageId: 1, url })
  await check(`async () => { await new Promise(r => setTimeout(r, 200)); document.documentElement.style.setProperty('--zed-popup-width', '640px'); document.documentElement.style.setProperty('--zed-popup-h', '600px'); return !!document.getElementById('zed-video-link'); }`)
  await shot("ready")
  await evaluate(`async () => { document.querySelector('form').requestSubmit(); await new Promise(r => setTimeout(r, 50)); }`)
  await check(`() => document.body.textContent.includes('Paste a link first.') && document.activeElement.id === 'zed-video-link'`)
  await shot("validation")
  await evaluate(`async () => {
    const input = document.getElementById('zed-video-link');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://example.com/watch');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50)); document.querySelector('form').requestSubmit();
    await new Promise(r => setTimeout(r, 100));
  }`)
  await shot("busy")
  await evaluate(`() => globalThis.zedTestEmit({ phase: 'error', error: 'This video is unavailable' })`, worker)
  await shot("error")
  await evaluate(`() => globalThis.zedTestEmit({ phase: 'results', media: globalThis.zedTestMedia })`, worker)
  await check(`() => document.querySelector('[role=radio][aria-checked=true]').textContent.includes('1080p')`)
  await shot("video")
  await evaluate(`async () => { const radio = document.querySelector('[role=radio][aria-checked=true]'); radio.focus(); radio.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })); await new Promise(r => setTimeout(r, 50)); }`)
  await check(`() => document.activeElement.getAttribute('aria-checked') === 'true' && document.activeElement.textContent.includes('2160p')`)
  await evaluate(`async () => { [...document.querySelectorAll('button')].find(b => b.textContent === 'Audio only').click(); await new Promise(r => setTimeout(r, 50)); }`)
  await shot("audio")
  await evaluate(`() => [...document.querySelectorAll('[role=radio]')].find(button => button.textContent.includes("MP3")).click()`)
  await evaluate(`async () => { [...document.querySelectorAll('button')].find(b => b.textContent === 'Download').click(); await new Promise(r => setTimeout(r, 100)); }`)
  await shot("downloading")
  assert.match(await evaluate(`() => globalThis.zedTestFormat`, worker), /mp3:aac/)
  await call("navigate_page", { pageId: 1, url: "about:blank" })
  await evaluate(`() => globalThis.zedTestEmit({ phase: 'downloading', pct: 70 })`, worker)
  await call("navigate_page", { pageId: 1, url })
  await evaluate(`() => { document.documentElement.style.setProperty('--zed-popup-width', '640px'); document.documentElement.style.setProperty('--zed-popup-h', '600px'); }`)
  await check(`async () => { await new Promise(r => setTimeout(r, 200)); return document.body.textContent.includes('70%') && document.body.textContent.includes('Cancel download'); }`)
  await evaluate(`() => globalThis.zedTestEmit({ phase: 'done', filename: 'A_sample_video.mp4', size: 214000000, summary: '1080p · MP4' })`, worker)
  await shot("done")
  await check(`() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Show in folder')`)
  await call("resize_page", { pageId: 1, width: 320, height: 600 })
  await check(`() => document.querySelector('.zed-content').scrollWidth <= document.querySelector('.zed-content').clientWidth`)
  console.log("Advanced downloader browser checks passed.")
} finally {
  await client.close()
}
