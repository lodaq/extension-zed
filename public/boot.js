(function () {
  var TABS = ["misc", "youtube", "settings"]
  var SECTIONS = ["password", "playback", "volume", "quality", "colors", "scrollbars", "modes"]
  var state = {}
  try {
    state = JSON.parse(localStorage.getItem("zed.boot") || "{}") || {}
  } catch (error) {
    state = {}
  }
  var tab = TABS.indexOf(state.tab) >= 0 ? state.tab : "misc"
  var dark = typeof state.dark === "boolean" ? state.dark : true
  var root = document.documentElement
  root.classList.toggle("dark", dark)
  root.setAttribute("data-boot-tab", tab)

  function applyDom() {
    var active = document.querySelector('.zed-boot-tab[data-boot-tab="' + tab + '"]')
    if (active) active.setAttribute("data-active", "")

    if (Array.isArray(state.order)) {
      var list = document.querySelector(".zed-boot-sections")
      if (list) {
        state.order.forEach(function (id) {
          if (SECTIONS.indexOf(id) < 0) return
          var node = list.querySelector('[data-boot-section="' + id + '"]')
          if (node) list.appendChild(node)
        })
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyDom, { once: true })
  } else {
    applyDom()
  }
})()
