# BF2026 R118 — нативный комплект GetCourse подключён к действующему серверу (QA only)

**Результат:** работающий закрытый HTTP-маршрут на `https://wf.tati-lar.ru/api/checkout/_qa/native-bundle/`, без изменения публичного сайта и без запуска платежей. Подтверждено **8 реальными HTTP-проверками на действующем сервере** после перезапуска только Docker `bf2026-checkout-r2`. Изолированные regression-тесты 72/72 PASS, без повторения аудита 265 цен.

## Факты из нативного GetCourse

- QA-предложение **8935004**: «Исцеление отвержения + Союз нового времени», **11 690 ₽**, один Offer содержит два уже существующих Product: **4557988→Training936022301**, **4550895→Training933861292**. Оба Product настроены на **365 дней после оплаты**. Offer **НЕАКТУАЛЕН** для покупателей.
- Нативная форма **Widget 1686790**, стабильный action ID **2263285969**, HTTPS public form: один `formParams[offer_id][]` radio выбран для **8935004**, `data-price-value=11690`, маркетинг unchecked. Никакие visitor/session параметры не сохранялись и не используются.
- GetCourse UI-worker уже создал **реальный тестовый неоплаченный заказ № 71994 / deal 924624456** по этому bundle Offer, ровно на **11 690 ₽**. В нём одна Offer-строка, два Product entitlement. Независимый userProducts readback показал **нулевую новую выдачу доступов до оплаты**. Доказательства: [#4112 comment 6997884393](https://github.com/lenar2/ai-factory-evidence/issues/4112#issuecomment-6997884393) и [#4112 comment 6997903834](https://github.com/lenar2/ai-factory-evidence/issues/4112#issuecomment-6997903834). Эти факты переданы UI worker, а не проверены аутентифицированным backend через native GetCourse API.
- **ПРИНЦИПИАЛЬНО:** это **ОДНО предложение с ДВУМЯ продуктами**, не два отдельных Offer в одном заказе, и не готовый механизм оплаты всех 265 комбинаций. Нет настоящего paid E2E, фискального чека или двух доступов после оплаты.

## Что реально развёрнуто

Код: `native-bundle-qa.cjs` (server signed HMAC intent / exact Offer+Product+Training mapping / unpaid+paid shapes, всегда HOLD), `native-bundle-site-qa-http.cjs` (закрытые HTTP маршруты), `native-bundle-qa.test.cjs`, `native-bundle-site-qa-http.test.cjs`, `patch-r112-native-bundle-qa.py` (только в тестовой копии), `deploy-r112-native-bundle-qa-live.py` (lock, отдельный Docker restart, rollback), `native-bundle-real-order-evidence.json`, `r112-live-native-bundle-qa-deploy-evidence.json`.

- `POST /api/checkout/_qa/native-bundle/prepare` под существующим QA-key: только `{kind:'set',items:['rejection_program','union'],checkout_idempotency_key:'<32 lowercase hex>'}`. Ответ содержит HMAC `signed_bundle_intent`, Offer **8935004**, два Product/Training, цену 11690, `customer_sale_ready:false`.
- `POST /api/checkout/_qa/native-bundle/verify` проверяет HMAC/срок/актуальный server R109 quote и выдаёт две ожидаемые нативные 365d AFTER_PAY привязки без создания заказа.
- `GET /api/checkout/_qa/native-bundle/preview` — **закрытая QA-страница** с настоящим GetCourse Widget1686790, помечена `noindex` и не используется как customer checkout.
- `POST /api/checkout/_qa/native-bundle/start` — HTTP **503 NATIVE_BUNDLE_QA_INACTIVE**, никакого заказа, payment URL, grant или buyer-Pll.
- Неавторизованный клиент получает HTTP404; подмена цены/Offer, отсутствие stable idempotency key или HMAC — HTTP422; чужой Origin — 403.

Проверенный публичный `POST /api/checkout/start` по-прежнему HTTP**503 GETCOURSE_OFFER_NOT_READY**, approved quote **11690**. Production `verified_sale_routes=0`, `sales_ready=false`. Registry/catalog, landing-page design, 265-серверных расчётов и Caddy не меняли.

Развёрнут в каталоге `/srv/factory-scratch/bf2026-checkout-r2-20261119/` под `site-register.lock`. SHA / backup / 8 HTTP checks — в `r112-live-native-bundle-qa-deploy-evidence.json`. Docker `bf2026-checkout-r2` после рестарта здоров. Rollback backup: `server.js.before-r112-bundle-qa.20261119-024734.backup`.

## Следующий реально необходимый шаг к продаже

1. Эксклюзивный GC UI-worker: оставить существующий заказ №71994 неоплаченным. В единственной нативной QA-сессии выполнить отдельно контролируемую проверку обязательного согласия, затем **разрешённый тест оплаты 11 690 ₽** и проверить **один captured payment event + чек/налоги + два новых Product/Training доступа точно на 365 дней**, без дублирования ранее созданного заказа.
2. Только после реального paid E2E и отзывчивой публичной формы сделать Offer8935004 актуальным и привязать один конкретно проверенный `set:rejection_program|union` к публичной оплате. **Не включать 265 комбинаций автоматически**: для остальных нужен отдельный нативный provider order механизм с подтверждёнными суммами/выдачей.
3. Site engineer: использовать уже работающую приватную подготовку/verify; для публичного релиза изменить `strictBinding` в `server.js` только после реальных подтверждений согласия, оплаты, receipt, double-grants и owner release. Не использовать имитацию paid fixture или plain boolean `paid=true` как доказательство.

## Тестовый запуск без production-write

```sh
cd /srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119
NODE_ENV=test BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
node --test bf2026-checkout/site-boundary-qa-r1/native-bundle-qa.test.cjs bf2026-checkout/site-boundary-qa-r1/native-bundle-site-qa-http.test.cjs
```

Этот код использует только документированный существующий native GetCourse Widget. **Не придуман и не вызван ни один неизвестный GetCourse API; он не отправлял формы и не создавал дублирующий заказ.**
