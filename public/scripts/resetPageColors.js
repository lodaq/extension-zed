chrome.storage.local.remove([`pageColors:${location.origin}`]).then(() => {
  document.getElementById("zed-page-colors")?.remove();
});
