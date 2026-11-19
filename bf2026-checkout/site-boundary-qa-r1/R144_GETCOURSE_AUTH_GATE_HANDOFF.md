# BF2026 R144 — GetCourse 901 auth isolation and fail-closed Import API adapter

Date: 2026-11-19; existing PR #17 only.

## Live read-only diagnostic

The production checkout server was checked inside the running Docker container as UID 1001. No secret bytes, secret hashes, request body, or provider error message were printed.

Native GetCourse UI evidence #7008735800 identifies account singleladiesschool (ID 67138), API key row 54763, read/write permission, and the owner-confirmed key file /app/private/getcourse-import.key. File metadata: regular 128-byte file, owner 1001:1001, mode 0600; parent directory mode 0700.

Exact documented read-only request:
- POST https://study.shkola-dnv.com/pl/api/account/fields
- Content-Type: application/x-www-form-urlencoded
- POST body fields: action=Get and key=<secret>
- Redirects denied; normal HTTPS certificate and hostname verification.
- Secret is sent in POST body only, never URL, headers, logs or output.

Fresh control comparison:
- Owner-confirmed key row 54763, custom domain: HTTP 200 transport, provider success=false, error 901.
- Same key, system domain singleladiesschool.getcourse.ru: HTTP 200 transport, provider success=false, error 901.
- Same key, action=Get and action=get: 901.
- Separate legacy file secrets/getcourse_import.key, same endpoint, host, method, action and encoding: HTTP 200 and provider success=true for the read-only fields catalogue. This file is byte-different and has no native UI evidence linking it to row 54763. It is NOT selected as a fallback and is NOT authorized for writes.

This isolates the failure to GetCourse acceptance/association of the new key or its account binding, not Docker mount, runtime UID, file mode, TLS, host, POST method, body encoding or action case. Official GetCourse docs describe 901 as an invalid account name or API key. Native UI confirms account identity; GetCourse must reconcile the exact key row/secret or advise why that row is rejected. Do not create or overwrite another key until provider support/native UI establishes the cause.

## Code changes in PR #17

- r141-server-key.cjs no longer has a default credential path. Callers must pass an explicit file path; there is no implicit fallback to secrets/getcourse_import.key. It uses documented action=Get and classifies 901 separately.
- r144-getcourse-import-adapter.cjs is pinned to /app/private/getcourse-import.key, account 67138, key row 54763. It provides read-only auth/schema probing only. Order creation, live unpaid-order readback and payment-link methods return explicit 503 fail-closed results without network activity.
- Tests cover exact POST contract, 901 classification, no secret leakage, explicit key path and denied order/readback/link calls.

## Why no live order was created

Official GetCourse API documentation says /pl/api/deals is intended for importing data, not operational real-time object management. Therefore a successful read-only catalogue response does not establish live checkout. The adapter intentionally does not POST /pl/api/deals and does not treat export jobs as immediate order readback.

No unpaid order, payment, receipt, mailing or access grant was created. No production server.js, public asset, native GetCourse UI or existing payment button was changed. Production contact route remains fail-closed. Lot10 remains owner-authorized OPEN FOR SALES, with its existing 2–5 cart and R142/R143 route preserved; it is not marked technically payment-ready.

## Next real provider step

GetCourse support/native account owner must reconcile API row 54763 with the exact owner-confirmed secret and 901 response. Once a supported real-time order mechanism is independently documented and authenticated, integrate it separately into R141 (single Offer) or R142/R143 (Lot10 2–5 Offers). Require one real unpaid native order readback with exact Offer IDs, total, buyer contact, consent and actual provider payment_link before release. Do not use the legacy read-only key for writes or infer real-time checkout from Import API.
