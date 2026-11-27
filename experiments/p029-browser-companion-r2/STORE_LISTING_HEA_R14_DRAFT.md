# LUCH Browser Companion · store description / черновик R14

**STATUS: DRAFT — NOT SUBMITTED TO CHROME WEB STORE / OPERA STORE.** Do not promise availability via a store button or installation in a user's active profile.

## Русский

### Название
LUCH Browser Companion — ваш ИИ работает в браузере

### Короткое описание
Помогите своему ИИ не только отвечать, но и работать с открытыми страницами — с вашего разрешения.

### Описание для человека
Вы привыкли просить ИИ объяснить, написать или найти информацию. С LUCH он сможет помогать и в браузере: читать страницы, переходить по ним, заполнять обычные поля и выполнять поручения в пределах разрешённого доступа.

**Как это работает**

1. Подключите LUCH в совместимом чате с ИИ.
2. Получите одноразовый восьмизначный код и введите его в расширение.
3. Один раз разрешите доступ в стандартном окне Chrome.
4. Вернитесь в привычный чат и дайте первое поручение: «Прочитай открытую страницу и расскажи самое важное».

После перезапуска браузера сохранённое разрешение может восстановиться автоматически. Вы всегда можете приостановить доступ или полностью отключить браузер.

**Что важно знать**

- В полном режиме LUCH получает доступ к обычным открытым HTTP(S)-страницам, не только к текущей вкладке.
- Расширение не запрашивает разрешения на историю браузера и cookies. По вашему поручению содержимое страниц может передаваться вашему подключённому ИИ.
- Системные страницы Chrome и некоторые защищённые страницы браузер не разрешает изменять.
- Нужен поддерживаемый AI-хост с пользовательским MCP и совместимыми условиями доступа; расширение не заменяет подключение самого AI-хоста.
- Не используйте ввод паролей/одноразовых кодов через расширение: соответствующие поля защищены; проверки безопасности проходят до выпуска.
- Пока продолжаются независимая приёмка и тестирование системных разрешений Chrome, публикация и установка на рабочий браузер **не объявлены готовыми**.

### Четыре скриншота для будущего магазина
1. «Ваш ИИ может больше в браузере» — первый экран и короткий путь к коду.
2. «Один шаг — и можно поручать дела» — объяснение доступа до нативного разрешения.
3. «Всё готово. Просто поручайте» — пример первого поручения.
4. «Связь прервалась. Настройки сохранены» — спокойное восстановление соединения.

Исходные визуальные кандидаты: `audits/screens/R14_pairing_RU.png`, `R14_permission_RU.png`, `R14_ready_RU.png`, `R14_offline_RU.png` (в папке `audits/screens/`).

## English

### Title
LUCH Browser Companion — let your AI help in the browser

### Short description
Let your supported AI work with webpages, with browser permissions you control.

### Description
Your AI can do more than answer questions. With LUCH Browser Companion, a compatible connected AI can understand ordinary webpages, navigate, fill supported fields, and help you finish tasks within the access you grant.

**Getting started:** Connect LUCH in your supported AI chat, get a one-time eight-digit browser pairing code, enter it in the extension, approve Chrome's native browser-access request once, and try: “Read the open webpage and tell me what matters most.”

Your pairing is retained through routine reconnects. Browser-wide authorization can recover after a restart while you have not paused or disconnected it.

**Control and privacy:** In full-access mode, regular open HTTP(S) tabs are in scope. LUCH does not request browsing-history or cookie APIs. Requested page content may be sent to your authorized AI host. Chrome itself restricts system and protected pages. A compatible AI host with custom MCP support is required.

**Release status:** Pre-release draft. Not approved for store submission or working-browser installation until the outstanding QA, Chrome permission, and cloud end-to-end gates close.

## Product-language principles
- Do not put “CDP”, “PeerBus”, “gate”, “HOLD”, infrastructure diagrams or technical identifiers on the first screen.
- Do not claim every site, all AI models, autonomous high-impact transactions or universal browser support.
- Say “Приостановить” to pause control, “Отключить” to remove pairing, and “Разрешить” only for the actual Chrome permission moment.
- Make the first practical request visible, not a fictional testimonial or fake success animation.