# LUCH Browser Companion 0.8.6 — Chrome Web Store update copy (R14.4)

**Existing item ID:** `lbijjcmjnlcbooadjgjignfmhaiealpd` (update existing 0.7.0, do not create a duplicate).

## EN (default): full description

Connect your browser to a compatible AI conversation with LUCH Browser Companion. Ask your AI to understand a webpage, locate information, navigate, and perform supported actions — without repeatedly copying and pasting.

**Get started**
1. In your existing AI host, connect LUCH using its supported remote MCP authorization and create a one-time eight-digit browser pairing code.
2. Enter that code in the extension. It lasts ten minutes.
3. Choose whether to enable full browser control. Chrome will ask you to approve access to normal HTTP(S) websites, tab information and downloads. If approved, your connected AI may read and interact with **all ordinary web tabs in this Chrome profile**, including tabs you open later, until you press Pause or Disconnect.
4. Precise on-page pointer and advanced keyboard controls require an additional optional Chrome debugger permission and explicit approval for that tab.

**What you can do**
- Read and summarize articles, documentation, forms, and other permitted webpages.
- Find headings, links, tables and visible page elements.
- Perform supported clicks, text entry, navigation and tab/window actions.
- Review download metadata and initiate downloads when requested.
- Use up to 100 named browser operations, subject to your AI host and Chrome support.

**Your privacy and controls**
Approved webpage contents, action arguments and results may pass through the LUCH cloud relay to your authorized AI provider. Access is persistent until you pause or disconnect. Do not approve a browser profile containing sensitive pages unless you accept sharing relevant page content. Precise pointer access is a separate choice. LUCH does not sell browsing data or use it for ads.

Chrome internal pages are not accessible. The current browser-wide candidate supports up to 500 eligible tabs. Your AI app must support the LUCH remote MCP connection; installing this extension alone does not grant those tools to every AI account.

Privacy policy: https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md
Support: https://github.com/lenar2/luch/issues

## RU: full description

LUCH Browser Companion соединяет ваш браузер с совместимым ИИ. ИИ может помогать читать страницы, находить информацию, переходить по ссылкам и выполнять поддерживаемые действия — после подключения и вашего разрешения.

**Как подключить**
1. Подключите LUCH через поддерживаемый вашим ИИ удалённый MCP и получите одноразовый восьмизначный код.
2. Введите код в расширении. Он действует 10 минут.
3. При желании включите полное управление браузером. Chrome запросит доступ к обычным HTTP(S)-сайтам, вкладкам и загрузкам. После разрешения ваш ИИ сможет читать страницы и выполнять действия **во всех обычных веб-вкладках этого профиля Chrome**, включая новые, пока вы не нажмёте «Приостановить» или «Отключить».
4. Точный курсор и расширенное управление клавиатурой требуют отдельного системного разрешения Chrome и включения для конкретной вкладки.

**Возможности**
- Читать и объяснять статьи, инструкции, документацию и другие доступные страницы.
- Находить заголовки, ссылки, таблицы и элементы.
- Нажимать кнопки, вводить текст и работать со вкладками.
- Просматривать сведения о загрузках и запускать скачивание по запросу.
- Использовать до 100 поддерживаемых операций с учётом возможностей ИИ и Chrome.

**Конфиденциальность**
Данные разрешённых страниц и результаты действий могут передаваться через облако LUCH вашему ИИ. Доступ сохраняется до приостановки или отключения. Не открывайте такой доступ профилю с конфиденциальными страницами, если не готовы делиться их содержимым. LUCH не продаёт данные браузера и не использует их для рекламы.

Внутренние страницы Chrome недоступны. Поддерживается до 500 обычных вкладок в одном браузере. Для подключения необходим ИИ-клиент с поддержкой удалённого MCP.

Политика конфиденциальности: https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md
Поддержка: https://github.com/lenar2/luch/issues

## CWS permission explanation (downloads)

The optional downloads permission is requested only when the owner enables full browser control. It lets the owner's authorized AI inspect recent download metadata and start a download from a requested HTTP(S) URL. It does not read arbitrary local files or upload downloaded file contents. The owner can revoke access in Chrome settings.

## Submission gate
- 0.8.6 ZIP is uploaded to CWS as draft; published remains 0.7.0 until review/publish.
- Verify current public privacy URL explicitly discloses browser-wide access, optional downloads and debugger.
- Ensure store descriptions above replace outdated selected-tab-only marketing.
- Obtain real Chrome native consent and independent QA where feasible; avoid claims beyond evidence.
