# LUCH Browser Companion — Chrome Web Store & Opera Add-ons listing pack

**Candidate:** 0.5.2  
**Status:** listing copy prepared; **not approved for submission**. The public Chrome listing remains 0.4.0. Opera's earlier 0.4.1 submission is a separate moderation state. The 0.5.2 Opera build has not completed its own runtime test.

## Release truth — do not remove these qualifications

LUCH Browser Companion shares only a tab the user explicitly approves. It requires a compatible LUCH Companion already installed and running on the same computer, plus an already-authorized LUCH account and AI client.

The extension alone does not install the desktop Companion, create a LUCH account or connect an AI host. A general public self-service installer and fresh-user OAuth/onboarding are not available yet. The currently verified local setup is limited to supported, already-authorized macOS configurations. Windows onboarding is unverified; Opera runtime E2E is still required.

Do not claim that the extension provides all 54 LUCH browser tools. The candidate extension has 16 read/inspection and 23 interaction/navigation operation identifiers. LUCH's broader browser inventory contains separate local-browser and server-browser providers; these are not all functions of this extension.

## Chrome Web Store

### English listing

**Name**  
LUCH Browser Companion

**Short description**  
Share selected browser tabs with LUCH. Reading and interaction require separate approval.

**Category**  
Productivity

**Detailed description**

Share the browser page you choose with your authorized LUCH setup. Keep control over which tab is shared and whether LUCH may only read it or also interact with it.

**Read and understand a page**  
Ask your connected LUCH workflow to inspect visible page text, headings, links, forms and tables on a tab you approve.

**Move through the page**  
Navigate, scroll, inspect elements and capture a screenshot of the active approved tab where the connected LUCH route supports that operation.

**Allow interaction separately**  
Reading and interaction are different permissions. You can separately allow supported clicks, ordinary text entry, selection and other bounded page actions. Protected password/file fields and form submissions are restricted; some consequential controls are refused.

**Stay in control**  
Approve each tab yourself. Revoke access at any time, close the tab or browser session, or navigate to another website origin to end that grant. Disconnect the browser to clear the pairing.

**Requirements**  
This early-access extension requires a compatible LUCH Companion already installed and running on the same computer, as well as an already-authorized LUCH account and AI client. Installing the extension alone does not install the desktop Companion or connect an AI host. General public self-service setup is not yet available.

Only the page data you request from an approved tab is shared with the local Companion. When you ask an authorized AI host to use that content, the requested page content may be passed to that host. Review the privacy disclosure before approving a tab.

**Website**  
https://luch.lenarsalimov.ru/en/browser/

**Support URL**  
https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md

**Privacy URL**  
https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md

### Русская локализация

**Название**  
LUCH Browser Companion

**Краткое описание**  
Передавайте выбранные вкладки в LUCH. Чтение и взаимодействие требуют отдельных разрешений.

**Категория**  
Productivity

**Подробное описание**

Передавайте выбранную вами страницу в уже авторизованную конфигурацию LUCH. Вы сами решаете, какую вкладку открыть для LUCH и разрешать ли только чтение или также взаимодействие со страницей.

**Чтение и анализ страницы**  
Попросите подключённый рабочий процесс LUCH изучить видимый текст, заголовки, ссылки, формы и таблицы на разрешённой вкладке.

**Навигация по странице**  
Переходите по страницам, прокручивайте содержимое, изучайте элементы и получайте снимок активной разрешённой вкладки там, где соответствующая операция поддерживается подключённым маршрутом LUCH.

**Отдельное разрешение на действия**  
Чтение и взаимодействие — разные разрешения. Вы отдельно разрешаете поддерживаемые нажатия, ввод обычного текста, выбор значений и другие ограниченные действия. Поля паролей и файлов, а также отправка форм защищены; некоторые значимые действия блокируются.

**Контроль остаётся у вас**  
Вы сами разрешаете доступ к каждой вкладке. Можно отозвать доступ, закрыть вкладку или сеанс браузера либо перейти на другой сайт. Отключение браузера удаляет сопряжение.

**Требования**  
Это ранняя версия расширения. Нужен уже установленный и запущенный совместимый LUCH Companion на том же компьютере, а также заранее авторизованные аккаунт LUCH и ИИ-клиент. Одной установки расширения недостаточно: она не устанавливает Companion и не подключает ИИ. Общедоступная самостоятельная установка пока недоступна.

В локальный Companion передаются только данные выбранной вами вкладки, которые вы запросили. Если вы поручаете авторизованному ИИ-клиенту использовать эти данные, содержимое страницы может быть передано этому ИИ. Перед разрешением доступа ознакомьтесь с политикой конфиденциальности.

**Сайт**  
https://luch.lenarsalimov.ru/ru/browser/

**Поддержка**  
https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md

**Конфиденциальность**  
https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md

## Opera Add-ons

Opera requires a complete-sentence summary and a description that explains how the extension is used and what it looks like. Keep Opera branding out of the title and graphics.

### English

**Name**  
LUCH Browser Companion

**Summary**  
LUCH Browser Companion shares browser tabs you choose with your authorized LUCH setup. Reading and interaction require separate approval.

**Description**

LUCH Browser Companion adds a small browser popup for pairing with a supported local LUCH Companion and controlling access to the current tab.

Open the extension on a regular website. Pair the browser with the local Companion using a one-time code, then choose whether LUCH may read the current tab. If you want supported page actions, approve interaction separately.

The popup shows the current tab and its access state. You can revoke access to the tab or disconnect the browser. Grants end when revoked, when the tab or browser session closes, or when the tab moves to another website origin.

This early-access extension requires a compatible LUCH Companion already installed and running on the same computer and an already-authorized LUCH account and AI client. Installing the extension alone does not install the desktop app or connect an AI host. General public self-service setup is not yet available.

### Русская локализация

**Название**  
LUCH Browser Companion

**Краткое описание**  
LUCH Browser Companion передаёт выбранные вкладки в авторизованную конфигурацию LUCH. Чтение и взаимодействие требуют отдельных разрешений.

**Описание**

LUCH Browser Companion добавляет небольшое окно расширения для сопряжения с поддерживаемым локальным LUCH Companion и управления доступом к текущей вкладке.

Откройте расширение на обычном сайте. Подключите браузер к локальному Companion одноразовым кодом, затем выберите, можно ли читать текущую вкладку. Если нужны поддерживаемые действия на странице, отдельно разрешите взаимодействие.

В окне расширения отображаются текущая вкладка и состояние доступа. Вы можете отозвать доступ или полностью отключить браузер. Разрешение прекращается после отзыва, закрытия вкладки или сеанса браузера либо перехода на другой сайт.

Это ранняя версия расширения. Нужен совместимый LUCH Companion, уже установленный и запущенный на том же компьютере, а также заранее авторизованные аккаунт LUCH и ИИ-клиент. Установка расширения сама по себе не устанавливает приложение и не подключает ИИ. Общедоступная самостоятельная установка пока недоступна.

## Permissions and data disclosure

| Permission | User-facing reason |
|---|---|
| `activeTab` | Temporary access to the tab after the user invokes the extension and approves sharing |
| `scripting` | Run bundled, bounded page-reading and interaction functions in an approved tab |
| `storage` | Store the local pairing token and session-scoped tab grants |
| `alarms` | Poll the local Companion for authorized work while the browser session is active |
| `http://127.0.0.1:9248/*` | Communicate with the local Companion only |

The extension does not request cookies, browsing history, downloads, geolocation, clipboard, debugger, webRequest or all-sites access. Requested approved-page content may be sent onward to the AI host the user has authorized.

## Graphic asset checklist

### Chrome Web Store

- Store icon: 128×128 PNG; 96×96 artwork centered with 16px transparent padding.
- Screenshots: 1280×800 PNG/JPEG, at least one and up to five; use the latest real extension UI and a truthful example.
- Small promotional tile: 440×280 PNG/JPEG (required).
- Marquee promotional tile: 1400×560 PNG/JPEG (optional).
- Localize the description and screenshots for English and Russian; Chrome's small and marquee promotional tiles are global rather than localized.

### Opera Add-ons

- Icons: 128×128, 48×48 and 16×16 PNG; keep a consistent simple shape, with a full-bleed icon background.
- Screenshots: 612×408 recommended; do not exceed 800×600. Use a clean white background and show the actual extension UI and its relation to the page.
- Do not use Opera marks, names or browser branding in the artwork.

### Current asset status

The candidate branch's old micro-L B icon is **not approved as the final plugin mark**. A new non-letter ray/aperture mark is prepared as a visual candidate only; it is not yet approved or wired into the extension manifest. The approved full luminous LUCH app mark is preserved separately and may be used as a supporting brand asset, not as a substitute for the final extension icon.

The CI-generated Chrome screenshots are captured from the actual headed Chromium E2E fixture and popup UI. They are authentic candidate UI captures, not evidence of Opera runtime verification. Opera-specific screenshots must be recaptured after the Opera E2E gate.

## Submission gates

Do not submit either store until all are true:

1. Founder approves the final non-letter plugin icon and Figma source; the temporary micro-L B is not reused.
2. Fresh-user onboarding is available or the supported-setup restriction is explicitly accepted for the listing.
3. The live LUCH Browser Bridge integration and account/tenant isolation pass independent end-to-end verification; a shadow canary is not production activation.
4. Chrome exact-build E2E passes for the final package.
5. Opera exact-build E2E passes and its screenshots are captured from Opera.
6. Privacy disclosure and permission justifications match the final implementation.
7. The store package, icon, screenshots, listing copy and privacy links all reference the same final version.
