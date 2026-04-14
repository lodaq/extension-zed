chrome.storage.local.get(["background-color"]).then((result) => {
  const color = result["background-color"];
  if (typeof color !== "string" || !color) return;
  document.querySelectorAll("*").forEach((e) => {
    e.style.setProperty("background-color", color, "important");
    e.style.setProperty("background", color, "important");
  });
});
