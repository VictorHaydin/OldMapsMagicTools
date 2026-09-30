Language: **English** | [Українська](README.md)

# OldMaps.com.ua Magic Tools

A Chrome extension (Manifest V3) with two independent feature sets for two
different old-maps websites:

- **[oldmaps.com.ua](https://oldmaps.com.ua)** — an extra settings panel for
  comparing historical maps.
- **[uma.lvivcenter.org](https://uma.lvivcenter.org)** — a button to download
  a map image at its maximum resolution.

## oldmaps.com.ua: extended map-viewer settings

The extension adds a magic-wand button next to the site's own info/home buttons
(top-right of the viewer). Clicking it opens a settings panel:

- **Вигляд мапи** (view mode) — switches between two view modes:
  - **Одна біля одної** (side by side, default) — the site's normal
    side-by-side layout.
  - **На ввесь екран** (full screen) — overlays both maps on top of each other
    across the full viewer area, with the left map rendered above the right
    map. The two maps stay perfectly aligned since they're kept in sync by the
    site's own code (`leftmap.sync(rightmap)`); the extension just resizes
    both containers to the same full-size rect and tells Leaflet to redraw
    (`invalidateSize()`).

  This mode is unavailable while the site's own single-map mode is active
  (the window-icon button next to the home button) — and conversely, that
  site button is disabled while "На ввесь екран" is active, so the two modes
  can never both be on at once.

- **Прозорість** (opacity) — appears only in full-screen mode. A 0–100%
  slider that controls the opacity of the top (left) map's tiles, so you can
  fade it out to reveal the map underneath and visually compare the two
  layers at the same location.

In full-screen mode, the two layer-picker buttons and the two attribution/credit
panels (normally one per map) are repositioned so both are visible and
stacked — the control belonging to the top map above the one belonging to the
bottom map — instead of one being hidden behind the other.

> The extension used to have its own "Показати центр" (show center) toggle
> for the red crosshair marker in the middle of each map. It was removed once
> the site added its own button (a crosshair icon) with the same function —
> keeping a duplicate no longer made sense.

## uma.lvivcenter.org: download a map at maximum resolution

On map pages (e.g.
[uma.lvivcenter.org/uk/maps/34441](https://uma.lvivcenter.org/uk/maps/34441)),
clicking the map thumbnail opens a full-screen viewer. A download button
appears below its close button (top-right corner). Clicking it:

1. Reads the image's full dimensions and the top-resolution tile grid
   directly from the site's own live OpenSeadragon viewer instance (the site
   uses the Zoomify tile format).
2. Downloads every tile at that resolution (several requests in parallel,
   with retries on failure), showing progress right on the button.
3. Stitches them onto a `<canvas>` at the image's native size.
4. Exports the result as a JPEG and immediately saves it to disk via the
   browser's own download mechanism.

## Installation (unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Open any map-viewer page on oldmaps.com.ua (e.g.
   `https://oldmaps.com.ua/lviv/?leftmap=200866&rightmap=google`) or a map
   page on uma.lvivcenter.org (e.g.
   `https://uma.lvivcenter.org/uk/maps/34441`) and open the map viewer by
   clicking its image.

## Files

- `manifest.json` — extension manifest (Manifest V3) with two independent
  content scripts, one per site.
- `content.js` / `content.css` — the settings panel and its logic for
  oldmaps.com.ua.
- `uma-content.js` / `uma-content.css` — the download button and tile-stitching
  logic for uma.lvivcenter.org.

## Implementation notes

### oldmaps.com.ua

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
- The extension watches `<body>`'s `class` attribute via a `MutationObserver`
  so both modes stay correctly enabled/disabled regardless of which button
  (the site's or the extension's) the user clicks, and automatically falls
  back to side-by-side if the site switches to single-map mode while
  full-screen mode is still active.

### uma.lvivcenter.org

- The site uses OpenSeadragon 2.4.2 with the classic Zoomify tile format
  (`TileGroup{N}/{level}-{col}-{row}.jpg`). Rather than reimplementing the
  Zoomify tile-numbering algorithm independently, the content script
  monkey-patches the global `window.OpenSeadragon` constructor to capture the
  viewer instance the site itself creates, then, when the download button is
  clicked, reads its real `source.maxLevel` and `source.gridSize` and calls
  its own `source.getTileUrl(level, col, row)` method. This works for any map
  on the site, not just one specific example, and stays correct even if the
  site's own tiling implementation changes.
- As with oldmaps.com.ua, both the content script and the `OpenSeadragon`
  monkey-patch need to run in the page's **MAIN world** — the page's own
  `OpenSeadragon` global isn't reachable from an isolated content script.
- The download button is appended as a child of `#zoomify-container`, the
  same container the site's own close button (`.zoomify-close`) lives in, so
  it automatically shows and hides together with the map viewer with no
  extra visibility logic needed.
- Tiles are fetched with limited concurrency (6 requests at a time) with
  retries on network failure, and progress is shown right on the button (in
  its tooltip and as a thin bar along its bottom edge).
