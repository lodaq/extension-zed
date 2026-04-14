const PLAYBACK_PRESETS = Array.from({ length: 100 }, (_, i) =>
  Number(((i + 1) / 10).toFixed(1))
);

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
      case "zed_scrollbar_main":
        injectAllFrames(tabId, ["scripts/hideMainScrollBar.js"]);
        break;
      case "zed_scrollbar_all":
        injectAllFrames(tabId, ["scripts/hideAllScrollBars.js"]);
        break;
      case "zed_youtube_focus":
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["scripts/youtubeFocusMode.js"],
        });
        break;
      case "zed_youtube_reset":
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["scripts/youtubeFocusModeReset.js"],
        });
        break;
      case "zed_youtube_progress_bar":
        chrome.scripting.executeScript({
          target: { tabId },
          files: ["scripts/youtubeProgressBar.js"],
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
        break;
    }
  });
});


chrome.runtime.onMessage.addListener((data, _sender, sendResponse) => {
  const tabId = data.tabId;
  if (typeof tabId !== "number") return;

  if (data.event === "changeBackgroundColor") {
    injectAllFrames(tabId, ["scripts/changeBackgroundColor.js"]);
  } else if (data.event === "changeColor") {
    injectAllFrames(tabId, ["scripts/changeColor.js"]);
  } else if (data.event === "resetPageColors") {
    injectAllFrames(tabId, ["scripts/resetPageColors.js"]);
  } else if (data.event === "inspectModeApply") {
    injectAllFrames(tabId, ["scripts/inspectMode.js"]);
  } else if (data.event === "resetBackgroundOnly") {
    injectAllFrames(tabId, ["scripts/resetBackgroundOnly.js"]);
  } else if (data.event === "resetTextColorOnly") {
    injectAllFrames(tabId, ["scripts/resetTextColorOnly.js"]);
  } else if (data.event === "hideMainScrollBar") {
    injectAllFrames(tabId, ["scripts/hideMainScrollBar.js"]);
  } else if (data.event === "hideAllScrollBars") {
    injectAllFrames(tabId, ["scripts/hideAllScrollBars.js"]);
  } else if (data.event === "resetMainScrollBar") {
    injectAllFrames(tabId, ["scripts/resetMainScrollBar.js"]);
  } else if (data.event === "resetAllScrollBars") {
    injectAllFrames(tabId, ["scripts/resetAllScrollBars.js"]);
  } else if (data.event === "designMode") {
    injectDesignMode(tabId);
  } else if (data.event === "hideYoutubeProgressBar") {
    injectAllFrames(tabId, ["scripts/youtubeProgressBar.js"]);
  }
});
