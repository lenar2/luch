# LUCH Browser Companion · R1 QA Candidate

**Real Chrome-engine extension QA: PASS. Production deployment: HOLD.**

This is a Manifest V3 companion for **one tab the user explicitly chooses**. A local broker at \`127.0.0.1:9248\` mediates a one-time pairing code and 15-minute per-tab grants. Closing the tab, crossing a site origin, expiry, or pressing Revoke removes access. The remote AI cannot send arbitrary JavaScript or read cookies, history, or unrelated tabs.

## What actually works

- **Google Chrome for Testing 156.0.8078.47** in a disposable headed Linux session: 10/10 R1 end-to-end checkpoints passed.
- **Chromium 153.0.8010.12**, same isolated test: 10/10 passed.
- The browser denied content access **before** the user action. An X11 keyboard shortcut invoked the extension action; Chrome then granted \`activeTab\`. Only the chosen tab could be read via the real service worker and local broker, and both manual revoke and origin-change revoke worked.
- Local security tests: **12/12 passed**, including GET polling without \`Origin\` but **only with a current Bearer credential**, and rejection of foreign origins, wrong tokens, replay, and unauthorized writes.

## Discovered and fixed

Chrome MV3 service workers may send \`GET /extension/jobs\` without the \`Origin\` header. The earlier broker rejected it and caused the popup to disconnect immediately after pairing. The updated broker accepts such a **GET only with a valid current-session token**; POST operations still require the paired extension origin. See [QA evidence](QA_REPORT_R1_CHROME_20261109.md).

## What remains gated

- A native Chrome Stable manual installation and the final click on the real Chrome-owned toolbar popup's Grant button were **not independently verified**; the Chrome permission and underlying grant code were verified via a real action shortcut.
- User Tilda/GetCourse sessions, Opera, Firefox, Store publishing and OAuth tenant/device binding were **not touched or verified**.
- Browser Bridge and production LUCH remain unchanged. A later branch/release must integrate the companion into the ordinary tools, add isolated-to-user profile routing gates, and complete independent security and UX review.

No user Mac/Xcode, paid APIs, GitHub Actions, production browser state or user communications were used in these QA checks.

[Русская версия](README.ru.md) · [Chrome QA evidence](QA_REPORT_R1_CHROME_20261109.md) · [P029 issue](https://github.com/lenar2/ai-factory-evidence/issues/3835)
