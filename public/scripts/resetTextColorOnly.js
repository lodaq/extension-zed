(function () {
  document.querySelectorAll("*").forEach((el) => {
    try {
      const st = el.style;
      if (!st) return;
      st.removeProperty("color");
    } catch (_) {}
  });
})();
