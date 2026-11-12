# BF2026 GetCourse · dry-run нормализации 9 предложений

**12.11.2026, isolated non-mutating GetCourse Sale Planner v0.1.** Девять вызовов `getcourse_prepare_course_sale` вернули **READY** без пропущенных обязательных полей и конфликтов в **спецификации**. Это **не** доказательство созданных предложений, реальных платежей, прав или сроков. Провайдер ничего не изменял.

| Offer key | Цена | Плановые Pxx GetCourse продукты | Dry-run |
|---|---:|---|---|
| `source1` | 4 990 ₽ | P03,P01 | READY |
| `source2` | 8 990 ₽ | P03,P01,P02 | READY |
| `union` | 9 990 ₽ | P04,P05 | READY |
| `trainer` | 24 990 ₽ | P06 | READY |
| `knop1` | 3 990 ₽ | P07 | READY |
| `knop2` | 4 990 ₽ | P08 | READY |
| `money` | 5 990 ₽ | P09 | READY |
| `bundle-spirit-relations` | 14 990 ₽ | P03,P01,P02,P04,P05 | READY |
| `bundle-knop-money` | 9 990 ₽ | P07,P08,P09 | READY |

**Normalized draft:** RUB, no partial payments; `time_limited`, `start_mode=after_payment`, `days=365` per product; no duplicate product keys inside one offer. 365 дней только **вариант настройки**, не подтверждение точного коммерческого «12 месяцев»: требует отдельной проверки бизнес-условия и реального readback GetCourse.

**Required to apply:**
1. Verify actual Product IDs P01–P09 from `manifest.json` and configure native GetCourse entitlements (root Source risky).
2. Verify whether 365 days is an acceptable meaning of 12 months; update all product terms accordingly.
3. Create *new* nine GetCourse Offer IDs only in a genuinely nonpublic state; never take payment on prototype offers.
4. Verify readback of price, product composition, restrictions, checkout, grants and expiry. Only after that grant E2E permission.

If GetCourse cannot hide prelaunch offers without making them externally payable, **do not create them in production**; use isolated testing first. Historical 2025 offers remain unchanged.
