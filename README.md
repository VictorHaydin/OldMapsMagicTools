# OldMaps.com.ua Magic Controls

A Chrome extension (Manifest V3) that adds an extra "Advanced settings" panel to the
dual map viewer on [oldmaps.com.ua](https://oldmaps.com.ua) — the site that lets you
compare historical maps of Ukrainian cities side by side with a modern map/satellite
view.

## Features

The extension adds a magic-wand button next to the site's own info/home buttons
(top-right of the viewer). Clicking it opens a settings panel:

- **Показати центр** — toggles the red crosshair marker in the center of each map.
  On by default, matching the site's own behavior.

- **Вигляд мапи** — switches between two view modes:
  - **Одна біля одної** (default) — the site's normal side-by-side layout.
  - **На ввесь екран** — overlays both maps on top of each other across the full
    viewer area, with the left map rendered above the right map. The two maps stay
    perfectly aligned since they're kept in sync by the site's own code
    (`leftmap.sync(rightmap)`); the extension just resizes both containers to the
    same full-size rect and tells Leaflet to redraw (`invalidateSize()`).

- **Прозорість** — appears only in overlay mode. A 0–100% slider that controls the
  opacity of the top (left) map's tiles, so you can fade it out to reveal the map
  underneath and visually compare the two layers at the same location.

In overlay mode, the two layer-picker buttons and the two attribution/credit panels
(normally one per map) are repositioned so both are visible and stacked — the
control belonging to the top map above the one belonging to the bottom map — instead
of one being hidden behind the other.

## Installation (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Open any map-viewer page on oldmaps.com.ua (e.g.
   `https://oldmaps.com.ua/lviv/?leftmap=200866&rightmap=google`).

## Files

- `manifest.json` — extension manifest (Manifest V3).
- `content.js` — builds the settings panel and implements the view-mode/opacity/
  center-marker logic.
- `content.css` — styling for the panel and button, plus the overlay-mode layout
  overrides.

## Implementation notes

- The content script runs in the page's **MAIN world** (`"world": "MAIN"` in
  `manifest.json`), not Chrome's default isolated world. This is required because
  the logic needs direct access to the page's own global Leaflet map instances
  (`window.leftmap`, `window.rightmap`, `window.layersleft`, `window.layersright`) —
  those aren't reachable from an isolated content script.
- `#leftmap` and `#rightmap` each create their own CSS stacking context, so once
  both are resized to the same full-size rect in overlay mode, a control living
  inside `#rightmap` can never render above `#leftmap`'s opaque tiles no matter its
  `z-index`. The layer-picker and attribution controls are therefore detached from
  their original map container and re-parented to `document.body` while overlay mode
  is active (and moved back on switching to side-by-side), so they can be
  positioned and stacked independently.
- The site applies some of its own styling to controls via ancestor-scoped selectors
  (e.g. `.leaflet-container .leaflet-control-attribution`) and CSS inheritance (the
  attribution's font comes from `.leaflet-container`'s `font` shorthand). Once an
  element is detached from its map container those rules stop matching, so the
  extension re-declares the equivalent styling directly.
- `.leaflet-container` (i.e. `#leftmap`) has its own opaque `background: #ddd`,
  separate from the tile pane. The opacity slider fades only the tile pane
  (`.leaflet-map-pane`), so `#leftmap`'s own background is also forced transparent
  in overlay mode — otherwise it stays opaque behind the faded tiles and blocks
  `#rightmap` from showing through.
