# LUCH Browser Companion — Chrome Web Store / Opera Add-ons submission draft

**Candidate build:** 0.7.0 · **Updated:** 21 November 2026  
**Publication state:** **NOT SUBMITTED / RELEASE HOLD**. This file is review copy, not a claim that the add-on is live or reviewed by Google, Opera or OpenAI.

## Requirements and limitations to preserve in every listing

LUCH Browser Companion is a browser-tool extension for compatible **existing AI conversations**. No separate LUCH chat and no personal OpenAI/Anthropic API key are required. The user must separately connect and authorize the public LUCH remote MCP server inside an AI client that supports custom MCP. Feature access, including write actions, varies by AI provider, plan and workspace policy. Do **not** claim support for every ChatGPT account or that installation automatically attaches tools to a chat.

Unlike the historical 0.6.0 concept, the 0.7.0 extension connects to LUCH cloud over HTTPS, without a mandatory desktop broker or localhost setup. Real user data leaves the user's computer when the user explicitly requests approved page content or screenshots in the connected AI tool.

**Review blockers:** The Opera runtime has not passed exact-build E2E, a fresh unconnected user has not passed the entire self-service flow, and independent review of the full 45-operation interaction/pointer surface is not complete. Do not submit the package to either store before those gates and final approved screenshots are closed.

## Chrome Web Store listing — English

**Name:** LUCH Browser Companion  
**Category:** Productivity  
**Short description:** Connect approved browser tabs to your existing supported AI. Reading and interaction require separate consent.

**Description:**

Use LUCH Browser Companion to give a supported, connected AI assistant access to browser tabs **you** choose. Work in your normal ChatGPT or another compatible AI conversation, without a separate LUCH chat or personal model API key.

**How it works:** Connect an eligible AI client to the LUCH remote MCP endpoint and authorize it with LUCH OAuth. Ask your AI for a one-time browser pairing code, enter it directly in the extension, then click the extension icon on a tab to allow reading. Interaction such as clicking and typing is optional and must be approved separately for that tab.

**You stay in control:** Revoke a tab at any time, change site origin, close the browser session or disconnect a device. Other tabs remain private unless you opt into a separate overview of their titles and addresses. Precise on-page pointer control is an optional advanced action with additional consent and powerful debugger permission.

**Privacy:** Content from approved tabs may be sent through LUCH cloud to your authorized AI provider. The extension does not request browser-history, cookies, OS-file or all-sites host permissions. See the full policy before approving sensitive tabs.

**Compatibility:** Chromium-based Chrome and Opera are intended targets. Availability and actions depend on your AI host's supported custom MCP features, account plan and workspace permissions. Installing the extension alone does not connect an AI account.

**Website:** https://luch.lenarsalimov.ru/en/browser/  
**Support:** https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md  
**Privacy policy:** https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md

## Chrome Web Store listing — Русский

**Название:** LUCH Browser Companion  
**Категория:** Productivity  
**Краткое описание:** Подключайте разрешённые вкладки браузера к своему ИИ. Чтение и действия требуют отдельных разрешений.

**Описание:**

LUCH Browser Companion позволяет вашему привычному, совместимому ИИ работать с **выбранными вами вкладками**. Отдельный чат LUCH и личный API-ключ OpenAI/Anthropic не нужны.

**Подключение:** Добавьте удалённый MCP LUCH в ИИ-клиент, который поддерживает внешние инструменты, и подтвердите OAuth. Получите одноразовый код сопряжения в своём ИИ и введите его в расширении. Затем нажмите значок расширения на нужной вкладке, чтобы разрешить её чтение. Нажатия, ввод текста и другие действия разрешаются отдельно.

**Управление доступом:** Вы можете отозвать разрешение, закрыть вкладку или сеанс, перейти на другой сайт либо отключить браузер. Все другие вкладки остаются закрытыми для чтения. Передача названий и адресов всех открытых вкладок — отдельная необязательная функция.

**Точный курсор:** Дополнительная функция для действий внутри страницы, требующая отдельного разрешения и доступа Chrome debugger. Браузер может показывать предупреждение о широких возможностях отладчика.

**Приватность:** Содержимое выбранной разрешённой страницы может передаваться через облако LUCH вашему авторизованному ИИ. Расширение не запрашивает историю браузера, cookies и общий доступ ко всем сайтам. Не открывайте чувствительные страницы без понимания последствий.

**Ограничения:** Набор доступных функций зависит от поддержки MCP самим ИИ, подписки и правил рабочего пространства. Установка расширения не гарантирует полноценное управление браузером в каждом тарифе ChatGPT.

**Сайт:** https://luch.lenarsalimov.ru/ru/browser/  
**Поддержка:** https://github.com/lenar2/luch/blob/main/docs/browser-companion-support.md  
**Конфиденциальность:** https://github.com/lenar2/luch/blob/main/docs/browser-companion-privacy.md

## Opera Add-ons

**Name:** LUCH Browser Companion

**English summary:** Connect browser tabs you approve to your existing supported AI client through LUCH. Reading and interaction each require explicit consent.

**Русское описание:** Подключайте выбранные вкладки Opera к своему совместимому ИИ через защищённый облачный LUCH MCP. Разрешения на чтение, действия и передачу обзора всех вкладок независимы друг от друга.

Use the full English/Russian Chrome listing above as the Opera long description, with the word **Opera** for the browser being reviewed. Do not imply Opera has passed testing until the real installed version does.

## Permissions and privacy-practices worksheet for reviewers

| Requested item | Why it is needed |
| --- | --- |
| `activeTab` | Temporary, user-initiated access to the particular tab on which the extension was invoked |
| `scripting` | Bounded DOM extraction and permitted page actions in an already approved tab |
| `storage` | Browser device credential and session-scoped tab approvals |
| `alarms` | Wake a Manifest V3 service worker to receive jobs after idle |
| `debugger` | Optional precise pointer capability; note this is currently a **required install-time permission**, with a separate in-product user enablement |
| `https://api.lenarsalimov.ru/luch/browser/*` | Secure account-bound cloud relay and device pairing |
| Optional `tabs` | Metadata of all open tabs only after user separately enables the overview and cloud sharing |

**Prominent disclosure:** Approved tab URLs, titles and requested page contents/screenshots may leave the computer and be processed by LUCH and the connected AI host. Pairing/device metadata, commands, result payloads and limited audit metadata have bounded retention documented in the privacy policy. Review Google and Opera policies before declaring their compliance.

## Release acceptance checklist

- [x] Public cloud MCP endpoint responds and rejects unauthenticated tool calls.
- [x] Chrome pilot: real OAuth, one-time pairing, approved read, denial after revocation.
- [x] Local LUCH Server unit/contract suite and legacy broker negative suite pass on current branch.
- [x] P029 scheduled database retention and cleanup execution verified.
- [ ] Independent security review: account/device isolation, malicious page content, navigation race, approved click and precise pointer.
- [ ] Cold-start and idle-browser end-to-end latency acceptance.
- [ ] Chrome and Opera clean-profile exact ZIP install tests; Opera has not passed.
- [ ] Fresh user without pre-configured LUCH host: OAuth registration and device pairing.
- [ ] Store account ownership, privacy-form answers and final version-matched real screenshots.
- [ ] Approved immutable ZIP and checksum, developer publisher identity and marketplace moderation.

Google may require a registered developer account and review; Opera separately reviews submissions. The public **GitHub** release, Chrome store release, Opera store release and public LUCH signup are separate publication decisions. Do not replace one with another or reuse an old draft store listing.

**Decision: RELEASE HOLD.**
