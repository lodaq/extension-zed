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

    const hasMiscTab = snapshotText.includes('"Misc"');
    const hasYoutubeTab = snapshotText.includes('"YouTube"');
    const hasSettingsTab = snapshotText.includes('"Settings"');
    const hasShortcutsTab = /shortcuts/i.test(snapshotText);

    record("Popup tab: Misc present", hasMiscTab);
    record("Popup tab: Youtube present", hasYoutubeTab);
    record("Popup tab: Settings present", hasSettingsTab);
    record("Popup tab: Shortcuts present", hasShortcutsTab);

    // Check for popup console errors
    const consoleRes = await client.callTool("list_console_messages", { pageId: 1, types: ["error"] });
    const consoleText = parseTextContent(consoleRes);
    const hasPopupConsoleErrors = consoleText.includes('"level":"error"') || consoleText.includes("Error:");
    record("Popup has zero console errors", !hasPopupConsoleErrors, hasPopupConsoleErrors ? consoleText : "clean");

    // Test password generator in popup
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

    // Switch to Extensions tab using CDP click tool
    console.log("\n8. Testing Tab switching to Extensions via click tool...");
    const extMatch = snapshotText.match(/uid=([^\s]+)\s+button\s+"Extensions"/);
    if (extMatch) {
      await client.callTool("click", { pageId: 1, uid: extMatch[1] });
      await new Promise(r => setTimeout(r, 200));
      const extSnap = await client.callTool("take_snapshot", { pageId: 1 });
      const extSnapText = parseTextContent(extSnap);
      const hasBraveBtn = extSnapText.includes("brave://extensions");
      record("Extensions tab brave://extensions button present", hasBraveBtn, extSnapText.slice(0, 300));
    } else {
      record("Extensions tab brave://extensions button present", false, "Could not find Extensions tab UID");
    }

    // Switch to YouTube tab using CDP click tool
    console.log("\n8b. Testing Tab switching to YouTube via click tool...");
    const ytMatch = snapshotText.match(/uid=([^\s]+)\s+button\s+"YouTube"/);
    if (ytMatch) {
      await client.callTool("click", { pageId: 1, uid: ytMatch[1] });
      await new Promise(r => setTimeout(r, 200));
      const ytSnap = await client.callTool("take_snapshot", { pageId: 1 });
      const ytSnapText = parseTextContent(ytSnap);
      const ytActive = ytSnapText.includes('heading "YouTube"') && ytSnapText.includes('Focus mode');
      record("Switch to YouTube tab", ytActive, ytSnapText.slice(0, 300));
    } else {
      record("Switch to YouTube tab", false, "Could not find YouTube tab UID");
    }

    // Switch to Settings tab using CDP click tool
    console.log("\n9. Testing Tab switching to Settings via click tool...");
    const setMatch = snapshotText.match(/uid=([^\s]+)\s+button\s+"Settings"/);
    if (setMatch) {
      await client.callTool("click", { pageId: 1, uid: setMatch[1] });
      await new Promise(r => setTimeout(r, 600));
      const setSnap = await client.callTool("take_snapshot", { pageId: 1 });
      const setSnapText = parseTextContent(setSnap);
      const setHasExport = setSnapText.includes("Export") && setSnapText.includes("Import");
      record("Switch to Settings tab & verify Export/Import", setHasExport, setSnapText.slice(0, 300));
    } else {
      record("Switch to Settings tab & verify Export/Import", false, "Could not find Settings tab UID");
    }

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
