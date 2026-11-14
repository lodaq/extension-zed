# Native full-page capture

Status: accepted for the requested Brave-style capture behavior.

The original implementation scrolled and stitched viewport captures. Chrome limits viewport capture calls to two per second; long pages visibly scrolled and took longer to finish. The requested behavior is one full image without walking through the page.

Use Page.captureScreenshot with captureBeyondViewport through chrome.debugger. Brave's native extractor uses the same protocol command. Desktop Brave reproduced repeated viewport bands in a single tall request, despite passing headless checks. Capture offset clips no taller than half the original viewport and combine them in OffscreenCanvas; this avoids the faulty oversized capture without scrolling the page. A locked app shell can require temporarily expanding the rendering viewport; restore it and scroll positions before detaching. Retain explicit image-size limits and guaranteed cleanup on error.

The tradeoff is a required debugger permission, with a browser warning/indicator and possible conflict with DevTools. Chrome explicitly disallows debugger in optional_permissions, so a runtime permission prompt cannot implement this feature. Do not disguise or bypass that restriction. The debugger is used for capture and viewport restoration only, then disconnected; no network, cookie, or browsing-data inspection is performed.

Alternatives rejected: continuing scroll stitching fails the requested interaction; print-to-PDF changes layout and adds a conversion path; HTML-to-canvas libraries cannot faithfully reproduce every page and add dependencies.

Sources are linked in [the screenshot design](../screenshot-tool.md).
