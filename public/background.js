const PLAYBACK_PRESETS = Array.from({ length: 100 }, (_, i) =>
  Number(((i + 1) / 10).toFixed(1))
);

const SCRIPT_EVENTS = Object.freeze({
  changeBackgroundColor: "scripts/applyPageColors.js",
  changeColor: "scripts/applyPageColors.js",
  resetPageColors: "scripts/applyPageColors.js",
  inspectModeApply: "scripts/inspectMode.js",
  resetBackgroundOnly: "scripts/applyPageColors.js",
  resetTextColorOnly: "scripts/applyPageColors.js",
  hideMainScrollBar: "scripts/hideMainScrollBar.js",
  hideAllScrollBars: "scripts/hideAllScrollBars.js",
  resetMainScrollBar: "scripts/resetMainScrollBar.js",
  resetAllScrollBars: "scripts/resetAllScrollBars.js",
  hideYoutubeProgressBar: "scripts/youtubeProgressBar.js",
  hideYoutubeControls: "scripts/youtubeControls.js",
  youtubeFocus: "scripts/youtubeFocusMode.js",
  volumeBoost: "scripts/volumeBoost.js",
  playbackRateApply: "scripts/changePlaybackRate.js",
});

const COMMAND_EVENTS = Object.freeze({
  zed_scrollbar_main: "hideMainScrollBar",
  zed_scrollbar_all: "hideAllScrollBars",
  zed_youtube_progress_bar: "hideYoutubeProgressBar",
});

function clampPlaybackRate(r) {
  const n = Number(r);
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(0.1, n));
}

function injectAllFrames(tabId, files) {
  return chrome.scripting
    .executeScript({
      target: { tabId, allFrames: true },
      files,
    })
    .catch(() =>
      chrome.scripting.executeScript({
        target: { tabId },
        files,
      })
    );
}

function injectForEvent(tabId, event) {
  const file = SCRIPT_EVENTS[event];
  if (!file) return Promise.reject(new Error(`Unknown page action: ${event}`));
  return injectAllFrames(tabId, [file]);
}

function runPageAction(tabId, event) {
  if (event === "designMode") return injectDesignMode(tabId);
  if (event === "youtubeFocus") return injectYoutubeFocus(tabId);
  if (event === "arabicRtlMode") {
    return chrome.storage.local.get(["arabicRtlMode"]).then((r) =>
      chrome.tabs.sendMessage(tabId, {
        action: String(r.arabicRtlMode).toLowerCase() === "on" ? "rtl-enable" : "rtl-disable",
      })
    );
  }
  return injectForEvent(tabId, event);
}

function injectYoutubeFocus(tabId) {
  return chrome.storage.local.get(["youtubeFocus"]).then(({ youtubeFocus }) =>
    chrome.scripting.executeScript({
      target: { tabId },
      func: (enabled) => { window.__zedYoutubeFocusEnabled = enabled; },
      args: [Boolean(youtubeFocus)],
    }).then(() => chrome.scripting.executeScript({ target: { tabId }, files: ["scripts/youtubeFocusMode.js"] }))
  );
}

function injectDesignMode(tabId) {
  return chrome.storage.local.get(["designMode"]).then((r) => {
    const on = String(r.designMode).toLowerCase() === "on";
    const injectFlag = () =>
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          func: (isOn) => {
            window.__zedDesignModeFlag = isOn;
          },
          args: [on],
        })
        .catch(() =>
          chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            func: (isOn) => {
              window.__zedDesignModeFlag = isOn;
            },
            args: [on],
          })
        );
    return injectFlag().then(() =>
      chrome.scripting
        .executeScript({
          target: { tabId, allFrames: true },
          world: "MAIN",
          files: ["scripts/designMode.js"],
        })
        .catch(() =>
          chrome.scripting.executeScript({
            target: { tabId },
            world: "MAIN",
            files: ["scripts/designMode.js"],
          })
        )
    );
  });
}

function stepPlayback(tabId, delta) {
  chrome.storage.local.get(["speed"]).then(({ speed }) => {
    const cur = Number(speed);
    const s = Number.isFinite(cur) && cur > 0 ? cur : 1;
    const clamped = clampPlaybackRate(s);
    let idx = PLAYBACK_PRESETS.findIndex((p) => Math.abs(p - clamped) < 0.05);
    if (idx < 0) idx = PLAYBACK_PRESETS.indexOf(1);
    if (idx < 0) idx = 9;
    idx = Math.min(PLAYBACK_PRESETS.length - 1, Math.max(0, idx + delta));
    const next = PLAYBACK_PRESETS[idx];
    chrome.storage.local.set({ speed: String(next) }).then(() => {
      runPageAction(tabId, "playbackRateApply");
    });
  });
}

function setPlayback(tabId, rate) {
  const next = clampPlaybackRate(rate);
  chrome.storage.local.set({ speed: String(next) }).then(() => {
    runPageAction(tabId, "playbackRateApply");
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (!tabId) return;

    switch (command) {
      case "zed_playback_slower":
        stepPlayback(tabId, -1);
        break;
      case "zed_playback_faster":
        stepPlayback(tabId, 1);
        break;
      case "zed_playback_normal":
        setPlayback(tabId, 1);
        break;
      case "zed_playback_double":
        setPlayback(tabId, 2);
        break;
      case "zed_youtube_focus":
        chrome.storage.local.get(["youtubeFocus"]).then(({ youtubeFocus }) => {
          chrome.storage.local.set({ youtubeFocus: !youtubeFocus }).then(() => runPageAction(tabId, "youtubeFocus"));
        });
        break;
      case "zed_design_mode":
        chrome.storage.local.get(["designMode"]).then((r) => {
          const next = String(r.designMode).toLowerCase() === "on" ? "off" : "on";
          chrome.storage.local.set({ designMode: next }).then(() => runPageAction(tabId, "designMode"));
        });
        break;
      case "zed_inspect":
        chrome.storage.local.get(["inspectMode"]).then((r) => {
          const next = String(r.inspectMode).toLowerCase() === "on" ? "off" : "on";
          chrome.storage.local.set({ inspectMode: next }).then(() =>
            runPageAction(tabId, "inspectModeApply")
          );
        });
        break;
      case "zed_reset_page_colors":
        runPageAction(tabId, "resetPageColors");
        break;
      default:
        if (COMMAND_EVENTS[command]) runPageAction(tabId, COMMAND_EVENTS[command]);
        break;
    }
  });
});


chrome.runtime.onMessage.addListener((data, _sender, sendResponse) => {
  if (!data || typeof data.event !== "string") {
    sendResponse({ ok: false, error: "No page action was provided" });
    return;
  }

  const tabId = data.tabId;
  if (typeof tabId !== "number") {
    sendResponse({ ok: false, error: "No active tab is available" });
    return;
  }

  runPageAction(tabId, data.event)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "Script injection failed" }));
  return true;
});
