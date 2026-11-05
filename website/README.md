# LUCH website — AI-HEA V7 candidate

**Review-only. Not deployed.** Exact site source and browser evidence are in ChatGPT Library:

- `/LUCH-P036/QA/HEA-V7/LUCH_AI_HEA_V7_WEBSITE_SOURCE_20261105.zip` (source bundle)
- `/LUCH-P036/QA/HEA-V7/LUCH_AI_HEA_V7_QA_20261105.zip` (Chromium screenshots + test reports)
- `/LUCH-P036/QA/HEA-V7/LUCH_AI_HEA_V7_PREVIEW_20261105.png` (visual preview)

Source SHA256: `e5d9d597b4648f9c615f5273e7c790c17ce5df5bf4fb5adde220491ff2835844`

QA bundle SHA256: `e77e336e79215a52ba293b9e1d8758943e1b8190f6afb507938f48c1b610e688`

## What changes

- `index.html`, `en/index.html`, `ru/index.html`: **original AI-HEA-owned homepage design** in EN/RU with permission-aware task story and no fake activity UI.
- `assets/hea.css`: responsive visual system. Dark ink, warm paper, coral ray mark, typographic hierarchy, hand-built editable diagrams.
- `assets/hea.js`: accessible mobile menu, Escape close, tabs and arrow-key navigation.
- `assets/luch-ray.svg`: original vector mark for repository identity.

The source ZIP also contains **33 routes**, retaining V6 secondary pages (unchanged) plus their legacy CSS/JS. The content/visual system on those secondary pages is inherited, not claimed as independently redesigned. This PR includes the **new overlay source**, not the inherited 33-route tree; use the source ZIP for a full offline review.

## Preview locally

Copy the four HTML/CSS/JS overlay files and root homepage into the V6 static tree at the equivalent paths, then serve the static root using any local HTTP server. E.g. `python3 -m http.server 8080 --directory site` from a checkout that contains the full ZIP source. Open `http://localhost:8080/ru/` or `/en/`.

No CDN, remote font or analytics scripts are required. No OAuth, payments, server services or LUCH control plane are changed.

## Observed test scope

- **132/132 Chromium source renders**, 33 routes × 320/390/768/1440 px.
- **1,524 static local-link resolutions**, no missing local links or horizontal overflow.
- EN/RU homepage menu, Escape, tabs, arrow keys, first viewport and asset-free source rendering checked separately; 80 local link checks in these 8 home states.
- All tests are **local-source UI tests**, **not proof of deployed HTTP**, independent-user activation, browser availability across hosts, or real LUCH task completion.

## Quality gate

**SELF_READY: HOLD** until independent QA reads exact source, challenges visual coherence and copy, checks screenshots, and the Founder accepts visually. No production deployment or merge is authorized.

Original P036 V4/V5/V6 artifacts remain in Library as comparative history. Product capability claims are bounded by account/host/device and permission; GetCourse read-only, Tilda authoring limited, Chat Bridge execution conditional, iPhone native remote control not claimed.
