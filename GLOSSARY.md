# Domain glossary

- **Saved speed:** global local playback preference from 0.1× to 10×. Zed normalizes to the nearest 0.1× before stepping.
- **Media item:** the current source loaded into a video element. A load-start event or source change at metadata loading starts a new item for playback purposes.
- **Player override:** a website/player speed choice for the current media item. It does not change saved speed; metadata reloads, playback starts, new media, and explicit Zed actions restore saved speed.
- **Page action:** user intent handled by the background module, including saving preferences where needed and applying changes to a target page.
- **Saved preference:** stored choice, not proof of application to every open page.
- **Applied page state:** changes present in a particular document/frame; navigation or application failure can make it differ from saved preferences.
- **Settings transfer:** validated version-1 backup/export and partial import. Omitted values stay unchanged; unknown keys are ignored.

## Screenshot capture

**Selected area**:
A screenshot of a rectangle the user selects within the visible page.

**Visible area**:
A screenshot of the page content currently visible in the tab.
_Avoid_: Full page

**Full page**:
A screenshot of the entire rendered page, captured from native browser image strips without scrolling through it. A locked app shell may temporarily render at a taller viewport to expose its main panel.

**Element capture**:
A screenshot of a selected HTML element's entire rendered rectangle, including portions outside the viewport but excluding content hidden inside its own scrollable area.

**Screenshot preview**:
The captured image displayed with Copy to clipboard and Download actions before the user chooses either action.
