(function () {
  const ID = "zed-custom-scrollbar";
  document.getElementById(ID)?.remove();

  const style = document.createElement("style");
  style.id = ID;
  style.appendChild(
    document.createTextNode(`
  /* Webkit custom scrollbars with unobtrusive modern design */
  ::-webkit-scrollbar {
    width: 8px !important;
    height: 8px !important;
  }
  ::-webkit-scrollbar-track {
    background: transparent !important;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(140, 140, 140, 0.45) !important;
    border-radius: 9999px !important;
    border: 2px solid transparent !important;
    background-clip: padding-box !important;
    transition: background-color 0.2s ease;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(140, 140, 140, 0.75) !important;
    background-clip: padding-box !important;
  }
  /* Modern standard scrollbar styling */
  * {
    scrollbar-width: thin !important;
    scrollbar-color: rgba(140, 140, 140, 0.45) transparent !important;
  }
`)
  );
  (document.head || document.documentElement).appendChild(style);
})();
