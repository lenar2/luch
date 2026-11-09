# P029 Browser Companion R2 · isolated Chromium execution and release boundaries

Date: 10 November 2026. Candidate: version 0.4.0, product name **LUCH Browser Companion** (no QA suffix). Source branch: `feat/p029-browser-companion-r2-release-candidate-20261110`; predecessor: R1 `fe7d22780e75e254f99aa7dbda0288c23e478060`.

## Execution method
Non-production Docker container `p004-skley-stable-chrome:manual-r1`, graphical Xvfb, isolated new Chromium 153.0.8010.12 persistent profile, temporary fake pages on 127.0.0.1, transient local broker 127.0.0.1:9248, genuine Chrome Manifest V3 worker. No live user accounts, cookies, sessions or production routes were used. The Chrome action was triggered via test-only keyboard shortcut in an ephemeral copy of the extension; the production extension manifest has no shortcut and no broad permission.

Run: `docker run --rm --network none --shm-size=512m --security-opt no-new-privileges --cap-drop ALL -v "<candidate>:/qa:rw" --entrypoint /bin/sh -w /qa p004-skley-stable-chrome:manual-r1 -lc "xvfb-run -a -s '-screen 0 1365x900x24' node /qa/tests/runtime-e2e-r2.cjs"`.

Results:
- R2 real MV3 Chromium E2E: **10/10 PASS**.
- R2 contract/service worker mocked execution: **4/4 PASS**.
- R2 negative broker HTTP suite: **18/18 PASS**.

## What is confirmed
Real extension worker starts, native popup can submit a code for pairing, server-worker exchange authenticates despite originless credentialed GET polling, unapproved tabs cannot be read, a real browser extension action grants `activeTab`, approved synthetic tab appears in broker inventory and is read through the worker with bounded text, unrelated tab remains hidden, revoke denies subsequent reads, origin change removes the grant. Static Chrome ZIP validation + Manifest V3 package passed. Uploaded *draft* Chrome Web Store package is version 0.4.0 without QA in the public title.

## Crucial limits / must NOT claim
- Native popup **Grant** button was not separately exercised; runtime harness reports `popupInteractive:false` after OS shortcut, then calls the worker. This remains a manual user-consent test.
- No authenticated real Chrome/Opera accounts, no real-user consent, no stable pairing package installer, no verified onboarding for Windows/macOS, no independent QA conclusion.
- **No complete cloud OAuth / tenant-scoped relay** from Chrome Browser Companion to LUCH account and existing user-authorized `browser_tabs` / `browser_read_text` route yet. No user-facing production release.
- Chrome Web Store account verification remains unresolved; no Store review submission, no publication.
- Store ZIP (generated on Mac after the checked commit): SHA-256 `f4d8c5a3bee5ad41364077398066e50a651008844cd9c26309e82f5e8ebe7ca4`. Identical source can produce differing ZIP byte checksums due to timestamps, so QA should compare each archive member/hash as well as exact reviewed store ZIP.
- Public production / Xcode unchanged.

**Verdict: ISOLATED_CHROMIUM_PASS / PRODUCT_RELEASE_HOLD / INDEPENDENT_QA_PENDING.**
