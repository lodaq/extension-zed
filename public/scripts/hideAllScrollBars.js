(function () {
  const ID = "zed-hide-all-scrollbars";
  document.getElementById(ID)?.remove();

  const style = document.createElement("style");
  style.id = ID;
  style.appendChild(
    document.createTextNode(`
  *::-webkit-scrollbar {
    display: none;
  }
  * {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
`)
  );
  (document.head || document.documentElement).appendChild(style);
})();
