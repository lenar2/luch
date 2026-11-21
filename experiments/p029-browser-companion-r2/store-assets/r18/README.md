# LUCH Chrome Web Store imagery · HEA R18 (candidate 0.7.0)

**21 November 2026 — prepared, not submitted or approved by Google.**

| File | Dimensions | Origin and truthful use |
| --- | --- | --- |
| `chrome-store-icon-128.png` | 128×128 | The exact icon in the reviewed 0.7.0 extension's manifest |
| `chrome-promo-small-440x280.png` | 440×280 | Promo tile based on the approved LUCH site brand mark |
| `chrome-promo-marquee-1400x560.jpg` | 1400×560 | Optional marquee illustration, no user data |
| `chrome-screenshot-01-real-onboarding-1280x800.jpg` | 1280×800 | Actual latest 0.7.0 popup captured in clean Chromium + real harmless example.com test page; first-use state only |

## Evidence and packaging

A clean private browser test loaded the **deterministic Chrome 0.7.0 ZIP**, saw its actual background service worker, verified that the first-use popup was connected to the correct setup link, and reported zero JavaScript page errors. No user pairing code, token, account content, payment site or personal data appears in the screenshot.

The screenshot is not evidence of a completed paired interaction; that separate positive read and revocation E2E was completed earlier in the owner's authorized ChatGPT + Chrome pilot. The brand UI card in the marquee is an **illustration**, not a claimed real Chrome popup.

**Verified exact ZIP SHA-256**: `128447d4b2d9f80731bf20ed31e0d240a40487c9a55e464a9cb0369854e1e9d8`

**Files are for store preparation only; public listing still runs 0.4.0 until Google authenticates the owner and accepts an update.** Chrome may request additional screenshots or permission justification during review. Do not submit unverified AI-generated concept screens as if they were product UI.

The actual screenshot renderer source is [`render-chrome-r18.cjs`](../render-chrome-r18.cjs), using the exact [`chrome-clean-package-smoke-r18.cjs`](../../tests/chrome-clean-package-smoke-r18.cjs) capture output. Rendering runs within a disposable Chromium container; no GitHub Actions or Claude used.
