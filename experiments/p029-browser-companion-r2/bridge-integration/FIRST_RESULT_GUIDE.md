# Browser Companion R4 — first value

Goal: extension installation -> local Companion pairing -> consent to a chosen tab -> authorized AI action -> visible result -> revoke.

## Candidate 0.5.1 user path
1. Install LUCH Browser Companion (MV3 package, not currently published).
2. The computer must already run a compatible authorized LUCH Browser Bridge. Candidate R4 supports an embedded local broker on 127.0.0.1:9248, replacing the need for a separately started broker.
3. Click “Open LUCH Companion on this computer” in the popup. It opens a local setup page. Generate a new one-time pairing code and enter it in the extension. The 5-minute lifetime affects the pairing code only, not a granted tab.
4. Approve reading the selected tab. For clicks and typing, approve interaction separately.
5. Use a properly authorized LUCH AI host to inspect the selected tab and perform bounded page actions; the host checks the target and grant and returns the result. Unsupported routes refuse rather than silently switching browser sessions.
6. Inspect the page and revoke access. Repeated actions must fail.

## Existing Mac Bridge integration
The existing paired Mac Browser Bridge had a disabled browser companion switch and was read-only for extension targets. The R4 staging patch extends its adapter and normal browser action route and adds a broker that shares the existing private Bridge credential. This avoids a second separately managed LUCH process.

The integrator creates patched source in a NEW destination only if the inspected original Mac Bridge SHA256 matches 4486892bbeab0623f82c69516d3570ce1f02c6b53e9913501945461e4712f345. Nothing is installed on the Mac or in production by building the staging candidate.

Integration test command: node bridge-integration/integrate.mjs <inspected-server.mjs> <new-staging-dir> <candidate-root>

The generated server must be installed beside the original Bridge's other modules after independent approval. Runtime flags for that eventual test install are LUCH_BROWSER_COMPANION_ENABLED=1 and LUCH_BROWSER_COMPANION_EMBEDDED=1. The current running Bridge remains unchanged.

## Limits
This is NOT a public self-service installer. Users without a LUCH Companion or authorizable LUCH account still cannot complete installation from the Chrome button alone. OAuth tenant/device ownership, independent native Chrome and Opera MV3 tests and end-user UX evidence are still required. No marketplace listing has been changed.

## Release gates
Native headed Chrome 0.5.1 source-pinned real extension and popup E2E; Opera E2E; user session and multi-account routing, revoke race, sensitive actions/confirmation and restart/recovery; signed installer for new users; a truthful screenshot of actual result; independent QA acceptance. Gate: HOLD.
