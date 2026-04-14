(function () {
  document.querySelectorAll("*").forEach((el) => {
    try {
      const st = el.style;
      if (!st) return;
      st.removeProperty("background");
      st.removeProperty("background-color");
      st.removeProperty("background-image");
    } catch (_) {}
  });
})();
