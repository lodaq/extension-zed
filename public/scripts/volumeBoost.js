;(function () {
  const KEY = "__zedVolumeBoost"
  const STORAGE_KEY = "volumeBoost"
  const MIN_GAIN = 1
  const MAX_GAIN = 20

  const previous = window[KEY]

  function clampGain(value) {
    const n = Number(value) / 100
    if (!Number.isFinite(n)) return MIN_GAIN
    return Math.min(MAX_GAIN, Math.max(MIN_GAIN, n))
  }

  if (previous?.setGain) {
    chrome.storage.local.get([STORAGE_KEY]).then((result) => previous.setGain(result[STORAGE_KEY]))
    return
  }

  let currentGain = MIN_GAIN
  let context = null
  const mediaState = new WeakMap()

  function connectMedia(media) {
    if (mediaState.has(media)) {
      const state = mediaState.get(media)
      state.gain.gain.value = currentGain
      return
    }

    try {
      if (!context) context = new AudioContext()
      const source = context.createMediaElementSource(media)
      const gainNode = context.createGain()
      source.connect(gainNode).connect(context.destination)
      mediaState.set(media, { context, gain: gainNode })
      gainNode.gain.value = currentGain
      media.addEventListener("play", resumeContext, { passive: true })
    } catch (_) {
      // A media element may already be connected to another AudioContext.
    }
  }

  function resumeContext() {
    if (context?.state === "suspended") void context.resume()
  }

  function processNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return
    if (node.matches?.("audio, video")) connectMedia(node)
    node.querySelectorAll?.("audio, video").forEach(connectMedia)
  }

  function applyGain(value) {
    currentGain = clampGain(value)
    document.querySelectorAll("audio, video").forEach(connectMedia)
    resumeContext()
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach(processNode))
  })

  const onStorage = (changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return
    applyGain(changes[STORAGE_KEY].newValue)
  }

  chrome.storage.local.get([STORAGE_KEY]).then((result) => {
    currentGain = clampGain(result[STORAGE_KEY])
    applyGain(currentGain * 100)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    chrome.storage.onChanged.addListener(onStorage)
    window[KEY] = {
      setGain: applyGain,
      cleanup() {
        observer.disconnect()
        chrome.storage.onChanged.removeListener(onStorage)
      },
    }
  })
})()