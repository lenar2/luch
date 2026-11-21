# Chrome Web Store — LUCH Browser Companion 0.7.0 · HEA R19 submission pack

**State:** Candidate ready for Chrome developer review **after Google owner authentication and remaining security gates**. Not submitted or publicly available as 0.7.0. The public store currently still lists the old 0.4.0.

## What customers see

Complete, HEA-reviewed Russian and English listing descriptions: [STORE_LISTING_HEA_R18.md](STORE_LISTING_HEA_R18.md), updated for Chrome 0.7.0 and on-demand advanced pointer permission.

**RU short:** Ваш ИИ понимает выбранную вкладку Chrome. Чтение и действия — только с вашего разрешения.

**EN short:** Help your connected AI understand a Chrome tab you approve. Reading and actions require separate permission.

Do not claim that the extension automatically connects to every ChatGPT plan or provides unrestricted click/typing access. Connecting an eligible AI host through OAuth-protected MCP is a separate action; the actual available tools vary by plan and workspace.

## Actual 0.7.0 popup screenshots — new preferred set

Use the new [R19 Chrome screenshots](store-assets/r19/), **not the older R18 onboarding illustration as the primary screenshot**.

| Locale | Order | File | What it explains |
| --- | --- | --- | --- |
| RU | 1 | `chrome-01-ru-approved-1280x800.jpg` | Only a chosen page is readable, with revoke visible |
| RU | 2 | `chrome-02-ru-before-consent-1280x800.jpg` | Explicit per-tab read button before any sharing |
| RU | 3 | `chrome-03-ru-interaction-1280x800.jpg` | Interaction requires an additional approval |
| EN | 1 | `chrome-01-en-approved-1280x800.jpg` | Selected tab readable and revocable |
| EN | 2 | `chrome-02-en-before-consent-1280x800.jpg` | Per-tab permission comes first |
| EN | 3 | `chrome-03-en-interaction-1280x800.jpg` | Interaction is independent |

All six were rendered from **actual extension 0.7.0 popup code executing inside Chromium**, with deterministic test state and harmless example.com. They are not photographs of an actual customer session or proof of live OAuth; that distinction is printed on each picture. Both locales use exactly the same tested layout. Google may request different or less composed screenshots during review; use the raw captures for inspection if necessary.

**Existing brand promotional assets:** `store-assets/r18/chrome-promo-small-440x280.png` (440×280) and `store-assets/r18/chrome-promo-marquee-1400x560.jpg` (1400×560). The 128×128 icon remains the exact icon from the extension manifest. Brand art follows the approved LUCH site mark.

## Privacy & install permissions

**Required at install:** `activeTab`, `scripting`, `storage`, `alarms` and scoped host `https://api.lenarsalimov.ru/luch/browser/*`.

**Optional, requested only when needed:**
- `tabs` — explicit optional all-tab metadata overview
- `debugger` — requested from Chrome ONLY when the user chooses to enable advanced precise-pointer control in a tab; standard read or pairing does not request it. Once granted, Chrome may retain this optional permission until the user removes it.

Content of an approved page may travel through the LUCH cloud relay to the authorized AI host. Store Privacy Practices must reflect that data processing and retention.

## QA and publication

The final branch candidate ZIP, its SHA-256 and updated tests are referenced from [R19 HEA + engineering audit](R19_HEA_ENGINEERING_AUDIT.md). The old R18 ZIP checksum is obsolete.

**Chrome Web Store item:** `lbijjcmjnlcbooadjgjignfmhaiealpd`. Update in place, no duplicate extension. The current publisher browser session requires the Google owner to complete reauthentication; no credential bypass is allowed. Even after sign-in, independent new-user OAuth / cross-account isolation and live host catalog refresh must pass before claiming mass availability. Chrome Web Store moderation is separate.

**Decision today:** NOT SUBMITTED. The installed old 0.4.0 is not the new cloud 0.7.0.
