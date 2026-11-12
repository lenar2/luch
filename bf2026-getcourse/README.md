# BF2026 · GetCourse / prelaunch staging (12.11.2026)

**Status: CHROME_ADMIN_GUI_CONFIRMED / GETCOURSE INVENTORY INCOMPLETE · PRODUCTION HOLD · NO LIVE SALES.**
This directory is an implementation-ready specification and text drafts **in GitHub, not created GetCourse objects**. It must never be cited as evidence of a paid purchase or a tested entitlement. Source website and native Tilda have not been modified.

## Direct observations

- LUCH GetCourse v0.5 detected host `study.shkola-dnv.com`; its **isolated automation session** reported `AUTH_REQUIRED` and official import/export API credential was not configured.
- **Personal Chrome UI independently confirmed authenticated administrator access via verified screenshot** (`https://study.shkola-dnv.com/teach/control`), showing the full training list and admin controls. The isolated-session AUTH_REQUIRED must **not** be generalized to personal Chrome.
- Chrome GUI native read_text returns `USER_CHROME_GUI_WEB_CONTENT_NOT_EXPOSED_BY_ACCESSIBILITY`. Screenshot and pointer interactions are functional; this is a **limited GUI audit path**, not a parsed inventory or API automation.
- Opened actual training `Black Friday 2025`: observed URL `https://study.shkola-dnv.com/teach/control/stream/view/id/935051196`, visible subtraining card `Школа ДНВ — 75 уроков`, and a `Союз нового времени` card (exact child ID/entitlements **not** yet verified). Observed historical training does not prove the same learning program must be reused in 2026.
- Tatiana Mac was offline. No production sales entity has been created, and the GetCourse write gate remains unapproved.
- R6 website and JS inspected on branch `bf2026-tati-hea-r6-review-20261110`: nine `data-product` keys and static tentative checkout prices, with copy-only cart.

## Proposed sales matrix — *expected*, not verified in GetCourse

| Site key | Price | Requested scope / logical units | Live training / offer IDs |
|---|---:|---|---|
| `source1` | 4 990 ₽ | Источник 2026, модуль I (`source_m1`) | UNKNOWN |
| `source2` | 8 990 ₽ | Источник 2026, модуль I + II (`source_m1, source_m2`) | UNKNOWN |
| `union` | 9 990 ₽ | Школа ДНВ + Союз нового времени (`dnv, union`) | UNKNOWN |
| `trainer` | 24 990 ₽ | профессиональный архив, разборы, продвижение (`trainer_core, trainer_cases, trainer_promotion`) | UNKNOWN |
| `knop1` | 3 990 ₽ | I ступень, основные уроки + дополнительные (`knop1_main, knop1_extras`) | UNKNOWN |
| `knop2` | 4 990 ₽ | II ступень: предобучение + 4 недели (`knop2_pre, knop2_week1..4`) | UNKNOWN |
| `money` | 5 990 ₽ | только расширенная версия: 10 основных уроков + дополнения (`money_extended`) | UNKNOWN |
| `bundle-spirit-relations` | 14 990 ₽ | I + II Источник + ДНВ + Союз | UNKNOWN |
| `bundle-knop-money` | 9 990 ₽ | Кнопочка I + II + расширенные Деньги | UNKNOWN |

All: prerecorded self-study, **12 months** from qualifying payment. Platform documentation configures end **after N days**, so the business must agree whether “12 months” means 365 days or exact calendar anniversary; do not silently substitute. No subscriptions, renewals, or installment-first temporary access.

## Native GetCourse design (to execute only after authenticated access)

1. Inventory existing trainings/subtrainings/lessons by **stable ID**, list actual `access` policy, and verify content by student preview. Treat copies/older archives as different entities even when names match.
2. Identify the minimum set of **atomic product grants** needed to express these scopes. For Module I, Module II, and bonus sections, make sure an atomic grant is possible without opening unrelated subtrainings. Do **not** change global access of existing courses with enrolled learners; use isolated copies or alternate grants if required.
3. Create nine BF2026-specific **offers** (one offer can contain multiple products), using unique campaign offer codes, explicit ruble price and product composition. Native GetCourse supports multiple products per offer; price allocation among included products must be explicit and audited. In bundles, each atomic product occurs once.
4. Set `open only on full payment`, `close after approved interval`; disable partial-pay grants and auto-renewals. Check any global or legacy group-based access override. Do not invent VAT, tax registration, check receipt classification or commission rules.
5. Configure the form through GetCourse native **Site → Widgets**; require e-mail. Stage **nine private widget definitions** or one verified multi-offer form. Do not embed in Tilda, publish forms, or activate any live checkout until approved.
6. Prepare **order-created** and **paid-success** pages for each SKU (or validated dynamic versions that resolve verified order context). Successful payment redirect is not proof of entitlement. Use per-offer redirect only after verified, otherwise prefer native GetCourse page and purchase details.
7. Prepare mail templates as drafts. Audit GetCourse’s existing default paid-purchase system notification to prevent duplicate letters. No sending or enabling delivery.
8. Test in truly isolated, authorized no-money mode: order → confirmed payment → Purchase → entitlement → student lesson; test negative rights, overlap, repeat, renewal boundary, cancelled/refunded. No production payments or test mail deliveries without permission.

## Core invariants

- Order ≠ payment ≠ purchase ≠ actual lesson access.
- Multiple order callbacks must not create repeated grants; source order and offer ID must be stable.
- One offer lists each physical product once, even if logical bundles overlap.
- Returning/refunding money does not by itself prove purchase rights are revoked: read back the order, purchase, and actual access.
- A customer may already own a program through a separate purchase or group: evaluate **effective** access, not just the current campaign order.
- A changed campaign price must be versioned as a **new offer** and remapped after QA; never rewrite historical paid orders or blindly modify the old offer.
- Frozen existing Tilda and HEA branch; only the HEA owner performs the later integration.

## Documents

- `manifest.json`: stable keys, draft prices, logical grants, empty GetCourse IDs and per-SKU QA status.
- `MESSAGES_AND_PAGES.md`: six unsent mail drafts and page templates.
- `QA_MATRIX.md`: per-SKU E2E requirements and evidence checklist; marked NOT RUN.
- `HEA_HANDOFF.md`: exact integration contract for Tilda after GetCourse approval.

## Official references, verified as platform instructions — not account-specific evidence

- Products/offers & time access: https://getcourse.ru/blog/1218294
- Training access and risks of editing existing courses: https://getcourse.ru/blog/276090
- Widgets/third-party embeds and mandatory e-mail: https://getcourse.ru/blog/275829
- Post-payment page behavior: https://getcourse.ru/blog/420694
- Tilda embed: https://getcourse.ru/blog/496936

### Release gate (all required)

- [x] Authenticated GetCourse personal Chrome admin observed (GUI screenshot only)
- [ ] Authorized **safe test contour** and verified non-public draft write capability
- [ ] All training/module IDs and lessons verified with screenshots or exported evidence
- [ ] Nine native offer IDs, product IDs, widget IDs, landing URLs recorded
- [ ] 12-month expiry semantics approved
- [ ] Nine unpaid-order and no-money payment-state tests proven, including learner-view proof
- [ ] All emails kept in draft, no live payment routes, all pages private
- [ ] Independent QA approves native entitlements, repeated events, cancellation and refund behavior
- [ ] Separate user authorization to enable real payment E2E and Tilda integration

Until then: **NO GO**.
