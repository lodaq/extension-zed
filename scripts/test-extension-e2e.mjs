import http from "node:http";
import process from "node:process";

import { DevToolsClient, EXTENSION_DIST, parseTextContent } from "./test-browser.mjs";

// Simple test web server for content-script testing
function startTestServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Extension Test Page</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
  </style>
</head>
<body>
  <h1>Test Page for Zed Extension</h1>
  <p id="sample-text">This is a sample paragraph to test styling and modifications.</p>
  <video id="test-video" width="320" height="240" controls>
    <source src="data:video/mp4;base64," type="video/mp4">
  </video>
  <audio id="test-audio" controls>
    <source src="data:audio/mp3;base64," type="audio/mp3">
  </audio>
</body>
</html>`);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function run() {
  console.log("=== Starting End-to-End Chrome DevTools Extension Tests ===");
  const { server, port } = await startTestServer();
  const testPageUrl = `http://127.0.0.1:${port}/`;
  console.log(`Test fixture server running at ${testPageUrl}`);

  const client = new DevToolsClient();
  const errors = [];
  const testResults = [];

  function record(name, passed, detail = "") {
    testResults.push({ name, passed, detail });
    const mark = passed ? "✓" : "✗";
    console.log(`  ${mark} ${name}${detail ? ` - ${detail}` : ""}`);
    if (!passed) {
      errors.push(`${name}: ${detail}`);
    }
  }

  try {
    console.log("\n1. Initializing Chrome DevTools MCP and browser...");
    await client.start();
    record("Start chrome-devtools-mcp server", true);

    console.log("\n2. Installing extension from dist/...");
    const installRes = await client.callTool("install_extension", { path: EXTENSION_DIST });
    const installText = parseTextContent(installRes);
    record("Install extension", !installRes.isError, installText);

    console.log("\n3. Listing installed extensions...");
    const listRes = await client.callTool("list_extensions");
    const listText = parseTextContent(listRes);
    const extListMatch = listText.match(/([a-p]{32})/);
    const extensionId = extListMatch ? extListMatch[1] : null;

    record("Detect installed extension ID", !!extensionId, `ID: ${extensionId || "none"}`);
    if (!extensionId) {
      throw new Error(`Could not find extension ID in: ${listText}`);
    }

    console.log("\n4. Triggering extension action & navigating popup...");
    await client.callTool("trigger_extension_action", { id: extensionId });

    const popupUrl = `chrome-extension://${extensionId}/index.html`;
    const navPopupRes = await client.callTool("navigate_page", { pageId: 1, url: popupUrl });
    const navText = parseTextContent(navPopupRes);
    record("Navigate page 1 to popup", !navPopupRes.isError, navText);

    // Parse service worker ID from navigate response
    const swMatch = navText.match(/(sw-\d+)/);
    const swId = swMatch ? swMatch[1] : null;
    record("Detect background service worker ID", !!swId, `ServiceWorker: ${swId}`);

    if (swId) {
      console.log("\n5. Testing Service Worker state & APIs...");
      const swEvalRes = await client.callTool("evaluate_script", {
        serviceWorkerId: swId,
        function: "() => ({ id: chrome.runtime.id, hasStorage: typeof chrome.storage !== 'undefined' })",
      });
      const swEvalText = parseTextContent(swEvalRes);
      record("Service worker responsiveness", swEvalText.includes(extensionId), swEvalText);
    }

    console.log("\n6. Inspecting Extension Popup snapshot...");
    let snapshotRes = await client.callTool("take_snapshot", { pageId: 1 });
    let snapshotText = parseTextContent(snapshotRes);

    for (const tab of ["Misc", "YouTube", "Settings", "Shortcuts"]) {
      record(`Popup tab: ${tab} present`, snapshotText.includes(`"${tab}"`));
    }

    // Check for popup console errors
    const consoleRes = await client.callTool("list_console_messages", { pageId: 1, types: ["error"] });
    const consoleText = parseTextContent(consoleRes);
    const hasPopupConsoleErrors = consoleText.includes('"level":"error"') || consoleText.includes("Error:");
    record("Popup has zero console errors", !hasPopupConsoleErrors, hasPopupConsoleErrors ? consoleText : "clean");

    // Install Playback speed, Scrollbars, Password generator, Keyboard hints, and Black and white from the Feature Store
    const storeInstall = await client.callTool("evaluate_script", {
      pageId: 1,
      function: `async () => {
        const openStore = document.getElementById('zed-open-store');
        if (!openStore) return { opened: false };
        openStore.click();
        for (let i = 0; i < 20 && !document.querySelector('button[aria-label="Install Password generator"]'); i++) {
          await new Promise(r => setTimeout(r, 100));
        }
        for (const title of ['Playback speed', 'Scrollbars', 'Password generator', 'Keyboard hints', 'Black and white']) {
          document.querySelector(\`button[aria-label="Install \${title}"]\`)?.click();
          await new Promise(r => setTimeout(r, 50));
        }
        await new Promise(r => setTimeout(r, 200));
        document.querySelector('.zed-back')?.click();
        await new Promise(r => setTimeout(r, 300));
        return {
          opened: true,
          hasPlaybackTile: !!document.getElementById('zed-tool-playback'),
          hasScrollbarsTile: !!document.getElementById('zed-tool-scrollbars'),
          hasPasswordTile: !!document.getElementById('zed-tool-password'),
          hasHintsTile: !!document.getElementById('zed-tool-hints'),
          hasBwTile: !!document.getElementById('zed-tool-blackAndWhite'),
        };
      }`,
    });
    const storeInstallText = parseTextContent(storeInstall);
    record("Feature Store installs Playback speed, Scrollbars, Password generator, Keyboard hints, and Black and white", storeInstallText.includes('"hasPlaybackTile":true') && storeInstallText.includes('"hasScrollbarsTile":true') && storeInstallText.includes('"hasPasswordTile":true') && storeInstallText.includes('"hasHintsTile":true') && storeInstallText.includes('"hasBwTile":true'), storeInstallText);

    // Test password generator in popup
    const tileHelp = await client.callTool("evaluate_script", {
      pageId: 1,
      function: `() => {
        const tile = document.getElementById('zed-tool-password');
        tile.focus();
        return !document.querySelector('.zed-tile [role="tooltip"], .zed-tooltip') && !tile.hasAttribute('title');
      }`,
    });
    record("Feature tiles have no hover or focus tooltips", !tileHelp.isError && /\btrue\b/.test(parseTextContent(tileHelp)));
    console.log("\n7. Testing Password Generator interactive controls in Popup...");
    const pwGenEval = await client.callTool("evaluate_script", {
      pageId: 1,
      function: `async () => {
        document.getElementById('zed-tool-password')?.click();
        await new Promise(r => setTimeout(r, 400));

        const input = document.querySelector('input[aria-label="Generated password"]');
        const initialVal = input ? input.value : null;

        const reloadBtn = document.querySelector('button[aria-label="Generate new password"]');
        if (reloadBtn) reloadBtn.click();
        await new Promise(r => setTimeout(r, 200));

        const newVal = input ? input.value : null;
        return {
          descriptionVisible: [...document.querySelectorAll('p.zed-helper')].some(node => node.textContent === 'Random, customizable passwords' && node.getBoundingClientRect().height > 0),
          opened: !!input,
          initialLen: initialVal ? initialVal.length : 0,
          newLen: newVal ? newVal.length : 0,
          hasValue: Boolean(newVal && newVal.length > 0),
          changed: initialVal !== newVal
        };
      }`,
    });
    const pwGenText = parseTextContent(pwGenEval);
    record("Password Generator click & update", pwGenText.includes('"hasValue":true') && pwGenText.includes('"changed":true'), pwGenText);
    record("Feature description appears inside the opened tool", pwGenText.includes('"descriptionVisible":true'));

    for (const { tab, name, matches, delay } of [
      { tab: "Extensions", name: "Extensions tab brave://extensions button present", matches: text => text.includes("brave://extensions"), delay: 200 },
      { tab: "YouTube", name: "Switch to YouTube tab", matches: text => text.includes('heading "YouTube"') && text.includes("Focus mode") && text.includes("Hide thumbnail timestamps") && text.includes("Hide all timestamps"), delay: 200 },
      { tab: "Settings", name: "Switch to Settings tab & verify Export/Import", matches: text => text.includes("Export") && text.includes("Import") && text.includes("Reset to defaults"), delay: 600 },
    ]) {
      const match = snapshotText.match(new RegExp(`uid=([^\\s]+)\\s+button\\s+"${tab}"`));
      if (!match) {
        record(name, false, `Could not find ${tab} tab UID`);
        continue;
      }
      await client.callTool("click", { pageId: 1, uid: match[1] });
      await new Promise(resolve => setTimeout(resolve, delay));
      const text = parseTextContent(await client.callTool("take_snapshot", { pageId: 1 }));
      record(name, matches(text), text.slice(0, 300));
    }

    // Recording must preserve normal keyboard navigation and return focus after cancellation.
    const popupEvaluate = async (source) => {
      const result = await client.callTool("evaluate_script", { pageId: 1, function: source });
      const json = parseTextContent(result).match(/```json\s*([\s\S]*?)\s*```/);
      if (result.isError || !json) throw new Error(parseTextContent(result));
      return JSON.parse(json[1]);
    };
    await popupEvaluate(`async () => {
      await chrome.storage.local.set({popupLocation:{tab:"Misc",detail:null,settings:false},keyboardShortcuts:{tab1:"A",tab6:"7",action2:"Cmd+K"},popupShortcutKeysV2:false});
      return true;
    }`);
    await client.callTool("navigate_page", { pageId: 1, url: popupUrl });
    record("Shortcut migration preserves other assignments", await popupEvaluate(`async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return (await chrome.storage.local.get('keyboardShortcuts')).keyboardShortcuts.action2 === 'Cmd+K';
    }`));
    await client.callTool("press_key", { pageId: 1, key: "2" });
    record("2 opens Extensions with an existing shortcut map", await popupEvaluate('() => document.querySelector("h1").textContent === "Extensions" && document.querySelector(\'[aria-keyshortcuts="2"]\').textContent.includes("Extensions")'));
    await client.callTool("press_key", { pageId: 1, key: "s" });
    record("S opens Settings with an existing shortcut map", await popupEvaluate('() => document.querySelector("h1").textContent === "Settings" && document.querySelector(\'[aria-label="Settings"]\').getAttribute("aria-keyshortcuts") === "S"'));
    await popupEvaluate(`async () => {
      await chrome.storage.local.set({popupLocation:{tab:"Misc",detail:null,settings:false}});
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    }`);
    await client.callTool("press_key", { pageId: 1, key: "f" });
    record("F shows click hints", await popupEvaluate('() => document.querySelectorAll(".zed-hint").length > 0'));
    record("S is reserved for Settings in hint labels", await popupEvaluate('() => [...document.querySelectorAll(".zed-hint")].every(node => !node.textContent.includes("s"))'));
    await client.callTool("press_key", { pageId: 1, key: "s" });
    record("S opens Settings during hint mode", await popupEvaluate('() => document.querySelector("h1").textContent === "Settings" && !document.querySelector(".zed-hint")'));
    await client.callTool("press_key", { pageId: 1, key: "Escape" });
    await client.callTool("press_key", { pageId: 1, key: "f" });
    const passwordHint = await popupEvaluate(`async () => {
      const hint = document.querySelector('#zed-tool-password .zed-hint')?.textContent;
      await chrome.storage.local.set({speed:"1.5"});
      await new Promise(resolve => setTimeout(resolve, 100));
      return {label:hint, visible:!!document.querySelector('.zed-hint')};
    }`);
    record("Click hints survive unrelated popup updates", !!passwordHint.label && passwordHint.visible, JSON.stringify(passwordHint));
    if (passwordHint.label) {
      for (const key of passwordHint.label) await client.callTool("press_key", { pageId: 1, key });
      record("Typing a hint opens its tool and clears hints", await popupEvaluate('() => document.querySelector("h1").textContent === "Password generator" && !document.querySelector(".zed-hint")'));
      await popupEvaluate(`async () => {
        await chrome.storage.local.set({popupLocation:{tab:"Misc",detail:null,settings:false}});
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      }`);
      await client.callTool("press_key", { pageId: 1, key: "f" });
      const nonLatinLabel = await popupEvaluate(`() => {
        const label = document.querySelector('#zed-tool-password .zed-hint')?.textContent || '';
        for (const letter of label) {
          document.body.dispatchEvent(new KeyboardEvent('keydown', {key:'ش',code:'Key'+letter.toUpperCase(),bubbles:true,cancelable:true}));
        }
        return label;
      }`);
      record("Non-Latin keyboard layout activates the displayed hint", Boolean(nonLatinLabel) && await popupEvaluate('() => document.querySelector("h1").textContent === "Password generator" && !document.querySelector(".zed-hint")'), `label:${nonLatinLabel}`);
    }
    await popupEvaluate(`async () => {
      await chrome.storage.local.set({hintMode:"always", popupLocation:{tab:"Misc",detail:null,settings:false}});
      return true;
    }`);
    await client.callTool("navigate_page", { pageId: 1, url: popupUrl });
    await new Promise(resolve => setTimeout(resolve, 600));
    record("Always mode shows hints immediately", await popupEvaluate('() => document.querySelectorAll(".zed-hint").length > 0'));
    const alwaysHint = await popupEvaluate(`() => document.querySelector('#zed-tool-password .zed-hint')?.textContent || ""`);
    if (alwaysHint) {
      const beforeTitle = await popupEvaluate('() => document.querySelector("h1").textContent');
      for (const key of alwaysHint) await client.callTool("press_key", { pageId: 1, key });
      await new Promise(resolve => setTimeout(resolve, 400));
      const activated = await popupEvaluate(`() => ({title: document.querySelector("h1").textContent, visible: !!document.querySelector(".zed-hint"), count: document.querySelectorAll(".zed-hint").length})`);
      record("Always mode keeps hints visible after using a hint", activated.visible && activated.count > 0 && activated.title !== beforeTitle, JSON.stringify({beforeTitle, activated}));
      await client.callTool("press_key", { pageId: 1, key: "Escape" });
      await new Promise(resolve => setTimeout(resolve, 400));
      const escaped = await popupEvaluate(`() => ({title: document.querySelector("h1").textContent, visible: !!document.querySelector(".zed-hint"), count: document.querySelectorAll(".zed-hint").length})`);
      record("Always mode keeps hints visible after Escape", escaped.visible && escaped.count > 0 && escaped.title === beforeTitle, JSON.stringify(escaped));
    }
    await popupEvaluate(`async () => {
      await chrome.storage.local.set({hintMode:"shortcut", popupLocation:{tab:"Shortcuts",detail:null,settings:false}});
      return true;
    }`);
    await client.callTool("navigate_page", { pageId: 1, url: popupUrl });
    await new Promise(resolve => setTimeout(resolve, 300));
    await popupEvaluate(`async () => {
      await chrome.storage.local.set({popupLocation:{tab:"Shortcuts",detail:null,settings:false}});
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    }`);
    for (const key of ["Tab", "Shift+Tab", "Escape"]) {
      await popupEvaluate('() => { document.querySelector(\'button[aria-label="Edit shortcut for Faster"]\').focus(); return true; }');
      await client.callTool("press_key", { pageId: 1, key: "Enter" });
      await client.callTool("press_key", { pageId: 1, key });
      const state = await popupEvaluate(`() => ({
        recording: !!document.querySelector('.zed-recording'),
        focus: document.activeElement.getAttribute('aria-label'),
        lostFocus: document.activeElement === document.body
      })`);
      record(`Shortcut recording exits with ${key} and retains focus`, !state.recording && !state.lostFocus && (key !== "Escape" || state.focus === "Edit shortcut for Faster"), JSON.stringify(state));
    }
    record("Popup has one named main heading", await popupEvaluate('() => document.querySelectorAll("h1").length === 1 && document.querySelector("h1").textContent === "Shortcuts"'));

    // Test chrome.storage.local from popup context
    console.log("\n10. Testing chrome.storage.local from popup context...");
    const storageTestRes = await client.callTool("evaluate_script", {
      pageId: 1,
      function: `async () => {
        await chrome.storage.local.set({ "e2e_storage_test": "val_998877" });
        const res = await chrome.storage.local.get("e2e_storage_test");
        return res;
      }`,
    });
    const storageText = parseTextContent(storageTestRes);
    record("Popup chrome.storage.local read/write", storageText.includes("val_998877"), storageText);

    // Open target web page on a separate page
    console.log("\n11. Testing Target Web Page fixture & media inspection...");
    const newPageRes = await client.callTool("new_page", { url: testPageUrl });
    const pagesRes = await client.callTool("list_pages");
    const pagesText = parseTextContent(pagesRes);

    const testPageLineMatch = pagesText.match(/(\d+):\s*Extension Test Page/) || pagesText.match(/(\d+):\s*http:\/\/127\.0\.0\.1/);
    const testPageId = testPageLineMatch ? parseInt(testPageLineMatch[1], 10) : 3;
    record("Open target web page", !newPageRes.isError, `Target page ID: ${testPageId}`);

    // Wait for test page DOM to settle
    await client.callTool("wait_for", { pageId: testPageId, selector: "h1" });
    await client.callTool("evaluate_script", { pageId: testPageId, function: '() => { window.zedNoReloadCheck = true; return true; }' });
    for (const enabled of [true, false]) {
      await popupEvaluate(`async () => {
        await chrome.storage.local.set({blackAndWhite:${enabled}});
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      }`);
      const state = await client.callTool("evaluate_script", {
        pageId: testPageId,
        function: `() => window.zedNoReloadCheck === true && getComputedStyle(document.documentElement).filter === ${JSON.stringify(enabled ? "grayscale(1)" : "none")}`,
      });
      record(`Grayscale turns ${enabled ? "on" : "off"} without reloading`, !state.isError && /\btrue\b/.test(parseTextContent(state)), parseTextContent(state));
    }

    const pageInspect = await client.callTool("evaluate_script", {
      pageId: testPageId,
      function: `() => ({
        title: document.title,
        hasVideo: !!document.querySelector('video'),
        hasAudio: !!document.querySelector('audio'),
        text: document.getElementById('sample-text').textContent
      })`,
    });
    const pageInspectText = parseTextContent(pageInspect);
    record("Target page DOM inspected", pageInspectText.includes("Extension Test Page"), pageInspectText);

    // Select the target webpage so it is active
    await client.callTool("select_page", { pageId: testPageId });

    // Trigger action on the active tab so activeTab permission is granted to this tab
    await client.callTool("trigger_extension_action", { id: extensionId });

    // Test message dispatch to background: playbackRateApply
    console.log("\n12. Testing playbackRateApply page action via Service Worker...");
    const dispatchRes = await client.callTool("evaluate_script", {
      serviceWorkerId: swId,
      function: `async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab || !tab.id) return { error: "No active tab" };

        const response = await new Promise((resolve) => {
          chrome.runtime.onMessage.dispatch({
            event: "playbackRateApply",
            value: 1.75,
            tabId: tab.id
          }, { id: chrome.runtime.id }, resolve);
        });
        return { tabId: tab.id, response };
      }`,
    });
    const dispatchText = parseTextContent(dispatchRes);
    record("Service worker receives and processes action", !dispatchRes.isError, dispatchText);

    // Verify video playbackRate on target page
    console.log("\n13. Verifying playback rate effect on target page...");
    const playbackVerify = await client.callTool("evaluate_script", {
      pageId: testPageId,
      function: `() => {
        const video = document.querySelector('video');
        return { rate: video ? video.playbackRate : 1 };
      }`,
    });
    const playbackVerifyText = parseTextContent(playbackVerify);
    record("Media element playback rate verified", playbackVerifyText.includes('"rate":1.8'), playbackVerifyText);

    // Exercise consolidated styles through real worker dispatch and page injection.
    for (const enabled of [true, false]) {
      const dispatch = await client.callTool("evaluate_script", {
        pageId: 1,
        function: `async () => {
          const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
          const actions = ${JSON.stringify(enabled ? ["hideMainScrollBar", "hideAllScrollBars", "applyCustomScrollbar"] : ["resetMainScrollBar", "resetAllScrollBars", "resetCustomScrollbar"])};
          const results = [];
          for (const event of [...actions, 'hideYoutubeProgressBar', 'hideYoutubeControls', 'hideYoutubeDuration', 'hideYoutubeTimestamps', 'hideAllYoutubeTimestamps', 'youtubeHalfScreen']) {
            results.push(await chrome.runtime.sendMessage({event, value:event.startsWith('hideYoutube') || event === 'youtubeHalfScreen' ? ${enabled} : undefined, tabId:tab.id}));
          }
          return {ok:results.every(result => result.ok), results};
        }`,
      });
      const state = await client.callTool("evaluate_script", {
        pageId: testPageId,
        function: `() => ['zed-hide-main-scrollbar','zed-hide-all-scrollbars','zed-custom-scrollbar','zed-youtube-progress-bar','zed-youtube-controls','zed-youtube-duration','zed-youtube-timestamps','zed-youtube-all-timestamps','zed-youtube-half-screen'].every(id => Boolean(document.getElementById(id)) === ${enabled})`,
      });
      record(`Page styles ${enabled ? "apply" : "reset"} through the worker`, !dispatch.isError && parseTextContent(dispatch).includes('"ok":true') && !state.isError && /\btrue\b/.test(parseTextContent(state)), parseTextContent(state));
    }

    // Verify Arabic RTL mode content script injection
    console.log("\n14. Verifying Arabic RTL mode behavior on target page...");
    const rtlVerify = await client.callTool("evaluate_script", {
      pageId: testPageId,
      function: `() => {
        const p = document.getElementById('sample-text');
        p.innerText = "مرحبا بالعالم هذا اختبار للنص العربي";
        return { text: p.innerText, isArabic: /[\u0600-\u06FF]/.test(p.innerText) };
      }`,
    });
    const rtlVerifyText = parseTextContent(rtlVerify);
    record("Target page Arabic text detection", rtlVerifyText.includes('"isArabic":true'), rtlVerifyText);

    // Verify Extension Storage preferences
    console.log("\n15. Testing Extension Storage state...");
    const finalStorageRes = await client.callTool("evaluate_script", {
      serviceWorkerId: swId,
      function: "async () => await chrome.storage.local.get(null)",
    });
    const finalStorageText = parseTextContent(finalStorageRes);
    record("Final Extension Storage verified", !finalStorageRes.isError && finalStorageText.includes("e2e_storage_test"), finalStorageText);

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    errors.push(err.message);
  } finally {
    console.log("\nClosing MCP client and test server...");
    await client.close();
    server.close();
  }

  console.log("\n=== Test Summary ===");
  const passedCount = testResults.filter((r) => r.passed).length;
  console.log(`Passed: ${passedCount}/${testResults.length}`);
  if (errors.length > 0) {
    console.log(`Failures/Errors (${errors.length}):`);
    for (const e of errors) {
      console.log(`  - ${e}`);
    }
    process.exit(1);
  } else {
    console.log("All end-to-end tests completed successfully!");
    process.exit(0);
  }
}

run();
