# Browser Companion store artwork — candidate 0.5.2

This folder contains editable SVG artwork and a deterministic Playwright renderer. The renderer creates PNG previews from the exact current extension UI captures produced by the headed Chromium E2E test.

## Brand

- `luch-app-mark.svg` is copied byte-for-byte from the approved R22.11.4 app mark in brand PR #11 (source commit `3d74789168299daa7ce3cef91a68e949e319eeae`). It is used only as a supporting LUCH brand mark in promotional artwork.
- `extension-icon-ray-candidate.svg` is a new non-letter extension-mark study. It is **not approved** and is not wired into `extension/manifest.json`. The old micro-L B is also not approved as the final plugin mark.
- The existing Figma source remains “LUCH — HEA Identity Studio”, R22.11.4. This repository draft does not claim that the Figma canvas was edited.

## Source assets

- `chrome-small-promo.svg` — 440×280.
- `chrome-marquee.svg` — 1400×560.
- `extension-icon-ray-candidate.svg` — 128×128 vector source; Chrome's store export uses 96×96 artwork centered in a 128×128 transparent canvas, while Opera uses a full 128×128 background icon.
- `luch-app-mark.svg` — approved app-mark source used in the promo artwork.

## Rendered outputs

Run `node store-assets/render.mjs` after the headed Chromium E2E has created `dist/store-captures/`.

The renderer outputs:

- Chrome screenshots: four 1280×800 PNG compositions containing real extension-popup and fixture-page captures.
- Chrome small promotional tile: 440×280 PNG (required by current Chrome Web Store image guidance).
- Chrome marquee promotional tile: 1400×560 PNG.
- Candidate icon PNGs: Chrome 128×128 with 96×96 artwork and 16px transparent padding; Opera 128×128 full-bleed; shared 48×48, 32×32 and 16×16 variants.
- Opera preview compositions: four 612×408 PNGs.

The Opera images are **preview-only** until the exact build has passed Opera runtime E2E and new screenshots have been captured in Opera. Do not upload Chrome-captured previews as proof of Opera testing.

The candidate icon PNGs are visual studies only. Do not replace the manifest icons or submit them until the founder approves the final plugin mark.

## Capture integrity

The screenshots embed actual popup and local fixture-page captures from the test run. The fixture is a synthetic local QA page, not a customer's website or a claim of a live customer task. The artwork is an explanatory composition around those real captures; it is not a raw browser-window screenshot.
