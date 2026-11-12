# BF2026 · 9/9 Sale Planner dry-run R2.1.2

**12.11.2026.** Проверка выполнена после реальных 33 Product→Training связей, без изменения GetCourse. Вызов `getcourse_prepare_course_sale` для каждой из 9 комплектаций вернул `status=READY`, `missing=[]`, `conflicts=[]`.

**Это проверка внутренней согласованности JSON-плана, НЕ прав ученицы и НЕ созданных платёжных предложений.** Ранее выполненная проверка 9 базовых продуктов устарела; ниже проверен весь текущий атомарный комплект.

| Ключ сайта | Цена плана | Продуктов | Native Product keys | Результат |
|---|---:|---:|---|---|
| `source1` | 4990 ₽ | 2 | P03, P01 | READY (только dry-run) |
| `source2` | 8990 ₽ | 3 | P03, P01, P02 | READY (только dry-run) |
| `union` | 9990 ₽ | 10 | P04, A11, A12, A13, A14, A15, A16, A17, A33, P05 | READY (только dry-run) |
| `trainer` | 24990 ₽ | 15 | P06, A18, A19, A20, A22, A23, A24, A25, A26, A27, A28, A29, A30, A31, A32 | READY (только dry-run) |
| `knop1` | 3990 ₽ | 2 | P07, A10 | READY (только dry-run) |
| `knop2` | 4990 ₽ | 1 | P08 | READY (только dry-run) |
| `money` | 5990 ₽ | 2 | P09, A21 | READY (только dry-run) |
| `bundle-spirit-relations` | 14990 ₽ | 13 | P03, P01, P02, P04, A11, A12, A13, A14, A15, A16, A17, A33, P05 | READY (только dry-run) |
| `bundle-knop-money` | 9990 ₽ | 5 | P07, A10, P08, P09, A21 | READY (только dry-run) |

Исходные Native Product IDs находятся в `manifest.json products[].id`, связки предложений в `offers[].gcProductIds`. У каждой плановой выдачи `time_limited, start_mode=after_payment`, `days=365`, без частичных оплат. **Срок 365 дней лишь предложенная спецификация**, а не настроенные 12 месяцев в GetCourse: необходимо подтвердить подходящее коммерческое правило.

- Native Offer IDs: **0**. Checkout/widget IDs: **0**. Реальные платежи/заказы: **0 новых**.
- Student E2E: **NOT_RUN**. Доступ к урокам и отсутствие лишних программ — **NOT_RUN**.
- Этап R2.1.2: **PASS только для 33/33 сохранённых связей и 9/9 dry-run спецификаций**.
- Рубеж для продажи: **R2.2 (изолированный learner-access QA)**, затем R3; статус запуска **HOLD**.
