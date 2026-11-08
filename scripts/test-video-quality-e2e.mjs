import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";

const EXTENSION_DIST = path.resolve("dist");
const CHROME_PATH = "/home/sebaq/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const USER_DATA_DIR = "/tmp/chrome-video-quality-test-profile";

class DevToolsClient {
  constructor() {
    this.proc = null;
    this.reqId = 1;
    this.pending = new Map();
    this.buffer = "";
  }

  async start() {
    if (fs.existsSync(USER_DATA_DIR)) {
      try {
        fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
      } catch {}
    }

    this.proc = spawn(
      "npx",
      [
        "-y",
        "chrome-devtools-mcp@latest",
        "--categoryExtensions",
        "--headless",
        `--userDataDir=${USER_DATA_DIR}`,
        `--executablePath=${CHROME_PATH}`,
        `--workspace=${path.resolve(".")}`,
        "--ignore-default-chrome-arg=--disable-extensions",
        "--chrome-arg=--no-sandbox",
        "--chrome-arg=--disable-setuid-sandbox",
        "--chrome-arg=--headless=new",
        "--no-usage-statistics",
      ],
      {
        stdio: ["pipe", "pipe", "inherit"],
        env: { ...process.env, TMPDIR: "/tmp" },
      }
    );

    this.proc.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString("utf8");
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch {}
      }
    });

    this.proc.on("exit", (code) => {
      for (const { reject } of this.pending.values()) reject(new Error(`MCP server exited with code ${code}`));
      this.pending.clear();
    });

    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "video-quality-e2e", version: "1.0.0" },
    });
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
  }

  async request(method, params = {}) {
    const id = this.reqId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  async callTool(name, args = {}) {
    return this.request("tools/call", { name, arguments: args });
  }

  async close() {
    if (this.proc) this.proc.kill("SIGTERM");
  }
}

function parseTextContent(toolResult) {
  if (!toolResult || !toolResult.content) return "";
  return toolResult.content.map((c) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n");
}

// Player API fixtures deliberately leave controls in place as input traps.
function playerPage(kind = "hls") {
  return `<!doctype html><html><head><title>Programmatic media fixture</title></head><body>
    <video id="video" controls playsinline muted></video>
    <div id="component"></div>
    <button aria-label="Settings" id="gear">Settings</button>
    <div role="menu" hidden><div role="menuitemradio">1080p</div></div>
    <iframe src="/frame" id="frame"></iframe>
    <iframe srcdoc="&lt;video id=srcdoc-video&gt;&lt;/video&gt;" id="srcdoc"></iframe>
    <script>
      window.inputEvents = 0;
      for (const type of ['click', 'keydown', 'pointerdown', 'pointermove', 'mousemove', 'mouseover']) {
        document.addEventListener(type, () => window.inputEvents++, true);
      }
      window.selected = null;
      window.attachPlayer = function(video) {
        if (${JSON.stringify(kind)} === 'hls') {
          video.hls = {
            media: video, levels: [{height:360}, {height:720}, {height:1080}],
            set loadLevel(index) { window.selected = index < 0 ? 'auto' : this.levels[index].height + 'p'; this.media.dataset.quality = window.selected; }
          };
        }
        if (${JSON.stringify(kind)} === 'videojs') {
          const levels = [360,720,1080].map(height => ({height, enabled:true}));
          window.videojs = {getPlayers: () => ({one: {currentSrc: () => 'fixture', qualityLevels: () => levels}})};
          window.readSelection = () => levels.filter(level => level.enabled).map(level => level.height + 'p').join(',');
        }
        if (${JSON.stringify(kind)} === 'shaka') {
          const tracks = [360,720,1080].map(height => ({id:height,height,language:'ar',audioId:1,active:height===360}));
          const player = {
            getVariantTracks: () => tracks,
            configure: config => { if (config.abr.enabled) window.selected = 'auto'; },
            selectVariantTrack: track => { window.selected = track.height + 'p'; }
          };
          video.ui = {getControls: () => ({getPlayer: () => player})};
        }
      };
      window.attachPlayer(document.getElementById('video'));
      const shadow = document.getElementById('component').attachShadow({mode:'open'});
      const shadowVideo = document.createElement('video');
      if (${JSON.stringify(kind)} === 'hls') window.attachPlayer(shadowVideo);
      shadow.append(shadowVideo);
    </script>
  </body></html>`;
}

function startServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (req.url === "/frame") res.end('<!doctype html><video id="frame-video"></video>');
    else res.end(playerPage(req.url.slice(1) || "hls"));
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

async function evaluate(client, pageId, fn) {
  const result = await client.callTool("evaluate_script", { pageId, function: fn });
  const text = parseTextContent(result);
  try {
    const match = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[1] ?? match[0]) : null;
  } catch {
    return null;
  }
}

async function setQuality(client, popupPageId, quality, fallback) {
  const result = await evaluate(
    client,
    popupPageId,
    `async () => {
      await chrome.storage.local.set({ videoQuality: ${JSON.stringify(quality)}, videoQualityFallback: ${JSON.stringify(fallback)} });
      return await chrome.storage.local.get(["videoQuality", "videoQualityFallback"]);
    }`
  );
  return result;
}

async function findPageId(client, url) {
  const pagesText = parseTextContent(await client.callTool("list_pages"));
  const line = pagesText.split("\n").find((entry) => entry.includes(url));
  if (!line) throw new Error(`Could not find page for ${url} in:\n${pagesText}`);
  const match = line.match(/(\d+):/);
  if (!match) throw new Error(`Could not parse page id from line: ${line}`);
  return Number(match[1]);
}

async function waitForState(client, pageId, expected) {
  const deadline = Date.now() + 7000;
  let state;
  do {
    state = await evaluate(client, pageId, `() => ({
      selected: window.readSelection ? window.readSelection() : window.selected,
      rate: document.querySelector('video').playbackRate,
      frameRate: document.getElementById('frame').contentDocument.querySelector('video').playbackRate,
      srcdocRate: document.getElementById('srcdoc').contentDocument.querySelector('video').playbackRate,
      shadowRate: document.getElementById('component').shadowRoot.querySelector('video').playbackRate,
      shadowQuality: document.getElementById('component').shadowRoot.querySelector('video').dataset.quality || null,
      input: window.inputEvents,
      menuHidden: document.querySelector('[role="menu"]').hidden,
      paused: document.querySelector('video').paused,
      time: document.querySelector('video').currentTime,
      engine: Boolean(window.__zedVideoQualityEngine)
    })`);
    if (state && Object.entries(expected).every(([key, value]) => state[key] === value)) return state;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(state)}`);
}

async function main() {
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const client = new DevToolsClient();
  let passed = 0;
  async function check(name, action) {
    await action();
    passed++;
    console.log(`✓ ${name}`);
  }
  try {
    await client.start();
    const installed = await client.callTool("install_extension", { path: EXTENSION_DIST });
    if (installed.isError) throw new Error(parseTextContent(installed));
    const list = parseTextContent(await client.callTool("list_extensions"));
    const extensionId = (list.match(/([a-p]{32})/) || [])[1];
    if (!extensionId) throw new Error(list);
    await client.callTool("navigate_page", { pageId: 1, url: `chrome-extension://${extensionId}/index.html` });
    await setQuality(client, 1, "hd1080", "lower");
    await evaluate(client, 1, `async () => { await chrome.storage.local.set({speed:'2'}); return true; }`);
    await client.callTool("new_page", { url: `${base}/hls` });
    const page = await findPageId(client, `${base}/hls`);

    await check("HLS quality and speed, including iframe, without input or playback changes", () => waitForState(client, page, {
      selected: "1080p", rate: 2, frameRate: 2, srcdocRate: 2, shadowRate: 2, shadowQuality: "1080p", input: 0, menuHidden: true, paused: true, time: 0,
    }));
    await check("Apply reports quality from the installed extension's actual script injection", async () => {
      await client.callTool("select_page", { pageId: page });
      const granted = await client.callTool("trigger_extension_action", { id: extensionId });
      if (granted.isError) throw new Error(parseTextContent(granted));
      const response = await evaluate(client, 1, `async () => chrome.runtime.sendMessage({event:'applyVideoQuality'})`);
      if (!response?.ok || response.message !== "Player quality set to 1080p") throw new Error(JSON.stringify(response));
    });
    await check("Changed settings apply to existing videos and frames", async () => {
      await evaluate(client, 1, `async () => { await chrome.storage.local.set({speed:'1.5'}); return true; }`);
      await setQuality(client, 1, "hd1440", "lower");
      await waitForState(client, page, { selected: "1080p", rate: 1.5, frameRate: 1.5, srcdocRate: 1.5, shadowRate: 1.5, input: 0 });
    });
    await check("Unavailable quality uses the selected fallback", async () => {
      await setQuality(client, 1, "large", "higher");
      await waitForState(client, page, { selected: "720p", input: 0 });
    });
    await check("Auto releases manual quality selection", async () => {
      await setQuality(client, 1, "auto", "lower");
      await waitForState(client, page, { selected: "auto", input: 0 });
    });
    await setQuality(client, 1, "hd1080", "lower");
    await check("Replaced reel videos get quality and saved speed without a play event", async () => {
      await evaluate(client, page, `() => {
        const old = document.getElementById('video');
        const next = document.createElement('video'); next.id = 'video';
        window.selected = null; window.attachPlayer(next); old.replaceWith(next);
        return true;
      }`);
      await waitForState(client, page, { selected: "1080p", rate: 1.5, input: 0, paused: true, time: 0 });
    });
    await check("Metadata reload and playback start restore speed without forcing ratechange", async () => {
      const state = await evaluate(client, page, `async () => {
        const video = document.querySelector('video');
        video.playbackRate = 1;
        await new Promise(resolve => setTimeout(resolve, 30));
        const override = video.playbackRate;
        video.dispatchEvent(new Event('loadedmetadata'));
        const metadata = video.playbackRate;
        video.playbackRate = 1;
        video.dispatchEvent(new Event('play'));
        return {override, metadata, resumed:video.playbackRate};
      }`);
      if (state?.override !== 1 || state?.metadata !== 1.5 || state?.resumed !== 1.5) throw new Error(JSON.stringify(state));
    });
    for (const kind of ["videojs", "shaka"]) {
      await check(`${kind} player API quality without UI interaction`, async () => {
        await client.callTool("navigate_page", { pageId: page, url: `${base}/${kind}` });
        await waitForState(client, page, { selected: "1080p", rate: 1.5, input: 0, menuHidden: true, paused: true, time: 0 });
      });
    }
    await check("Unsupported Facebook-style player stays untouched while speed works", async () => {
      await client.callTool("navigate_page", { pageId: page, url: `${base}/unsupported` });
      await waitForState(client, page, { engine: true, selected: null, rate: 1.5, input: 0, menuHidden: true });
      await evaluate(client, page, `() => window.__zedVideoQualityEngine.apply()`);
      await waitForState(client, page, { selected: null, rate: 1.5, input: 0, paused: true, time: 0 });
    });
    console.log(`Media E2E: ${passed} scenarios passed`);
  } finally {
    await client.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
