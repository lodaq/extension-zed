chrome.storage.local.get(["color"]).then((result) => {
  const color = result["color"];
  if (typeof color !== "string" || !color) return;
  document.querySelectorAll("*").forEach((e) => {
    e.style.setProperty("color", color, "important");
  });
});
