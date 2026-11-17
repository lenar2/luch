# P029 — Browser Companion product audit & onboarding R1

**Audit date:** 17 November 2026  
**Repository:** `lenar2/luch`  
**Working PR:** [#12](https://github.com/lenar2/luch/pull/12)  
**Audited source HEAD:** `84d67d1e4464d60031d984d781aff4eb22197c3e)  
**Target candidate:** 0.5.2  
**Release decision:** DRAFT / HOLD — not a store submission or production activation.

## Executive finding

The 0.5.2 code is materially stronger than the public 0.4.0 extension, but the user journey is not yet a general self-service product. The main problem is not the number of browser operations: it is the gap between installing the extension and having a supported local Companion plus an authorized LUCH AI host.

The onboarding previously led with “your AI” and “installation help” without stating the prerequisites early enough. A user could reasonably infer that installing the extension connects an AI or installs the desktop service. That is not true.

## Confirmed product facts

- Manifest V3, extension version 0.5.2.
- Extension operation contract: 16 read/inspection and 23 interaction/navigation identifiers.
- The broader LUCH browser API inventory includes separate local-browser and server-browser providers. Those are not 54 extension features.
- Minimal permissions: `activeTab`, `scripting`, `storage`, `alarms`; host access is limited to `http://127.0.0.1:9248/*`.
- The local pairing code is single-use and expires after five minutes.
- Tab grants are session-scoped and end on explicit revoke, tab close, browser-session end or cross-origin navigation.
- Read access and interaction access are separate.
- The headed Chromium E2E has previously proven real MV3 registration, local pairing, a user-triggered activeTab grant, a real page action, readback and revoke denial.
- The account-bound Mac installer work remains a preview. The authorized Mac shadow canary passed, but live Bridge cutover/rollback and a new-user public installer remain unverified.
- The current public Chrome listing is still 0.4.0. Opera's previously submitted 0.4.1 is not the 0.5.2 candidate.

## Findings and severity

| Severity | Finding | Product consequence |
|---|---|---|
| P0 | No general public self-service Companion installer or fresh-user authorization flow | A new user cannot complete onboarding from the extension alone |
| P0 | Browser pairing and AI-host authorization are separate, but earlier popup copy blurred them | Users may pair successfully and still see no browser tools in their AI |
| P0 | Live Bridge activation is not proven; current Mac evidence is an isolated shadow canary | Do not claim production AI routing or general availability |
| P1 | Opera 0.5.2 has no independent exact-build runtime E2E | Do not claim Opera compatibility is verified |
| P1 | Old support/privacy material described a 15-minute grant TTL | It contradicted the candidate's session-scoped grant behavior |
| P1 | The temporary micro-L B plugin mark is not founder-approved | Do not ship it as the final store icon |\n| P1 | Popup status used the one-time extension job queue as a health probe | It could consume a pending AI action and cause a timeout |
| P1 | Current public screenshots/listings do not yet represent the 0.5.2 product journey | Store submission would set the wrong expectation |

## R1 changes in this candidate

1. Rewrote the popup around the exact product action: share a chosen tab with LUCH.
2. Made the local Companion prerequisite explicit before the pairing form.
3. Added a direct boundary statement: pairing connects the browser to the local Companion only; it does not install the desktop app or authorize an AI host.
4. Changed the status from generic “Connected” to “Browser paired”.
5. Added separate, localized EN/RU setup steps, one-time code guidance, user-friendly error messages and eight-digit input validation.
6. Disabled tab-sharing controls when the active page is not a normal HTTP(S) webpage.
7. Reworked the local pairing page in English and Russian, with clearer code lifetime and authorization boundaries.
8. Added candidate support and privacy documents that match the 0.5.2 code and grant lifecycle.
9. Replaced the single generic store draft with separate Chrome and Opera copy, EN/RU localizations, permission explanations, asset sizes and explicit release gates.
10. Extended the real headed Chromium test to capture the actual popup states and fixture page for store-artwork composition.\n11. Fixed a queue-stealing defect: popup status now uses an authenticated, read-only `/health` check rather than consuming `/extension/jobs`; regression tests verify a pending action remains available.

## Store asset and brand rules

- The full luminous LUCH app mark remains approved for the app brand and supporting promotional artwork.
- The old standalone L plugin icon is rejected by the founder; micro-L B was only a temporary selection and is not the final extension icon.
- A new non-letter ray/aperture vector is included only as a review candidate. It is not wired into the extension manifest and is not described as approved.
- The existing Figma source of truth is “LUCH — HEA Identity Studio”, R22.11.4. Figma MCP editing is currently blocked by the account's Starter-plan tool-call limit; no Figma canvas changes are claimed by this commit.
- Chrome screenshot compositions use actual popup and page captures generated by the headed Chromium E2E. They do not prove Opera runtime behavior.
- Opera requires its own exact-build test and screenshots from Opera before submission.

## Remaining release gates

1. Approve the final non-letter plugin mark in the existing Figma source and export final icon sizes.
2. Finish a public, repeatable Companion installation and account authorization path for new users, or explicitly restrict the early-access listing to supported setups.
3. Independently verify live Browser Bridge activation, rollback and account/tenant routing; shadow tests are not production deployment.
4. Run the exact final candidate in Opera and capture Opera-specific screenshots.
5. Validate the final ZIP checksum against the listing version and privacy disclosure.
6. Obtain independent security, UX and store-policy review before any upload.

## Safety boundary

This work changes only the isolated PR candidate. It does not update the public Chrome or Opera listings, activate the live Mac Bridge, restart production services, change customer sessions or merge the PR.
