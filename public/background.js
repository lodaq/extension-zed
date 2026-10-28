const PLAYBACK_PRESETS = Array.from({ length: 100 }, (_, i) =>
  Number(((i + 1) / 10).toFixed(1))
);

/** @type {Readonly<Record<string, string>>} */
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
});

/** @type {Readonly<Record<string, string>>} */
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

function runScriptEvent(tabId, event) {
  const file = SCRIPT_EVENTS[event];
  if (!file) return Promise.resolve();
  return injectAllFrames(tabId, [file]);
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

/** designMode must run in the page JS world; MAIN has no chrome.storage — set a flag first. */
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
      injectAllFrames(tabId, ["scripts/changePlaybackRate.js"]);
    });
  });
}

function setPlayback(tabId, rate) {
  const next = clampPlaybackRate(rate);
  chrome.storage.local.set({ speed: String(next) }).then(() => {
    injectAllFrames(tabId, ["scripts/changePlaybackRate.js"]);
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
          chrome.storage.local.set({ youtubeFocus: !youtubeFocus }).then(() => injectYoutubeFocus(tabId));
        });
        break;
      case "zed_design_mode":
        chrome.storage.local.get(["designMode"]).then((r) => {
          const next = String(r.designMode).toLowerCase() === "on" ? "off" : "on";
          chrome.storage.local.set({ designMode: next }).then(() => injectDesignMode(tabId));
        });
        break;
      case "zed_inspect":
        chrome.storage.local.get(["inspectMode"]).then((r) => {
          const next = String(r.inspectMode).toLowerCase() === "on" ? "off" : "on";
          chrome.storage.local.set({ inspectMode: next }).then(() =>
            injectAllFrames(tabId, ["scripts/inspectMode.js"])
          );
        });
        break;
      case "zed_reset_page_colors":
        chrome.storage.local
          .remove(["background-color", "color"])
          .then(() => injectAllFrames(tabId, ["scripts/resetPageColors.js"]));
        break;
      default:
        if (COMMAND_EVENTS[command]) runScriptEvent(tabId, COMMAND_EVENTS[command]);
        break;
    }
  });
});


chrome.runtime.onMessage.addListener((data, _sender, sendResponse) => {
  const tabId = data.tabId;
  if (typeof tabId !== "number") {
    sendResponse({ ok: false, error: "No active tab is available" });
    return;
  }

  if (data.event === "arabicRtlMode") {
    chrome.storage.local.get(["arabicRtlMode"]).then((r) => {
      const on = String(r?.arabicRtlMode).toLowerCase() === "on";
      const msg = on ? { action: "rtl-enable" } : { action: "rtl-disable" };
      chrome.tabs.sendMessage(tabId, msg).catch(() => {});
    });
    return;
  }

  const action = data.event === "designMode"
    ? injectDesignMode(tabId)
    : data.event === "youtubeFocus"
      ? injectYoutubeFocus(tabId)
      : runScriptEvent(tabId, data.event);

  action
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: error?.message || "Script injection failed" }));
  return true;
});
