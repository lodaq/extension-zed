;(function () {
  const KEY = "__zedPlaybackRatePersist"

  function clampRate(rate) {
    const n = Number.isFinite(rate) && rate > 0 ? rate : 1
    return Math.min(10, Math.max(0.1, n))
  }

  function applyRate(video, speed) {
    try {
      if (video.playbackRate !== speed) {
        video.playbackRate = speed
      }
    } catch (_) {}
  }

  function initPlaybackRate() {
    let currentSpeed = 1
    let currentUrl = location.href
    const watchers = new WeakMap()

    function updateSpeed(newSpeed) {
      currentSpeed = clampRate(newSpeed)
      document.querySelectorAll('video').forEach(video => applyRate(video, currentSpeed))
    }

    function checkUrlChange() {
      if (location.href !== currentUrl) {
        currentUrl = location.href
        document.querySelectorAll('video').forEach(video => applyRate(video, currentSpeed))
      }
    }

    function watchVideo(video) {
      if (watchers.has(video)) return
      applyRate(video, currentSpeed)
      const onRateChange = () => applyRate(video, currentSpeed)
      video.addEventListener("ratechange", onRateChange)
      watchers.set(video, onRateChange)
    }

    function processNode(node) {
      if (node.nodeType !== Node.ELEMENT_NODE) return
      if (node.tagName === "VIDEO") {
        watchVideo(node)
      }
      try {
        node.querySelectorAll("video").forEach(watchVideo)
      } catch (_) {}
    }

    chrome.storage.local.get(["speed"]).then((result) => {
      updateSpeed(Number(result["speed"]))

      document.querySelectorAll("video").forEach(watchVideo)

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          m.addedNodes.forEach(processNode)
        })
      })

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      })

      window[KEY] = { observer, watchers }

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.speed) {
          updateSpeed(Number(changes.speed.newValue))
        }
      })

      setInterval(checkUrlChange, 1000)
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPlaybackRate)
  } else {
    initPlaybackRate()
  }

  const origListener = window[KEY]
  if (origListener && origListener.observer) {
    try {
      origListener.observer.disconnect()
    } catch (_) {}
  }
})()
