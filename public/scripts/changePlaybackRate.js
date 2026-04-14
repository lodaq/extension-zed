;(function () {
  function clampRate(rate) {
    const n = Number.isFinite(rate) && rate > 0 ? rate : 1
    return Math.min(10, Math.max(0.1, n))
  }

  function setPlaybackRate(video, speed) {
    try {
      if (video.playbackRate !== speed) video.playbackRate = speed
    } catch (_) {}
  }

  chrome.storage.local.get(["speed"]).then((result) => {
    const speed = clampRate(Number(result["speed"]))
    
    // Apply speed to all existing videos
    document.querySelectorAll("video").forEach((video) => setPlaybackRate(video, speed))
  })
})()

