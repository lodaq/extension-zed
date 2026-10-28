/* Supports the keyboard command, which runs without popup-side storage updates. */
chrome.storage.local.remove([`pageColors:${location.origin}`]).then(() => {
  document.getElementById("zed-page-colors")?.remove();
});
