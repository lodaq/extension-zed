import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

const source = readFileSync("public/scripts/arabicRtlMode.js", "utf8")
assert.ok(source.includes("__zedArabicRtlApply"), "RTL application hook is required")
mkdirSync("dist/perf", { recursive: true })
writeFileSync("dist/perf/arabicRtlMode.js", source)
writeFileSync("dist/perf/rtl.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Zed RTL performance fixture</title><style>body{font:16px Arial;margin:16px}article{width:600px;border:1px solid #ddd;padding:4px}p{margin:4px}span{display:inline}</style><script defer src="fixture.js"></script></head><body>Preparing fixture…</body></html>`)
writeFileSync("dist/perf/fixture.js", `
(async function () {
  await chrome.storage.local.set({arabicRtlMode: "off"});
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "arabicRtlMode.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  window.runRtlBenchmark = async (blocks = 200, samples = 5) => {
    window.__zedArabicRtlApply(false);
    const main = document.createElement("main");
    for (let index = 0; index < blocks; index++) {
      const article = document.createElement("article");
      article.innerHTML = '<h2>مرحبا بالعالم</h2><p><span>هذا نص عربي للاختبار</span> <span>مع محتوى متغير</span></p><p dir="ltr">Explicit direction stays unchanged</p>';
      main.appendChild(article);
    }
    document.body.replaceChildren(main);
    await frame();
    const timings = [];
    let marked = 0;
    for (let sample = -1; sample < samples; sample++) {
      window.__zedArabicRtlApply(false);
      void document.body.offsetHeight;
      const started = performance.now();
      performance.mark("rtl-enable-start");
      window.__zedArabicRtlApply(true);
      void document.body.offsetHeight;
      performance.mark("rtl-enable-end");
      performance.measure("rtl-enable", "rtl-enable-start", "rtl-enable-end");
      const elapsed = performance.now() - started;
      marked = document.querySelectorAll("[data-arabic-rtl-fixed]").length;
      if (marked !== blocks * 5 + 1) throw new Error("RTL fixture behavior changed: " + marked);
      if (sample >= 0) timings.push(elapsed);
      await frame();
    }
    window.__zedArabicRtlApply(false);
    if (document.querySelector("[data-arabic-rtl-fixed]")) throw new Error("RTL reset failed");
    return {blocks, elements: main.querySelectorAll("*").length, samples, timings, marked,
      userAgent: navigator.userAgent, viewport: [innerWidth, innerHeight], devicePixelRatio,
      conditions: "desktop; unthrottled CPU/network; warm document; one warmup; includes final layout"};
  };
  document.body.textContent = "Ready. Run window.runRtlBenchmark().";
})();
`)
console.log("Created ignored dist/perf/rtl.html; open it in the unpacked extension and call runRtlBenchmark()")
