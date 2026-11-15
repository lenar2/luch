# BF2026 · GetCourse R3.1.2 — privacy & bounded write gate evidence
Date: 2026-11-15. Source lineage: [BF2026 #4073](https://github.com/lenar2/ai-factory-evidence/issues/4073), previous [R3.1.1 containment](./BF2026_R3_1_1_CONTAINMENT_AND_DRAFT_IMPLEMENTATION.md).
**SALES HOLD / NONELIGIBLE CHECKOUT DENIAL NOT PROVEN.** Do NOT interpret read-only probes or a nonactual status as checkout security PASS.

## Current live offer readback
- Host: `study.shkola-dnv.com`.
- Offer ID `8919715` `BF2026 · Союз нового времени · 5 990 ₽ · PRELAUNCH`.
- Status **Неактуален**, persisted after fresh native GetCourse UI reload. This is the strongest verified containment.
- Access type: `Видеть и оформить заказ могут только те, кто входит в сегмент`, but the actual selected arbitrary segment contains **NO saved predicate**; no count==1/email equality on fresh readback.
- Tried native rule-builder `Добавить условие` → `ID объектов` and `Эл. адрес содержит` through ordinary LUCH browser accessibility. The requested dropdown entries were located at off-viewport CSS y positions (e.g. 2577 vs 1322 viewport); apparent click success did NOT produce a durable condition. Later browser scroll returned CDP timeout. Nothing from this attempt should be counted as a saved restriction.
- Tried native datepicker (not just raw text): picked **14 Nov 2026**, saw field value `14-11-2026`, pressed ordinary `Сохранить`. After independent `browser_reload`, field was EMPTY again. Therefore **no second valid-before/expiry guard** persisted.
- A `Скрывать недоступные в форме продаж` GUI attempt did NOT persist (readback checkbox still unchecked); do not count it as a guard.
- No new order, payment, purchase, entitlement, mailing, real test customer, offer or site page was created.

## LUCH authorization and execution route probe
- `getcourse_status` originally confirmed `AUTHENTICATED` to admin route. Current provider occasionally reports `AUTH_CONFLICT` because a browser probe returns UNKNOWN, while another probe still reaches admin; do not treat unstable authentication as safe write readiness.
- Provider `luch.getcourse.v0.5`: `readiness: READ_ONLY_UI_READY` when authenticated, `safety.mutationsEnabled: false` ALWAYS in inspected probes; `getcourse_capabilities.writeState: LOCKED_UNTIL_AUTHENTICATED_TEST_CONTOUR`.
- Browser router chose `LOCAL_BROWSER` specifically for existing authorized GetCourse session. Chrome Browser Bridge may show `CONNECTED`, but transient read/click failures occurred; not a durable transaction channel.
- Separate anonymous no-local-session request used the **approved server browser** (Firefox) with request ID `015dc3df-fedc-4f6a-bee6-12c18226d353`. Browser activated successfully, but `https://study.shkola-dnv.com/` navigation failed `getaddrinfo ENOTFOUND study.shkola-dnv.com`. Evidence journal recorded HTTP 500 for navigate; browser released cleanly. **No anonymous user reached the checkout.** This is network/DNS failure, NOT access-denied-by-segment.
- No official GetCourse API credentials configured. Official API import/export is NOT a supported Offer CRUD service; neither hidden GetCourse endpoints, DB edits nor credentials copied into logs are permitted.
- Do not mutate `mutationsEnabled` through undocumented config or silently treat generic browser access as a verified scoped write authority.

## Official GetCourse constraints
Official guidance (checked Nov 2026):
- https://getcourse.ru/blog/276127 : Native offer access restrictions are applied to a **form** with "Показывать"; user must be authenticated for correct segment visibility. Browser limitations mean segmentation in embedded **widgets is not guaranteed**.
- Same article: validity period (if saved) blocks creating new orders once expired, and "Скрывать недоступные" hides them in forms.
- https://getcourse.ru/blog/275983 : customer checkout requires a configured order **form or widget** carrying the offer, not merely the Offer admin update URL.
Hence noneligible negative proof needs a dedicated **non-public native GetCourse form**, exact offer ID and independent unauthorized session, with no payment or real order.

## P0 implementation acceptance — GetCourse scoped write path
1. Authorized, intentional **test-only** transaction lane: owner=BF2026, target host fixed, offer allowlist `[8919715]`, user QA allowlist ID `524210421`, strict operation allowlist `offer-access-rule.save`, `offer-validity.save`, `private-staging-form.create` and readback, with independent noneligible read-only negative test.
2. Reject all writes when auth is unstable or `mutationsEnabled=false`. Do not bypass global provider policy with generic browser/undocumented API. Need a formally implemented and enabled write permission for this exact scope, with explicit consent and auditable results.
3. Require fresh GET/GetCourse UI reload after save and verify exactly one eligible QA user `bf2026-r22-qa-20261113@example.com` (prefer stable user ID instead of substring).
4. Verify against a genuine noneligible account, using the **same private native form**, that an attempt to order the offer is rejected before order creation. Test as authenticated other user and (if exposed publicly) anonymous. Inspect absence of new order and check no admin notification.
5. No production widgets or links, no payment providers, no real payment, no mailing, no preexisting customer entitlement changes. Existing `8919715` remains `Неактуален` until all gates PASS.
6. Before any commercial Offers beyond 8919715, establish this reusable gated transaction and E2E; then verify 365 days after confirmed paid event for exact purchased trainings (including negative access tests).
7. Confirm browser/network reliability and independent QA; platform's warning about widget segment limitations must be addressed by server-side check on the actual planned checkout mechanism.

## State
- `NATIVE_NONACTUAL_READBACK: PASS`.
- `PRIVATE_SEGMENT_PERSISTENCE: FAIL/UNKNOWN`.
- `EXPIRY_FIELD_PERSISTENCE: FAIL`.
- `SCOPED_WRITE_AUTHORIZATION: NOT AVAILABLE`.
- `ANONYMOUS_BROWSER_DNS: FAIL (ENOTFOUND)`.
- `NONELIGIBLE_CHECKOUT_DENY: NOT_RUN`.
- `ANNUAL_ENTITLEMENT_E2E: NOT_RUN`.
- `PRODUCTION_SALES_GATE: HOLD`.

Only make release claims for actual observations. Do not create remaining commercial Offers while this gate is unresolved.
