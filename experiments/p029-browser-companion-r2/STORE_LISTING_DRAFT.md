# LUCH Browser Companion · Chrome Web Store submission packet — HEA R18

**Candidate:** Chrome 0.7.0 · **Status:** PREPARED / NOT SUBMITTED · 21 November 2026

## Source of truth for customers

[**Read the complete Russian and English customer descriptions**](STORE_LISTING_HEA_R18.md).

This is the HEA-reviewed copy to paste into Chrome Web Store. The old local-broker 0.4.0 and 0.6.0 descriptions must **not** be reused. LUCH now uses an OAuth-protected cloud MCP connection (for eligible host clients) and per-tab Chrome extension consent.

**Short RU:** Ваш ИИ понимает выбранную вкладку Chrome. Чтение и действия — только с вашего разрешения.

**Short EN:** Help your connected AI understand a Chrome tab you approve. Reading and actions require separate permission.

## Artwork for the Chrome listing (exactly checked sizes)

All four files are actual binary GitHub assets in [`store-assets/r18/`](store-assets/r18/), not conceptual promises:

| Asset | File | Size | Status |
| --- | --- | --- | --- |
| Store icon | `chrome-store-icon-128.png` | 128×128 | Current 0.7.0 manifest icon |
| Small promo | `chrome-promo-small-440x280.png` | 440×280 | Brand graphic from approved LUCH site mark |
| Marquee promo | `chrome-promo-marquee-1400x560.jpg` | 1400×560 | Brand graphic; optional |
| Store screenshot | `chrome-screenshot-01-real-onboarding-1280x800.jpg` | 1280×800 | **Genuine Chrome 0.7.0 clean-install popup + real harmless example.com capture**, no account content |

The promotional images use the exact site-branded LUCH app mark. The screenshot displays the real first-use popup rendered by the exact 0.7.0 ZIP in Chromium, not a fabricated paired state. Separate AI-generated premium hero concepts are **not** substitutes for honest product screenshots.

## QA evidence

- 41/41 Node tests pass on LUCH Server; 21/21 legacy local-broker negative tests pass.
- Clean Chromium installation of **the exact ZIP** passes: background service worker, popup startup, first-use copy and JavaScript error-free; safe `example.com` fixture loads.
- Prior signed-in owner's ChatGPT Plus + Chrome pilot confirmed one-time pairing, approved read, revocation and denied repeat read.
- Current deterministic 0.7.0 ZIP SHA-256: `128447d4b2d9f80731bf20ed31e0d240a40487c9a55e464a9cb0369854e1e9d8`.
- Chrome's public listing currently remains **0.4.0** and uses obsolete local-broker text. Do not claim 0.7.0 is live.

## Publishing prerequisites and exact blocker

The existing Chrome Web Store publisher account was reachable, but Google prompted the owner to **reconfirm account identity**. Until the owner completes authentication, no draft fields or ZIP can be uploaded using the current authorized Chrome session.

After owner confirmation, the existing listing ID is **`lbijjcmjnlcbooadjgjignfmhaiealpd`**. Do not create a duplicate extension. Upload the exact audited ZIP as an **update** to the existing item, replace the full listing and image assets, update Privacy Practices to disclose page content, auth information and the install-time debugger permission, review Distribution, then submit for Google review (not automatic public availability).

**Further security blockers before sending to all users:** new-user OAuth onboarding, cloud write/interaction and cross-account isolation E2E, independent review of required debugger permission. Do not bypass these merely because the owner authorized publication; label status accurately.

## Client/AI perspective

The buyer must understand in seconds: **I already have an AI; LUCH connects a tab only with permission; first I must check my AI supports MCP.** The agent must discover its actual tools and an approved tab, not hallucinate access or demand a model API key.

[Detailed R17 release gates](RELEASE_READINESS_R17.md) · [Latest HEA copy and review](STORE_LISTING_HEA_R18.md) · [Chrome setup guide](https://github.com/lenar2/luch/blob/main/docs/CHATGPT_CONNECT.ru.md).
