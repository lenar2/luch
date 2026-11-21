# P029 Browser Companion R4 · First-result verification, 2026-11-16

**Status: source/staging tested; production and marketplace HOLD.**

Original user Mac Browser Bridge inspected READ ONLY. SHA256 4486892bbeab0623f82c69516d3570ce1f02c6b53e9913501945461e4712f345. Source includes an existing feature gate and a read-only extension adapter. To avoid publishing private machine code, the full source is held only in isolated temporary staging, never committed.

R4 change: local one-time code setup page with CSRF and no restart, popup link to Companion; exact-source guarded Browser Bridge integration shim, local embedded broker, scoped host action routing, authorized tab read/interact/revoke; 15-minute user grant timer remains removed. New manifest version 0.5.1.

Exact stage ZIP: LUCH-Browser-Companion-v0.5.1.zip, 49031 bytes, SHA256 f0b1acc0f4dd6556a33c6ae4fe2aa688fbce5f19be66303056eb73385d0bb284.

Evidence: Node suite 14/14 PASS including synthetic full first-value funnel that uses the actual local HTTP broker, VM-simulated extension worker, allowed AI action to update a fixture field, read-back verification and revoke denial. Broker negative/security suite 21/21 PASS. Syntax checks on patched original source and candidate modules PASS; MV3 ZIP verification PASS.

**Not proven:** no real installed Chrome/Opera service-worker and popup E2E on this exact version; no real client account/tenant OAuth E2E; no active Mac Bridge replacement or restart; no user self-service Companion installer; no live store submission. Existing public Chrome still v0.4.0. Stage candidate and no production changes should not be described as feature deployment or approval.

Independent release QA must falsify the exact archived SHA and E2E with an approved tab, action and revoked grant before production.

Reproducible ZIP: package.sh now sets fixed ZIP timestamps, sorted entries and permissions. Two builds with changed source mtimes produced the same SHA256 f0b1acc0f4dd6556a33c6ae4fe2aa688fbce5f19be66303056eb73385d0bb284 .
