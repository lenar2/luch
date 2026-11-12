# BF2026 R2 · Native GetCourse Entitlement Audit · 2026-11-12

**Status: R2 IN PROGRESS / SALES HOLD.** Account `study.shkola-dnv.com`. This is direct read-only evidence from the *authenticated personal Chrome admin UI* using PID-bound macOS Accessibility and native URLs. These training rules were observed, **not edited**. The nine native product shells P01–P09 already exist; their grant bindings remain **unverified/uncommitted**. No offer, widget, paid order, mail, or student E2E was created. Tests must not count this audit as learner-access PASS.

## Confirmed rule types (actual access tab, stable training IDs)

| Training / subtraining | ID | GetCourse selected access type | Important facts |
|---|---:|---|---|
| Источник 2026 (container) | `934905119` | Выбранные группы и купившие тренинг | Includes I/II/III AND unrelated copies of Knopochka I/II, plus other content. Do not sell container as the only grant |
| Источник · Начни отсюда | `934905120` | Выбранные группы и купившие | Existing historical groups; can be direct atomic purchase candidate |
| Источник · I, Пробуждение сознания | `934905122` | Выбранные группы и купившие | 7 lessons; historical groups; distinct from same-named other course |
| Источник · II, Пробуждение тела | `934905123` | Выбранные группы и купившие | 8 lessons |
| Источник · III, Богатство | `934905124` | Выбранные группы и купившие | Not part of Source I/I+II |
| Source container · Кнопочка I copy | `934905131` | Выбранные группы и купившие | Must remain unavailable to Source-only BF2026 purchase |
| Source container · Кнопочка II copy | `934905134` | Выбранные группы и купившие | Must remain unavailable to Source-only BF2026 purchase |
| Школа ДНВ (container) | `583995140` | Выбранные группы и купившие | 88 selected historical groups observed |
| Школа ДНВ · Месяц 1 | `583995141` | Выбранные группы и купившие | Not automatically opened by root purchase |
| Школа ДНВ · Месяц 2–6 | `583995142`, `583995144`, `584004641`, `583995147`, `584006165` | Additional individual child access policies still require separate readback | Six months are distinct objects; do not infer from parent |
| Школа ДНВ · Дополнительные материалы | `584120008` | Выбранные группы и купившие | 18 lessons; root purchase alone may undergrant |
| Школа ДНВ · NEW Дополнительные ответы | `616126452` | Все, у кого есть доступ к родителю | Inherits actual parent access |
| СОЮЗ НОВОГО ВРЕМЕНИ | `933861292` | Выбранные группы и купившие | 12 lessons; 2 historical groups observed |
| BF2025 Тренер full (container) | `935051957` | Выбранные группы и купившие | 128 lessons, historical BF2025 group |
| BF2025 Тренер · Профессия | `935051958` | Выбранные группы и купившие | 24 lessons, historic BF2025 group |
| BF2025 Тренер · ДНВ | `935051960` | Выбранные группы и купившие | 76 lessons, historic BF2025 group |
| BF2025 Тренер · Союз | `935051975` | Выбранные группы и купившие | 12 lessons, historic BF2025 group |
| BF2025 Тренер · Продвижение | `935051976` | **Есть доступ к родительскому И принадлежит выбранным группам** | 16 lessons; selected group is BF2025 buyer group. New 2026 purchaser of root is NOT proven to pass this gate |
| Кнопочка I | `316213861` | Выбранные группы и купившие | Main lessons at parent |
| Кнопочка I · Дополнительные материалы | `557801265` | Выбранные группы и купившие | 2 lessons; separate purchase/grant needed or safe new copy |
| Кнопочка I · Деньги бонус | `615464882` | Все, у кого есть доступ к родителю | 1 lesson |
| Кнопочка II | `666920037` | Выбранные группы и купившие | Main recorded learning path |
| Кнопочка II · Предобучение | `673098344` | Все, у кого есть доступ к родителю | 4 lessons |
| Кнопочка II · Неделя 1 | `666920039` | Все, у кого есть доступ к родителю | 7 lessons |
| Кнопочка II · Неделя 2 | `666920045` | Все, у кого есть доступ к родителю | 4 lessons |
| Кнопочка II · Неделя 3 | `666920046` | Все, у кого есть доступ к родителю | 5 lessons |
| Кнопочка II · Неделя 4 | **UNKNOWN** | **NOT VERIFIED** | Not found among visible direct child links; must locate before calling the four-week archive complete |
| Деньги · Бизнес (10 core lessons) | `549791334` | **Все, у кого есть доступ хотя бы к одному подтренингу** | Parent access is contingent on child access, unlike a standard bought-root grant |
| Деньги · Трёхчасовые ответы + медитация | `557801261` | Все, у кого есть доступ к родителю | 2 lessons |
| Деньги · Как поддерживать состояние | `593213706` | **Только те, кто купил подтренинг** | 2 lessons; likely an atomic purchase/grant needed |
| Деньги · Дополнительные материалы | `705184102` | Все, у кого есть доступ к родителю | 1 lesson |

### Major unsafe cases

1. **Source:** a single root grant could expose at least the container and mislead QA about I/II; children have independent rules. Do not expose III or nested Knopochkas. Official GetCourse docs explicitly state that purchasing just a subtraining makes its parent appear, but parent lessons remain inaccessible: [official article](https://getcourse.ru/blog/276090). Thus an extra parent-root product is **not automatically required**; prove with a test learner.
2. **Trainer:** `935051976` requires *both* parent access and legacy BF2025 group. Adding new customers to an existing BF2025 group or changing that rule affects historical cohorts; **DO NOT DO THIS**. Recommended: a separate BF2026 copy of the needed archive with its own nonlegacy rules, if cloning preserves content and is safe. Verify lesson count and no personal feedback promised.
3. **DNV:** 6 months and extras need per-child rights, not just `583995140` root. Do not change old cohorts' access. Candidate strategy: parent and each needed child atomic products, OR a safe private clone with new entitlement rules after checking copying/storage.
4. **Knop I:** `557801265` has group+purchase, not inherited; root purchase alone doesn't prove both extra lessons are available.
5. **Money:** parent `549791334` is enabled when *at least one child* is available, while `593213706` requires direct purchase. A product granting this child might unlock full parent and inherited extras, but that is **an untested hypothesis**, not E2E evidence. Shortened `624662676` (8 core lessons) is not the requested archive.
6. **Knop II:** parent plus three named weeks and pretraining verified; fourth week not found in observed links. Do not claim 4/4 yet.
7. **Identity risk:** product selector returned **two distinct entries titled "1. Пробуждение сознания"**. Native AX labels do not disclose stable selected training IDs. Never select by order/label alone; do not create customer rights until selection's ID can be read back.

### Nine already-created Product shells

`P01=4550889`, `P02=4550891`, `P03=4550893`, `P04=4550894`, `P05=4550895`, `P06=4550897`, `P07=4550899`, `P08=4550901`, `P09=4550902`.

**Persisted fulfillment status:** none of their exact training binding IDs has been verified in GetCourse after Save. In product editor P01 the "Доступ к тренингу" radio was temporarily selected, but **training not selected; SAVE not pressed**. Subsequent page navigation discarded the pending choice. The initial default on creation was "Вхождение в группу" without a selected group. Existing products BF2025 are unchanged.

### Safe implementation path

- Preferred: use exact training ID selection, not ambiguous label, and read back saved Product→Training relationship before any offer.
- Separate new BF2026 atomic products for each existing course child that does not inherit parent access; avoid changing historical rule settings.
- For legacy group-restricted cases that cannot be opened by a direct subtraining purchase (e.g., Trainer promo), investigate GetCourse's *Copy training* function; new copies inherit old access rules and must be adjusted only on the copy, never on the original. Test copies on isolated identities. GetCourse warns that copies lose answers, comments and schedules, so verify actual recorded lesson content after copying [official documentation](https://getcourse.ru/blog/276112).
- Only after product→exact training mapping is proven, configure 12-month timing **per product in an offer**, with business decision about 365 days vs calendar anniversary.
- Create/verify a test user only when outgoing account notifications and payments are disabled safely. Test no-money Order→Purchase→Training→actual student lesson; negative rights and overlaps. Until then: **R2_HOLD**.
- No mailing, Tilda, published widget, new real payment, or historical user access change.

## Evidence semantics

- Native admin UI **READ**: VERIFIED.
- IDs linked by clicking card and observing browser URL: VERIFIED for Trainer 935051958, 935051960, 935051975, 935051976.
- Per-training rule selection observed by accessible radio state: VERIFIED for rows above, except DNV months 2–6 and Knop II week 4.
- Product grant saved/read back: **NOT_DONE**.
- Actual learner test: **NOT_RUN**.
- Negative access: **NOT_RUN**.
- 12 months: **NOT_CONFIGURED**.
- All historical content/permission edits: **NONE**.
