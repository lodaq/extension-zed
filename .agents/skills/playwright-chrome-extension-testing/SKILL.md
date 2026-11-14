---
name: playwright-chrome-extension-testing
description: Test Chrome extensions (Manifest V3) headlessly with Playwright — load unpacked extensions, extract the extension ID, test popups/content scripts/background, run reliably in CI, and use the correct headless mode that actually supports extensions.
license: MIT
metadata:
  version: "1.1"
  updated: "2026-02"
  requires: Playwright >= 1.40, Chromium (bundled or Chrome for Testing)
compatibility: Works with Playwright Test runner, GitHub Actions, GitLab CI, etc.
---

# Playwright Chrome Extension Testing (Headless)

This skill gives you the exact, battle-tested recipe to **automatably load** and **test** any Chrome extension (MV2 or MV3) with Playwright, including fully headless runs in CI.

## Why Playwright?

- Best extension support in 2025/2026
- Clean fixtures for extension ID extraction
- Excellent tracing, auto-waiting, parallel execution
- Official headless mode that actually loads extensions

## 1. Project Setup (one-time)

```bash
npm init -y
npm install -D @playwright/test playwright
npx playwright install --with-deps chromium   # or use Chrome for Testing binary
```

````

## 2. Core Fixture (copy-paste this)

Create `tests/fixtures.ts`:

```ts
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

const pathToExtension = path.join(__dirname, "../dist"); // ← your built extension

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium", // ← bundled Chromium = maximum compatibility
      headless: true,
      args: [
        "--headless=new", // ← THIS is what makes extensions work headlessly
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        "--no-sandbox", // needed in many CI runners
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker)
      serviceWorker = await context.waitForEvent("serviceworker");
    const id = serviceWorker.url().split("/")[2];
    await use(id);
  },
});

export const expect = test.expect;
```

## 3. Example Tests

```ts
import { test, expect } from "./fixtures";

test("popup opens and shows correct content", async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator("body")).toContainText("My Extension");
});

test("content script injects on any page", async ({ page }) => {
  await page.goto("https://example.com");
  await expect(page.locator("body")).toHaveText(/injected by my extension/i);
});

test("background/service worker responds", async ({ extensionId }) => {
  const response = await fetch(
    `chrome-extension://${extensionId}/_generated_background_page.html`,
  );
  // or use runtime.sendMessage in a real test
});
```

## 4. Run It

```bash
npx playwright test                  # headless by default
npx playwright test --headed         # for debugging
npx playwright test --ui             # interactive test explorer
```

## 5. CI-Friendly Config (`playwright.config.ts`)

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  use: {
    headless: true,
    channel: "chromium",
    launchOptions: {
      args: ["--headless=new"],
    },
  },
  // ... other settings
});
```

## Common Gotchas (2026)

| Issue                     | Fix                                                    |
| ------------------------- | ------------------------------------------------------ |
| Extension doesn’t load    | Use `--headless=new` (old headless ignores extensions) |
| Branded Chrome/Edge fails | Use `channel: 'chromium'` or Chrome for Testing binary |
| Service worker not ready  | Always do `waitForEvent('serviceworker')`              |
| Popup tests flaky         | Keep them short; they auto-close                       |
| CI crashes on sandbox     | Add `--no-sandbox --disable-setuid-sandbox`            |

## Quick Validation Checklist

- [ ] Testing the **built** `dist/` folder (never source)
- [ ] Using `--headless=new`
- [ ] `channel: 'chromium'` (or Chrome for Testing)
- [ ] Extension ID extracted from service worker URL
- [ ] Storage cleared between tests (`context.clearStorage()`)

## Alternative: Puppeteer (lighter)

If you prefer Puppeteer:

```js
const browser = await puppeteer.launch({
  headless: "new",
  args: [`--load-extension=${pathToExtension}`],
});
```

But Playwright is strongly recommended for real test suites.

Use this skill whenever you need to add automated tests to a Chrome extension project. It works today in production CI pipelines everywhere.

For the absolute latest tricks → Playwright docs → Chrome Extensions section.
````
