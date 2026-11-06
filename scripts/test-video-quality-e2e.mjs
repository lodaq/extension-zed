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

// A Facebook-like player fixture. The engine has to open the gear menu, open
// the Quality submenu (when present), and pick the right resolution - or the
// requested fallback when the exact one is not offered.
function playerPage({ variant = "standard", options = ["Automatic", "1080p", "720p", "360p"], label = "Video" }) {
  const roleless = variant === "loose";
  const directOptions = variant === "reels";
  const role = (name) => (roleless ? "" : ` role="${name}"`);

  const optionMarkup = options
    .map(
      (option) =>
        `<div class="row option" data-quality="${option}"${role("menuitemradio")}>${option}</div>`
    )
    .join("");

  const menuMarkup = directOptions
    ? `<div id="menu" class="menu"${role("menu")} style="display:none">${optionMarkup}</div>`
    : `<div id="menu" class="menu"${role("menu")} style="display:none">
        <div id="qualityRow" class="row quality"${role("menuitem")}>Quality <span id="qualityValue">Automatic 1080p</span> <span class="chevron">›</span></div>
      </div>
      <div id="submenu" class="menu submenu"${role("menu")} style="display:none">${optionMarkup}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${label}</title>
  <style>
    html, body { margin: 0; padding: 0; background: #f0f2f5; font-family: sans-serif; }
    #player { position: relative; width: 640px; height: 360px; margin: 40px; background: #000; overflow: hidden; }
    ${variant === "reels" ? "#player { width: 100vw; height: 100vh; margin: 0; }" : ""}
    #video { width: 100%; height: 100%; display: block; background: #111; }
    #gear { position: absolute; right: 10px; bottom: 10px; width: 30px; height: 30px; background: #333; color: #fff; border: 0; border-radius: 4px; cursor: pointer; z-index: 20; }
    .menu { position: absolute; left: 180px; top: 90px; min-width: 180px; background: #242526; color: #fff; padding: 6px; border-radius: 8px; z-index: 30; box-shadow: 0 8px 24px rgba(0,0,0,.5); }
    .submenu { left: 380px; top: 90px; }
    .row { padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .row:hover { background: #3a3b3c; }
    .quality { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
    .chevron { opacity: .7; }
  </style>
</head>
<body>
  <div id="player">
    <video id="video" playsinline muted></video>
    <button id="gear" aria-label="Settings" title="Settings">⚙</button>
    ${menuMarkup}
  </div>
  ${variant === "switch" ? '<button id="next-reel" style="margin:40px">Next reel</button>' : ""}
  <script>
    (function () {
      window.__zedSelected = null;
      window.__zedMenuOpened = 0;
      window.__zedQualityClicks = 0;
      window.__zedLastClick = null;
      var menu = document.getElementById('menu');
      var submenu = document.getElementById('submenu');
      var gear = document.getElementById('gear');
      var qualityRow = document.getElementById('qualityRow');
      var qualityValue = document.getElementById('qualityValue');

      document.addEventListener('click', function (event) {
        var target = event.target;
        window.__zedLastClick = {
          id: target && target.id,
          cls: target && target.className,
          text: target && (target.textContent || '').slice(0, 40)
        };
      }, true);

      function hideAll() {
        menu.style.display = 'none';
        if (submenu) submenu.style.display = 'none';
      }

      gear.addEventListener('click', function () {
        window.__zedMenuOpened += 1;
        if (menu.style.display === 'block') hideAll();
        else {
          menu.style.display = 'block';
          if (submenu) submenu.style.display = 'none';
        }
      });

      if (qualityRow) {
        qualityRow.addEventListener('click', function () {
          if (submenu) submenu.style.display = 'block';
        });
      }

      Array.prototype.forEach.call(document.querySelectorAll('[data-quality]'), function (option) {
        option.addEventListener('click', function () {
          var value = option.getAttribute('data-quality');
          window.__zedSelected = value;
          if (qualityValue) qualityValue.textContent = value;
          hideAll();
        });
      });
    })();
  </script>
</body>
</html>`;
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let body;
    switch (url.pathname) {
      case "/standard":
        body = playerPage({ variant: "standard", label: "Facebook video (ARIA menu)" });
        break;
      case "/loose":
        body = playerPage({ variant: "loose", label: "Facebook video (no ARIA roles)" });
        break;
      case "/reels":
        body = playerPage({ variant: "reels", label: "Facebook reel", options: ["Automatic", "1080p", "720p", "360p"] });
        break;
      case "/fallback-lower":
        body = playerPage({ variant: "standard", label: "Fallback lower", options: ["Automatic", "720p", "360p"] });
        break;
      case "/fallback-higher":
        body = playerPage({ variant: "standard", label: "Fallback higher", options: ["Automatic", "1080p", "480p"] });
        break;
      case "/switch":
        body = playerPage({ variant: "switch", label: "Reel switch" });
        break;
      default:
        body = playerPage({ label: "Facebook video" });
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
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

async function waitForSelection(client, pageId, expected, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(
      client,
      pageId,
      `() => ({
        selected: window.__zedSelected,
        opened: window.__zedMenuOpened,
        row: document.getElementById('qualityValue') ? document.getElementById('qualityValue').textContent : null,
        videos: document.querySelectorAll('video').length,
        settings: window.__zedVideoQualityEngine ? window.__zedVideoQualityEngine.getSettings() : null,
        engine: Boolean(window.__zedVideoQualityEngine),
        menu: document.getElementById('menu') ? document.getElementById('menu').style.display : null,
        submenu: document.getElementById('submenu') ? document.getElementById('submenu').style.display : null,
        lastClick: window.__zedLastClick
      })`
    );
    if (last && last.selected === expected) return last;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return last;
}

async function main() {
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const client = new DevToolsClient();
  const results = [];

  function record(name, passed, detail = "") {
    results.push({ name, passed });
    console.log(`  ${passed ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  }

  try {
    await client.start();
    const installed = await client.callTool("install_extension", { path: EXTENSION_DIST });
    record("Install extension from dist/", !installed.isError, parseTextContent(installed).slice(0, 160));

    const listText = parseTextContent(await client.callTool("list_extensions"));
    const extensionId = (listText.match(/([a-p]{32})/) || [])[1];
    record("Detect extension id", Boolean(extensionId), extensionId || "none");
    if (!extensionId) throw new Error(`No extension id in: ${listText}`);

    const popupUrl = `chrome-extension://${extensionId}/index.html`;
    await client.callTool("navigate_page", { pageId: 1, url: popupUrl });
    record("Open extension page", true, popupUrl);

    // Scenario 1: standard ARIA menu, 1080p should be selected.
    await setQuality(client, 1, "hd1080", "lower");
    await client.callTool("new_page", { url: `${base}/standard` });
    const standardPage = await findPageId(client, `${base}/standard`);
    await client.callTool("select_page", { pageId: standardPage });
    let state = await waitForSelection(client, standardPage, "1080p");
    record("Facebook video/ARIA menu applies saved 1080p", state?.selected === "1080p", JSON.stringify(state));

    // Scenario 2: same menu with no ARIA roles or tabindex.
    await setQuality(client, 1, "hd1080", "lower");
    await client.callTool("navigate_page", { pageId: standardPage, url: `${base}/loose` });
    state = await waitForSelection(client, standardPage, "1080p");
    record("Facebook video without ARIA roles applies 1080p", state?.selected === "1080p", JSON.stringify(state));

    // Scenario 3: Reels layout with a direct quality list (no Quality submenu).
    await setQuality(client, 1, "hd1080", "lower");
    await client.callTool("navigate_page", { pageId: standardPage, url: `${base}/reels` });
    state = await waitForSelection(client, standardPage, "1080p");
    record("Facebook reel applies 1080p", state?.selected === "1080p", JSON.stringify(state));

    // Scenario 4: requested quality unavailable, lower fallback.
    await setQuality(client, 1, "hd1080", "lower");
    await client.callTool("navigate_page", { pageId: standardPage, url: `${base}/fallback-lower` });
    state = await waitForSelection(client, standardPage, "720p");
    record("Unavailable 1080p falls back to lower 720p", state?.selected === "720p", JSON.stringify(state));

    // Scenario 5: requested quality unavailable, higher fallback.
    await setQuality(client, 1, "hd720", "higher");
    await client.callTool("navigate_page", { pageId: standardPage, url: `${base}/fallback-higher` });
    state = await waitForSelection(client, standardPage, "1080p");
    record("Unavailable 720p falls back to higher 1080p", state?.selected === "1080p", JSON.stringify(state));

    // Scenario 6: reload keeps applying the saved quality.
    await setQuality(client, 1, "hd1080", "lower");
    await client.callTool("navigate_page", { pageId: standardPage, url: `${base}/standard` });
    await waitForSelection(client, standardPage, "1080p");
    await client.callTool("navigate_page", { pageId: standardPage, type: "reload" });
    state = await waitForSelection(client, standardPage, "1080p");
    record("Saved quality reapplies after reload", state?.selected === "1080p", JSON.stringify(state));

    // Scenario 7: reel swaps to a new <video>; the new one gets applied too.
    await setQuality(client, 1, "hd1080", "lower");
    await client.callTool("navigate_page", { pageId: standardPage, url: `${base}/switch` });
    await waitForSelection(client, standardPage, "1080p");
    const switched = await evaluate(
      client,
      standardPage,
      `() => {
        window.__zedSelected = null;
        const player = document.getElementById('player');
        const old = document.getElementById('video');
        const next = document.createElement('video');
        next.id = 'video';
        next.muted = true;
        next.setAttribute('playsinline', '');
        next.style.width = '100%';
        next.style.height = '100%';
        player.replaceChild(next, old);
        document.getElementById('gear').style.display = 'block';
        next.dispatchEvent(new Event('play'));
        return { swapped: true };
      }`
    );
    state = await waitForSelection(client, standardPage, "1080p");
    record("Quality reapplies when a reel swaps its video element", switched?.swapped === true && state?.selected === "1080p", JSON.stringify(state));
  } catch (error) {
    record("E2E run completed", false, error.message);
  } finally {
    await client.close();
    server.close();
  }

  const passed = results.filter((entry) => entry.passed).length;
  console.log(`\n=== Video quality E2E: ${passed}/${results.length} passed ===`);
  if (passed !== results.length) process.exit(1);
}

main();
