import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PAGE_THEMES } from "../src/lib/pageThemes.ts";

const chrome = process.env.CHROME_PATH || "/home/sebaq/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const directory = mkdtempSync(path.join(tmpdir(), "zed-page-colors-"));
try {
  const fixture = readFileSync(new URL("./fixtures/page-colors.html", import.meta.url), "utf8");
  const source = readFileSync(new URL("../public/scripts/applyPageColors.js", import.meta.url), "utf8");
  const args = JSON.stringify(source).replaceAll("<", "\\u003c");
  const runner = `<script>testPageColors(${args}, ${JSON.stringify(PAGE_THEMES)}).then(result => {
    document.documentElement.setAttribute('data-zed-test-result', btoa(JSON.stringify(result)));
  }).catch(error => {
    document.documentElement.setAttribute('data-zed-test-result', btoa(JSON.stringify({passed:false, failures:[error.stack]})));
  });</script>`;
  const file = path.join(directory, "fixture.html");
  writeFileSync(file, fixture.replace("</body>", `${runner}</body>`));
  const result = spawnSync(chrome, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${path.join(directory, "profile")}`, "--dump-dom", "--virtual-time-budget=5000",
    pathToFileURL(file).href,
  ], { encoding: "utf8", timeout: 20000, maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
  const encoded = result.stdout.match(/data-zed-test-result="([A-Za-z0-9+/=]+)"/)?.[1];
  assert.ok(encoded, `Browser did not finish theme checks: ${result.stderr}`);
  const report = JSON.parse(Buffer.from(encoded, "base64").toString());
  assert.equal(report.passed, true, report.failures.join("\n"));
  console.log(`All ${report.presets} presets passed browser checks for surfaces, images, icons, controls, shadow DOM, dynamic content, and reset.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
