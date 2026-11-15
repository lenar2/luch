# BF2026 · GetCourse R3.1.1 — live privacy containment and implementation-ready drafts
Date: 2026-11-15. Owner: continuing BF2026 GetCourse engineer.
Sources: `lenar2/ai-factory-evidence#4073`, R3.1 FULL HANDOFF, HEA #4056.
**SALES HOLD / NOT PRODUCTION READY**. This file is a design/configuration draft and evidence note, **not proof of GetCourse configuration**.

## A. Live GetCourse read-back and actual containment through LUCH
Account: `https://study.shkola-dnv.com`; authorized Chrome session via LUCH device `dev_bKsfIVczevXLyGyl`. Offer `8919715` ("BF2026 · Союз нового времени · 5 990 ₽ · PRELAUNCH"), declared Product P05 `4550895`, Training `933861292`.
1. Fresh UI reload on `#offerAccess`: access type **"Видеть и оформить заказ могут только те, кто входит в сегмент"**. Arbitrary segment rule selector appears, but the actual rule body is EMPTY ("Добавить условие"), no email match or count=1 after reload. The earlier UI briefly displayed "Эл. адрес содержит" and count=1 before reload; this is **not persisted evidence**.
2. Offer initially displayed **"Актуален"**. Clicked the native status link, read the native warning dialogue, then selected native button **"Сделать неактуальным"**. Subsequent UI reads and independent reload both displayed **"Неактуален"**. This is an actual, persisted admin-side change.
3. Native dialog warning: making an offer nonactual hides it from general listings, **but it may remain in previously embedded forms/widgets, auto-renewal logic, and still give existing product grants**. Thus "Неактуален" is **partial containment, not a proven checkout deny**.
4. Attempted a second safety layer: entered 14.11.2026 in "Действует по" via normal GUI, clicked "Сохранить", reloaded, and the field was EMPTY again. **Not saved, do not count as a guard**.
5. LUCH GetCourse provider: currently `READ_ONLY_UI_READY`, `safety.mutationsEnabled=false`, `writeState=LOCKED_UNTIL_AUTHENTICATED_TEST_CONTOUR`; browser auth probes briefly conflicted then returned authenticated. Do not work around safety using direct requests, reverse-engineered APIs, DB or privileged session.
6. **Not performed:** non-eligible checkout denial, eligible test checkout, actual payments, new commercial offers, live thank-you pages, mail templates in GetCourse, real sends, Tilda changes, grants, new user changes. QA still HOLD.
7. Account UI warns storage quota exhausted. No new audio uploads until verified capacity.

### Mandatory privacy gate before any additional commercial Offer
- A GetCourse-supported durable restriction **AND** fresh reload, exact QA email check `bf2026-r22-qa-20261113@example.com`, eligible count exactly 1 (substring test alone is insufficient).
- Native non-eligible user and direct external checkout route must be **denied**; eligible QA user must be **allowed only to isolated order creation without real payment**.
- Confirm Offer/Price/Product/Grant/365 days/no automatic mail on fresh readback.
- Ensure all old form/widget/renewal references to 8919715 are absent or explicitly excluded. Never assume nonactual is enough.
- Do not make the offer actual until these gates and explicit sale authorization.

## B. Commercial matrix (canonical 15 Nov, not old 9-option manifest)

| Visual lot | Variant(s) | Price RUB | Entitlement plan | Current GetCourse status |
|---|---|---:|---|---|
| 1 | Аудиотерапия — рана отвержения · 40 мин | 3 333 | AUDIO_RJCT, 365d after paid | exact Native Product/Training/file NOT IDENTIFIED |
| 2 | Аудиотерапия — рана обесценивания · 40 мин | 3 333 | AUDIO_DEVALUE, 365d after paid | exact Native Product/Training/file NOT IDENTIFIED |
| 3 | Аудиотерапия — страх быть собой · 40 мин | 3 333 | AUDIO_SELF, 365d after paid | exact Native Product/Training/file NOT IDENTIFIED |
| 4 | Аудиотерапия — чувство вины · 40 мин | 3 333 | AUDIO_GUILT, 365d after paid | exact Native Product/Training/file NOT IDENTIFIED |
| 5 | Собери своё исцеление · любые 2 | 5 990 | exactly selected two of A1–A4, 365d | 6 exact combinations need safe config |
| 5 | Собери своё исцеление · любые 3 | 8 490 | exactly selected three of A1–A4, 365d | 4 exact combinations need safe config |
| 5 | Собери своё исцеление · все 4 | 10 990 | exactly four A1–A4, 365d | one exact combination |
| 6 | Школа ДНВ | 6 990 | P04 4550894 / training 583995140 + audit A11–A17,A33 | commercial offer not proven |
| 7 | Союз нового времени | 5 990 | P05 4550895 / training 933861292 | Offer 8919715 **NONACTUAL**, privacy unverified |
| 8 | Тренер по отношениям | 29 990 | P06 4550897 / training 935051957 + audit A18–A20,A22–A32 | commercial offer not proven |
| 9 | Источник I | 5 990 | P03 4550893 (934905120) + P01 4550889 (934905122) | commercial offer not proven |
| 9 | Источник I+II | 10 990 | P03 + P01 + P02 4550891 (934905123) | commercial offer not proven |
| 10 | Stories с Татьяной | 80 000 | manually fulfilled service; no course grant | terms/booking not verified |
| 11 | Zoom ×3 | 90 000 | manually scheduled personal service; no course grant | terms/dates not verified |

**Exactly 15 audio options** if no secure server-side dynamic selection: singles 4 + pairs 6 + triples 4 + all 4 = 15. The 11 visual cards are NOT 11 checkout Offer IDs. Record individual Native Offer IDs on creation, never infer them.

Combinations to keep exact (bitset order: rejection, devaluation, self, guilt):
- 2-of-4: 12, 13, 14, 23, 24, 34.
- 3-of-4: 123, 124, 134, 234.
- 4-of-4: 1234.
- 1-of-4: 1, 2, 3, 4.

### Grants contract
Paid-confirmed **by GetCourse** => grant each uniquely purchased Native Product entitlement, **365 days after payment**, not after cart/open/order creation. Unpaid, canceled, returned and failed payments grant nothing unless a distinct proven refund policy applies. Do not write grant based solely on order or webhook delivery. Duplicate events idempotent by payment/order and entitlement key. Verify start/end timestamps, hierarchy inheritance, exclusion of unrelated trainings, media opening and negative access in test account. No arbitrary group gifts.
Programs all described as **"в записи"**, **"самостоятельное прохождение"**, **"доступ 1 год"**. Not applicable to Stories or Zoom services.

## C. Upsell contracts (DRAFT — no links, no sends)
1. `Источник I -> I+II`: **5 000 ₽**. Eligibility: verified PAID P03+P01 and no paid/active P02. Fulfill **P02 only**; preserve existing I start date, avoid duplicate grants.
2. `AUDIO_SINGLE -> ALL_4`: **7 657 ₽**. Existing paid, unique 1 of 4; grant only remaining three; do not remove prior access.
3. `AUDIO_PAIR -> ALL_4`: **5 000 ₽**. Existing paid, exactly 2 of 4; grant only remaining two.
4. `AUDIO_TRIPLE -> ALL_4`: **2 500 ₽**. Existing paid, exactly 3 of 4; grant only missing one.
Unverified ownership or already owns target => upsell not shown and cannot checkout even by direct URL. Existing unrelated BF purchases require explicit reconciliation before discounts. No automatic upsell mailing.

## D. Draft thank-you page content (NOT created in GetCourse)
**Global design instruction:** premium pearl/white/champagne gold, radiant golden wings and upper light rays; final HEA art approval pending. Dynamic links, support contacts, actual purchased SKUs must be resolved and verified. NEVER use invented URLs.

### PAGE_D1 — digital audio / audio bundle
Heading: "Спасибо за доверие"
Subheading: "Твоё пространство исцеления открывается."
Body: "Ты приобрела: {{EXACT_PAID_AUDIO_NAMES}}. Слушай аудиотерапии в удобное для себя время. Доступ к материалам — 1 год с момента подтверждения оплаты."
CTA: "Открыть мои аудиотерапии" -> `{{VERIFIED_CUSTOMER_CABINET_LINK}}`.
Footer: "Если потребуется помощь со входом, свяжись с нами: {{SUPPORT_CONTACT}}."
Only after a verified paid purchase. For an unpaid pending order show payment-pending instead, never imply delivered rights.

### PAGE_P1 — recorded program
Heading: "Спасибо за доверие"
Subheading: "Твоя программа «{{PAID_PROGRAM_NAME}}» готова."
Body: "Впереди — самостоятельное прохождение авторской программы в записи. Доступ к приобретённым материалам — 1 год с момента подтверждения оплаты."
CTA: "Открыть программу" -> verified entitlement-specific link.
Footer: login help `{{SUPPORT_CONTACT}}`.
For Source I/I+II enumerate the exact purchased modules. Do not mention curators, certificates or personal coaching unless explicitly confirmed.

### PAGE_M1 — managed service
Heading: "Спасибо за доверие"
Body: "Оплата услуги «{{PAID_SERVICE_NAME}}» подтверждена. Дальше мы согласуем детали и формат индивидуально. Пожалуйста, заполните короткую анкету: {{VERIFIED_BRIEF_LINK}}. Администратор свяжется с вами через {{SUPPORT_CONTACT}}."
No 365-day training access and no date/format promise not in contract.
CTA: "Перейти к анкете" only after actual approved brief URL.

## E. Draft emails (NOT created/sent in GetCourse)
All send conditions: confirmed payment + allowed transactional purpose + correct recipient/account + checked system duplicates. Do not send to general audience. Templates are content only.

**EMAIL_DIGITAL_PROGRAM** — subject "Спасибо за доверие — твои материалы доступны"
"Спасибо за доверие! Твоя {{PRODUCT_KIND}} «{{EXACT_PAID_PRODUCT_NAME}}» теперь доступна в личном кабинете: {{VERIFIED_CUSTOMER_CABINET_LINK}}. Доступ к приобретённым материалам действует 1 год с даты подтверждения оплаты. Если у тебя уже есть аккаунт, войди с прежним адресом. Если входишь впервые, воспользуйся штатной инструкцией GetCourse: {{VERIFIED_LOGIN_INSTRUCTIONS}}. Для помощи: {{SUPPORT_CONTACT}}."
Before enabling, check GetCourse default emails to prevent duplicate instructions.

**EMAIL_SERVICE** — subject "Спасибо — оплата {{PAID_SERVICE_NAME}} подтверждена"
"Благодарим за доверие! Мы получили подтверждение оплаты услуги «{{PAID_SERVICE_NAME}}». Для согласования деталей заполни, пожалуйста, анкету: {{VERIFIED_BRIEF_LINK}}. По всем вопросам: {{SUPPORT_CONTACT}}."
No course access.

**EMAIL_HELP** — subject "Помощь с доступом к материалам"
"Если возникли сложности со входом или материалами, напиши нам: {{SUPPORT_CONTACT}}. Укажи адрес почты, использованный при оформлении заказа. Мы проверим статус заказа и доступа."
Never request password, card details or personal identification in email.

**OPTIONAL_24H_REMINDER** — OFF unless explicit authorization, no first access, compliant consent and suppression check.
"Твои материалы уже в личном кабинете: {{VERIFIED_CUSTOMER_CABINET_LINK}}. Можно начать в удобное время."
No manipulative countdown and no mailing without permission.

## F. Current release gates and blockers
- **P0**: durable access/privacy control for Offer 8919715; non-eligible negative direct-link test. Nonactual alone insufficient; end date GUI edit failed persistence. Until then keep nonactual.
- **P0**: provider `safety.mutationsEnabled=false`; do not bypass via hidden API/DB. Preserve current auth/read-only state and obtain authorized GetCourse write route for staged drafts.
- **P0**: exact native identity and 40-minute audio file verification for all four new therapies; never equate old guilt meditation with new audio.
- **P1**: atomic rights audits for School DNV and Trainer; no accidental access to other programs.
- **P1**: draft Native Offers with exact ID, per-product 365-day grant and no emails. Only one at a time, fresh reload and positive/negative tests.
- **P1**: create unpublished thank-you pages and email templates in GetCourse only when authorized write gate opens; save draft IDs/URLs and verify they're not public/sent.
- **P1**: complete isolated E2E with no real payment, then independent QA/HEA and explicit launch permission.
- **Open commercial**: correct Trainer naming, actual historical struck-through prices, customer support contact, legal/tax settings, service deliverables/brief URLs, final artwork approval.
- **Forbidden without separate approval**: real payments, sale opening, emails, Tilda, modifying historical purchases, bulk grant/access, live deploy.

**Result R3.1.1:** Native Offer 8919715 moved to and confirmed in **NONACTUAL**. This is a partial safeguard only. **Sales HOLD / privacy NOT VERIFIED / no checkout link.**
