# BF2026 · GetCourse R3.1.3 — native offer privacy save VERIFIED
Date: 2026-11-15. Successor of R3.1.2. Source: GetCourse live UI via LUCH Chrome. **NOT a sales launch**.

## What was ACTUALLY changed in GetCourse
- Offer `8919715`: **BF2026 · Союз нового времени · 5 990 ₽ · PRELAUNCH**, Product P05 `4550895`, Training `933861292`.
- Existing offer status **Неактуален** unchanged.
- Offer `Ограничения` → access type `Видеть и оформить заказ могут только те, кто входит в сегмент`.
- In `Правило доступа` (arbitrary segment) a REAL `ID объектов` condition was created using native `Добавить условие` dropdown, then exact QA ID `524210421` entered into its input (dynamic DOM input ID was `r7978` for this page load).
- Native rule evaluation displayed **`Под правило попадает: 1 пользователь`**.
- Real form submit performed with LUCH Browser Bridge DOM click `#offerForm button[type=submit]`, followed by independent full reload via `browser_reload` and native readback. Post-reload readback CONFIRMED: `Неактуален`; `ID объектов` with textbox value `524210421`; count exactly 1; access mode segment-only.
- Checked `Скрывать недоступные в форме продаж` via real native input `#paramsobject-access_hide_not_accessible`, confirmed checkbox true before save; submitted `#offerForm button[type=submit]` and reloaded. Independent readback confirmed checkbox **true**, rule ID and count persisted, status still Nonactual.
- Independent later readback reconfirmed same 4 invariants.

## Diagnosis of previous false-save results (R3.1.1–R3.1.2)
- LUCH `browser_click_accessible` and pointer click can report `clicked:true` while an offviewport or non-dispatched browser action only focuses a target or closes a dropdown. Therefore “clicked” is NOT evidence of a real changed control.
- On a page with a large `Добавить условие` dropdown, earlier clicks at offviewport CSS y (including `Эл. адрес содержит`) never created a genuine rule. The resulting form was saved with no rule, so previous assertions that GetCourse could not save the segment were premature.
- Proven route: open dropdown by direct CSS `#logicRulePluginw4 button.btn.dropdown`, focus its search, type `ID объектов`, click visible exact link `ID объектов`, verify a new input exists, enter stable QA user ID, wait for a real one-user count, and submit the ACTUAL Offer form via `#offerForm button[type=submit]`. No hidden/private GetCourse API was used.
- The specialized GetCourse provider still reports `mutationsEnabled=false` (it cannot write through **that** provider). This is **not** a proof that the ordinary authorized native browser cannot save Offer fields; it did so and the changes survived a reload.
- Earlier past-expiry date input attempts are not needed for this privacy gate and remain NOT VERIFIED. No default settings changed outside this offer.

## What was checked for noneligible customer
- A **separate anonymous Opera isolated browser** opened `https://study.shkola-dnv.com/`, but the redirected login displayed `ERR_CONNECTION_REFUSED`, not a functional GetCourse checkout. This is a NETWORK failure, not an actual access denial.
- The previous anonymous server-side Firefox request also failed `getaddrinfo ENOTFOUND`; it had been released.
- In authenticated GetCourse UI, there were **366 existing widgets**; native widget Name filter `BF2026` returned **`Ничего не найдено`**.
- In GetCourse site admin there were **257 existing pages**; native page Name filter `BF2026` returned **`Ничего не найдено`**.
- Thus **no BF2026-NAMED native form or page was found**. Search by name does not prove there is no unnamed form referencing Offer 8919715; full reference inventory remains pending.
- No real external checkout link or private test order form was identified. Therefore do **NOT** mark outsider actual order rejection PASS.
- Official GetCourse notes: offer segment visibility is checked when the user is signed in and the offer is placed with **Показывать** in native form; privacy rule may not work reliably on third-party embedded widgets. Sources: https://getcourse.ru/blog/276127 and https://getcourse.ru/blog/275862 .

## Evidence boundaries and acceptance
✅ OFFER_ADMIN_SEGMENT_PERSISTENT: **PASS** (QA ID 524210421, count 1 after independent reload).
✅ FORM_HIDE_INELIGIBLE_PERSISTENT: **PASS**.
✅ OFFER_STILL_NONACTUAL: **PASS**.
✅ OFFER_PRICE: **5 990 RUB** (observed in `Состав`; not altered).
✅ PRODUCT_IDENTITY: linked P05 `4550895` → Union training `933861292` observed in native UI.
⚠️ OUTSIDER_NATIVE_CHECKOUT_REJECTION: **NOT_RUN**, because no BF2026 test form/checkout route found and independent browser failed to reach account.
⚠️ OFFER_APPEARS_IN_UNNAMED_FORM: **UNKNOWN**.
⚠️ FULL NONELIGIBLE CUSTOMER END-TO-END: **HOLD**.
⚠️ CUSTOMER_ENTITLEMENT_365_DAYS: **NOT_RUN**, do not create grants now.
⚠️ SALES: **HOLD**.

## Next concrete step
Build/identify a nonpublic GetCourse-only test checkout form referencing Offer `8919715`, ensure order-created system mail and all payment triggers cannot fire, create/identify separate **noneligible QA** principal, verify outsider can reach that SAME form through independent network/session and cannot see/select/submit Offer `8919715` or create an Order. Do not rely only on private page redirect, or on account count=1. Test an eligible user without real payment and record the exact ID + negative order lookup. Never put the sale widget on Tilda before owner approval. If a private test form cannot be kept inaccessible to the public, do not publish or expose it.
