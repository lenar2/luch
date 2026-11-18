# GetCourse native multi-offer acceptance gate — BF2026 R109

**Status:** engineering test instructions, not verified public checkout. The currently authorized GetCourse worker must own the sole GC tab and the exact atomic mutex before touching native UI. Separate checkout-adapter authors MUST NOT touch the GC tab or lock.

## Official documented capabilities (not evidence of exact R107 parity)

- https://getcourse.ru/blog/275862 — form with several **checkbox** Offers; part **«Общая сумма»**; form handler **«Создать заявку/заказ» → «Не дублировать заказы с одинаковым содержанием»**.
- https://getcourse.ru/blog/275826 — native cart with several offers and one order.
- https://getcourse.ru/blog/276084 — promotions may apply to all line items when one-line restriction disabled; discounts may be computed **per item**.
- https://getcourse.ru/blog/432640 — described dynamic promo criteria include **current order amount** and past user spend, **not demonstrated item count**. R109 requires four tiers selected by **number of distinct positions** and one rounding at FINAL total.
- https://getcourse.ru/blog/275829 — official third-party-site widget. The presence of a widget does **not prove an external redirect carries exact selected GetCourse Offer IDs**, nor does it prove supported client-provided discounted total.

## Six representative native order test vectors

Every test is **one native order** with as many distinct lines as indicated, not one synthetic combined product. Verify actual order ID, exact paid total, receipt, grants, unpaid negative proof, consent and duplicate guard.

1. SINGLE: Lot5 = **6,990 ₽**; only Product 4557988 → Training 936022301 after paid; verify 365 days.
2. TWO: Lot5 6,990 + Союз 6,000 → subtotal **12,990**; 10% tier; final nearest 10 ₽ = **11,690**. If GetCourse yields **11,691**, provider rounding does not match R109.
3. TWO AUDIO: «Отвержение» + «Обесценивание» = 3,333+3,333 (per deployed R109, subject to owner price reconciliation) → **6,000 ₽** after 10%.
4. THREE: two audios + «Союз» = 3,333+3,333+6,000 → subtotal **12,666**; 15%; final **10,770 ₽**.
5. FOUR: «Тренер» + ДНВ + «Союз» + «Источник» I = 28,000+7,200+6,000+6,000 → subtotal **47,200**; 25%; final **35,400 ₽**. **Trainer currently linked to old-training risk 935051957, do not publicly sell.**
6. FIVE: Lot5 + «Тренер» + ДНВ + «Союз» + «Источник» I = 6,990+28,000+7,200+6,000+6,000 → subtotal **54,190**; 35%; final **35,220 ₽**. Requires all five correct after-pay Training grants, Source and Trainer exact rights checked.

Source I+II variant: 10,000+6,000 (Союз) → subtotal **16,000**; 10%; **14,400 ₽**. Source I+II Offer and exact intro/I/II rights remain unknown, so QA only as pricing fixture.

## Pass/hold evidence contract for EACH native provider-order sample

Read back exact GetCourse order items: stable Offer IDs, Product IDs, Training grants, paid status/event ID, paid amount and one final-order discount. Require provider native paid-event → **365 days after confirmed payment** for every exact training. Before payment no access. Verify outsider sale eligibility, form public HTTPS URL, receipt/tax information consistent with IP settings, consent, and native duplicate-order prevention. Preserve evidence references for order/receipt/rights, without PII in GitHub.

**No native store guarantee of arbitrary R109 selection transfer from a redirect has been proved.** Verify it by live native order readback, not a guessed URL parameter. A single generic form URL is allowed as a backend *binding* for multiple selections only after each actual selection is conveyed correctly to the provider and can be independently reconciled. Native amount-only promotions alone are not proven to implement the count-based 10/15/25/35% rules with R109's once-per-order nearest-10 ₽ rounding.

## Exhaustive executable QA file

From the same directory as adapter:

\`\`\`sh
BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
 node export-265-vectors.cjs > qa-265-vectors.json
\`\`\`

The output contains all **265 valid selections**, source variant, final price, exact item IDs **where evidenced** and missing mapping blockers; any real native order/readback must be compared to the corresponding vector with \`reconcile-native-order.cjs\`. The generated file always labels itself **SYNTHETIC_PRICING_ONLY_NO_NATIVE_PAYMENT_PASS**. Existing GetCourse client site and production \`offer-registry.json\` must remain untouched until native acceptance proves real forms and payments.

