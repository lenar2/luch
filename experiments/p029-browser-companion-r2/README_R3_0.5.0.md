# LUCH Browser Companion v0.5.0 — expanded isolated candidate

**Release status:** QA CANDIDATE / NO MARKETPLACE UPDATE YET.
Current Chrome Web Store listing remains at v0.4.0; Opera v0.4.1 is awaiting moderation.

### Implemented code
- 16 read/inspection and 23 tab-interaction/navigation operation identifiers via explicit structured jobs. No arbitrary remote JavaScript.
- Separate user approval for reading versus interacting; grant limited to user-selected tab and origin.
- No 15-minute permission timer. Grants are stored in Chrome's session storage; they terminate on explicit revoke, browser/tab close or cross-origin change. Broker has an internal inactivity heartbeat, not a lifetime cutoff.
- New human-first LUCH popup. Store tile: R22.11.4 provisional full LUCH app mark exported as 128px PNG from the original 256px source. Toolbar/popup micro icons 16/32/48px: selected plugin B variant, readable at small sizes. Both from lenar2/luch PR #11 commit 3d74789168299daa7ce3cef91a68e949e319eeae.
- Broker and local adapter expose the expanded job contract. Both preserve the original private loopback credentials and fail-closed approval checks.
- Protected password/file inputs and form submits are blocked; non-extension-created personal tabs cannot be arbitrarily closed.

### Boundaries
The extension is NOT the whole LUCH Browser Bridge or its 13 server browser tools. It cannot make native OS keyboard/mouse events, arbitrary file uploads/downloads, Chrome debugger/console features or all 54 global LUCH browser calls available through this one channel. No claims of a production PASS, installed customer connector or general public onboarding.

The current standalone local broker is only 127.0.0.1:9248 and not integrated with production OAuth/device routing. Review the source, tests, user consent and tenant isolation before publication.

### Verify
Run node --test tests/*.test.mjs; node security-qa.mjs; node --check extension/background.js; node --check extension/dom-ops.js; node --check extension/popup.js; then ./package.sh. This builds the MV3 ZIP, not an approved store release.

The earlier v0.4.0 E2E report is historical; it does not independently certify this candidate.

### Independent code review note
The first 0.5.0 click guard had an English-focused label blacklist with nonworking ASCII word boundaries for Cyrillic. The reviewed candidate now blocks common payment, transfer, deletion and publishing labels in EN/RU, with regression fixtures. This still does not constitute a complete high-impact action classifier; unclassified consequence-bearing clicks require further human-in-the-loop safeguards before public release.
