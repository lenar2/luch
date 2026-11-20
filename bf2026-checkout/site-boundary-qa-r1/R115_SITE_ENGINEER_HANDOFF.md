# BF2026 R115 — Site engineer handoff: 12 карточек, webhook и оплатный readback

**Состояние:** backend-only, изолированная ветка PR #17, без production write, GetCourse UI, заказа или реальной оплаты.

## Проверенная матрица карточек (из точных server catalog/registry)

Текущая матрица получена прямым чтением `/srv/factory-scratch/bf2026-checkout-r2-20261119/catalog-r110.json` и `offer-registry.json`; это снимок, а не источник для автоматического открытия продаж. Незаполненный Training ID означает **не подтверждено**, а не 365-дневный доступ.

| № | Клиентское название | Native Widget / Offer | Product(ы) / Training(и) | Цена | Состояние |
|---:|---|---|---|---:|---|
| 1 | Исцеление раны отвержения | 1686768 / 8934973 | 4555636 / не подтверждены | 3333 ₽ | форма в реестре, оплата HOLD |
| 2 | Исцеление раны обесценивания | 1686753 / 8934925 | 4555642 / не подтверждены | 3333 ₽ | форма в реестре, оплата HOLD |
| 3 | Исцеление страха быть собой | 1686770 / 8934974 | 4557112 / не подтверждены | 3333 ₽ | форма в реестре, оплата HOLD |
| 4 | Исцеление чувства вины | 1686767 / 8934979 | 4557582 / не подтверждены | 3333 ₽ | форма в реестре, оплата HOLD |
| 5 | Исцеление отвержения | 1686693 / 8933492 | 4557988 / 936022301 | 6990 ₽ | форма в реестре, оплата HOLD |
| 6 | Школа для девушек на выданье (ДНВ) | 1686740 / 8934207 | 4550894 / не подтверждены | 7200 ₽ | форма в реестре, оплата HOLD |
| 7 | Союз нового времени | 1686738 / 8919715 | 4550895 / 933861292 | 6000 ₽ | форма в реестре, оплата HOLD |
| 8 | Тренер по отношениям | — / 8934247 | — / не подтверждены | — ₽ | NATIVE_FORM_NOT_READY |
| 9 | ИСТОЧНИК (вариант 1) | 1686741 / 8934262 | 4550889 / не подтверждены | 6000 ₽ | форма в реестре, оплата HOLD |
| 9 | ИСТОЧНИК (вариант 2) | 1686774 / 8934987 | 4550889, 4550891 / 934905122, 934905123 | 10000 ₽ | форма в реестре, оплата HOLD |
| 10 | Собери свой сет | — / — | — / не подтверждены | — ₽ | динамическая корзина |
| 11 | ИНТЕГРАЦИЯ В сторис блога «Нельзяграм» @tati_lar  122K | — / — | — / не подтверждены | — ₽ | заявка без оплаты |
| 12 | Личная работа | 1686776 / 8934993 | 4559058 / не подтверждены | 80000 ₽ | форма в реестре, оплата HOLD |

**Особые ограничения:** Lot8 «Тренер по отношениям»: старый Offer 8934247 с BF2025 Training нельзя использовать без новой проверки. Lot9 вариант I+II: один Offer 8934987, **два** Product 4550889/4550891 и Training 934905122/934905123; дублирующий неактуальный Offer 8934988 нельзя подключать. Lot10 — серверный динамический комплект, **не** 265 физически отдельных предложений. Lot11 — заявка без списания денег. Lot12 — услуга с тремя Zoom-сессиями, без Training/grant; требуется реальное бронирование после оплаты.

## Готовые файлы

- `native-slot-matrix.cjs` + `native-slot-matrix.snapshot.json` + `.test.cjs`: матрица 12 карточек, сверка catalog/registry/Offer/Product/Training, строгий отказ при противоречиях и неизвестных IDs.
- `provider-relay-webhook.cjs` + `.test.cjs`: HMAC-SHA256 подпись от отдельного доверенного relay, окно 5 минут, исключение PII/цены из уведомления, защита повторов, **только PENDING_PROVIDER_READBACK**.
- `r115-relay-http.cjs` + `patch-r115-event-http.py` + `r115-relay-http.test.cjs`: реальный HTTP GET/POST-контур на изолированной копии текущего R112; 202 для подписанной подсказки, 401 для подделки, 422 для PII/конфликта; ни один callback не ставит payment_verified=true.
- `r115-event-inbox.sql` и `r115-postgres-inbox-store.cjs`: PostgreSQL таблица с PK `(source,event_id)`, unique/replay и ограниченными состояниями; готовое внедрение через site-owned Pool-модуль. **Не применено** ни к какой БД.
- `paid-proof-reconciler.cjs` + `.test.cjs`: получает оригинальный order record из DB **по provider_order_id**; проверяет selection SHA и подписанный payload SHA, живое независимое GetCourse evidence, отдельную Ed25519 QA-подпись, 11 690 ₽, ровно две native 365d AFTER_PAY выдачи, чек/налоги/оферту и пишет уникальное paid событие. Никаких внешних grant calls.
- `native-order-site-integration.cjs`: добавлен `getByProviderOrder()` для платежной сверки без короткоживущего checkout token.

## Архитектура шлюза

По официальной документации GetCourse callback выполняется процессом «Вызвать URL» (https://getcourse.ru/blog/276215). Там нет подтверждённого требования криптографической подписи GetCourse; **не считать URL-вызов доказательством оплаты**. Сначала отдельный доверенный relay преобразует уведомление в урезанную структуру `{schema,event_id,provider_order_id,status_hint,occurred_at}` и ставит HMAC. HTTPS-входящая нода лишь фиксирует событие в inbox. **Только** серверный background reconciler запрашивает native order/payment/grants через независимо реализованный реальный GetCourse readback driver и принимает отдельно подписанные доказательства.

Последовательность: **GetCourse process callback → trusted relay/HMAC → POST /api/checkout/_relay/payment-hint → PostgreSQL PENDING_PROVIDER_READBACK → server-owned native paid readback + independent QA attestation → unique paid event ledger.** Ни уведомление, ни страница `after-payment`, ни клиентские поля не могут выдавать доступы.

## Интеграция в изолированную R112 ветку

1. Обновить копию R112 `server.js`, `catalog-r110.json`, `offer-registry.json` и QA-секрет в отдельной рабочей директории. Уже существующие закрытые `/_qa/native-order/{prepare,verify,start}` **не внедрять повторно**.
2. Для callback только после отдельного разрешения применить `r115-event-inbox.sql` к **изолированной PostgreSQL БД**. В рабочем LUCH scratch `psql`, `initdb` и Node `pg` не доступны, поэтому реальное выполнение SQL **не проверено**. Unit и HTTP-тесты используют fake Pool.
3. Выполнить `python3 patch-r115-event-http.py /isolated/server.js /abs/r115-relay-http.cjs /abs/r115-postgres-inbox-store.cjs`. Patch откажется менять production server.
4. Запускать отдельный stage-процесс только с `BF2026_R115_RELAY_ENABLED=1`, 32+ байт случайного приватного `BF2026_R115_RELAY_KEY_HEX` и `BF2026_R115_DB_POOL_MODULE=/abs/stage-pool-module.cjs`. **Не передавать ключ в GitHub/лог/HTML; не использовать GetCourse callback как прямой HMAC-подписанный запрос**.
5. Программная проверка новой матрицы при поступлении каждого подтверждённого виджета:

```sh
node bf2026-checkout/site-boundary-qa-r1/native-slot-matrix.cjs \
 /srv/factory-scratch/bf2026-checkout-r2-20261119/catalog-r110.json \
 /srv/factory-scratch/bf2026-checkout-r2-20261119/offer-registry.json \
 /tmp/bf2026-r115-native-slot-matrix.json
```

6. Без открытия продажи: `node --test bf2026-checkout/site-boundary-qa-r1/native-slot-matrix.test.cjs bf2026-checkout/site-boundary-qa-r1/provider-relay-webhook.test.cjs bf2026-checkout/site-boundary-qa-r1/r115-relay-http.test.cjs bf2026-checkout/site-boundary-qa-r1/paid-proof-reconciler.test.cjs bf2026-checkout/site-boundary-qa-r1/r115-postgres-inbox-store.test.cjs`.

## Точный следующий исполняемый шаг автоматического CONTINUE

В изолированной ветке site engineer взять этот commit PR #17, **применить `r115-event-inbox.sql` только в отдельном PostgreSQL staging**, установить pinning ключей relay и independent QA и выполнить HTTP E2E с одним подписанным событием `PAID` и его дубликатом. Подтвердить `202 ACCEPTED_PENDING_READBACK` / `202 DUPLICATE_PENDING_READBACK`, что реестровая сумма 11 690 ₽, что `paid_event` и grants не создались только от уведомления. Затем, когда будет доступен реальный GetCourse native order readback driver, подключить его к `paid-proof-reconciler.cjs`, проверить реальные 2 items / чек / 365d grants / consent; только после этого рассматривать release.

## Проверенные границы

**Не готово к production:** реальный provider two-offer checkout с 11 690 ₽, настоящие provider/reviewer trust keys, deployment PostgreSQL миграции, live paid/access/receipt QA и релиз. Ранее статус `sales_ready=false`, `verified_sale_routes=0`. Синтетические Ed25519 fixture-тесты не являются доказательством живого GetCourse заказа. Не выполнять новые 265-аудиты, не трогать GC редактор и не запускать платёж.
