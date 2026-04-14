(function () {
  const ID = "zed-hide-main-scrollbar";
  document.getElementById(ID)?.remove();

  const style = document.createElement("style");
  style.id = ID;
  style.appendChild(
    document.createTextNode(`
  /* Viewport / document scrollbar only (not inner overflow areas). */
  html::-webkit-scrollbar,
  body::-webkit-scrollbar {
    display: none;
  }
  html, body {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
`)
  );
  (document.head || document.documentElement).appendChild(style);
})();
