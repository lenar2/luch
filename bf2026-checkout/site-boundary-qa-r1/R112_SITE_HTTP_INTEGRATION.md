# BF2026 R112 — рабочий HTTP-мост (изолированная копия живого сайта)

## Что уже работает

Созданы файлы: `native-order-site-qa-http.cjs`, `patch-r112-qa-order-server.py`, `native-order-site-qa-http.test.cjs`. Последний автоматически копирует точные действующие R112 `server.js`, каталог, прайс и реестр в изолированный временный каталог, создаёт одноразовый QA ключ и запускает реальный HTTP сервер только на loopback 127.0.0.1. В конце сравнивает SHA исходного production server.js и удаляет тестовую копию.

POST `/api/checkout/_qa/native-order/prepare` (закрытый QA-key в header) принимает строго `{"kind":"set","items":["rejection_program","union"],"checkout_idempotency_key":"<32 lowercase hex>"}` и возвращает 200, HMAC подписанный payload, 12990 subtotal, 1300 discount, 11690 total, без платежной ссылки.

POST `/api/checkout/_qa/native-order/verify` принимает только подписанный токен и возвращает обе точные позиции Offer/Product/Training и два 365d AFTER_PAY grants. POST `/api/checkout/_qa/native-order/start` проверяет подпись и отвечает HTTP503 `NATIVE_PROVIDER_CAPABILITY_HOLD`, без заказа или платежной ссылки. Анонимный клиент получает 404, чужой Origin 403, поддельные суммы/Offer/coupon или токен 422.

Интеграция не переопределяет публичный `/api/checkout/start` и не трогает продающую страницу. Этот мост является фактическим HTTP маршрутом подготовки заказа, а не доказательством, что GetCourse создал заказ.

## Как инженеру сайта подключить в своей изолированной R112 ветке

1. Получить три новых файла и ранее созданные модули `native-order-site-integration.cjs`/тесты/SQL из существующего PR #17.
2. Сделать *копию* текущего R112 server.js и соответствующих pricing/catalog/registry/QA secret только в защищенном рабочем каталоге. Не писать секреты в GitHub.
3. `python3 patch-r112-qa-order-server.py /isolated/path/server.js /absolute/path/native-order-site-qa-http.cjs` — скрипт запрещает замену исходного production файла.
4. В тестовом экземпляре выставить `BF2026_ORDER_QA_ENABLED=1`, `BF2026_QA_ORDER_HMAC_HEX` (постоянный приватный hex HMAC-secret длиной 64+), тестовый `PORT`. Не активировать это на публичном production без отдельной QA проверки.
5. Приёмочная команда:

```sh
cd /srv/factory-scratch/bf2026-dynamic-checkout-worker2-r1-20261119
NODE_ENV=test BF_R109_SERVER=/srv/factory-scratch/bf2026-checkout-r1-20261118/server.js \
BF_R109_PRICING=/srv/factory-scratch/bf2026-checkout-r1-20261118/pricing-r107.json \
node --test bf2026-checkout/site-boundary-qa-r1/native-order-site-qa-http.test.cjs
```

## Остаток

Нативный механизм GetCourse одного заказа на два Offer с оплатой **11690** остаётся неподключённым: test widget 1686745 пока складывает **12990**. Backend не выдаёт неправильную ссылку и не считает смоделированные записи реальным заказом. Нет production правок, оплаты, отправки формы, рассылки или выдачи доступов.

## Контрольная проверка

Полный регрессионный комплект 79/79 PASS. Действующий публичный POST /api/checkout/start проверен один раз: HTTP503, GETCOURSE_OFFER_NOT_READY, серверная цена 11690 ₽, платёжной ссылки нет. 265 quote повторно не проверяли.
