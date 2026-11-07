#!/usr/bin/env python3
"""LUCH human-first website. Deterministic bilingual static build; no secrets."""
from pathlib import Path
from html import escape
from human_pages import render as human_render
import re, hashlib
P=Path(__file__).resolve().parent
BRAND="https://luch.lenarsalimov.ru"
GITHUB="https://github.com/lenar2/luch"
LINKS={
"chatgpt":"https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt",
"claude":"https://github.com/lenar2/luch-claude-plugin",
"cursor":"https://github.com/lenar2/luch-cursor",
"gemini":"https://github.com/lenar2/luch-gemini",
"kimi":"https://github.com/lenar2/luch-claude-plugin/tree/kimi-v0.1.6-candidate",
}
LOC={
"ru":{"work":"Что меняется","story":"Реальная работа","tools":"Возможности","connect":"Подключение","start":"Как подключиться","switch":"EN","lang":"en","skip":"К содержимому","support":"Помощь","status":"Доступность","rights":"Работа остаётся под вашим контролем.","footer":"Настоящая работа начинается с человеческой задачи.","legal":"Правовая информация","privacy":"Конфиденциальность","terms":"Условия","safe":"Безопасность","read":"Читать подробнее","next":"Следующий шаг","example":"Пример сценария, не запись выполненной задачи."},
"en":{"work":"What changes","story":"Real work","tools":"Capabilities","connect":"Connect","start":"How to connect","switch":"РУ","lang":"ru","skip":"Skip to content","support":"Support","status":"Availability","rights":"You stay in control.","footer":"Real work begins with a human need.","legal":"Legal","privacy":"Privacy","terms":"Terms","safe":"Safety","read":"Read more","next":"Next step","example":"Illustrative workflow, not a record of execution."},
}
# Each page has a real person's job, specific meaning, context, useful directions, and honest access boundaries.
PAGE={
"browser":{
"ru":("Меньше вкладок.<br><em>Больше ясности.</em>","Попросите ИИ разобраться на сайте, сравнить информацию или пройти разрешённый сценарий в браузере. Вам не нужно вручную переносить каждый шаг в чат.","Веб становится частью задачи, а не отдельной работой.","Посмотреть два способа работы","Два способа работать с вебом",[
("Отдельный браузер","Для исследования публичных сайтов LUCH может открывать изолированную браузерную сессию на сервере. Ваш Mac для этого не нужен."),
("Ваш браузер","Для страниц в вашем аккаунте нужен подключённый компьютер и соответствующее разрешение. Это другой тип доступа."),
("Результат, который видно","Навигация, ввод, снимки и проверка страницы доступны там, где разрешены. Чувствительные действия требуют отдельного намерения.")],"Сценарий","«Сравни условия двух сервисов и покажи, где они действительно отличаются».","Ссылки на источники и ясное сравнение вместо десяти открытых вкладок."),
"en":("Fewer tabs.<br><em>More clarity.</em>","Ask your AI to explore a page, compare information or follow an approved browser workflow. You shouldn't have to transfer every step back into a chat.","The web becomes part of the work, not a second job.","Two ways to browse","Two ways LUCH can reach the web",[
("A separate browser","For public-site research, LUCH can open an isolated browser on a server. Your Mac doesn't need to be online."),
("Your own browser","For signed-in personal pages, access depends on a connected computer and explicit permissions. This is a separate mode."),
("An outcome you can check","Navigation, typing, screenshots and page checks can be available where authorized. Sensitive actions need specific intent.")],"An example","“Compare these two services and show me the meaningful differences.”","A concise comparison with sources, instead of ten open tabs.")},
"computer":{
"ru":("Пусть задача<br><em>не застревает в чате.</em>","Ваш ИИ может работать с разрешёнными файлами, окнами и программами подключённого устройства. Не по волшебству: только с доступом, который вы дали.","Вы выбираете устройство и рамки работы.","Как устроен доступ","Ваш компьютер — ваша территория",[
("Окна и приложения","Поддерживаемые действия с экраном, мышью и клавиатурой доступны на подключённом Mac в пределах разрешений системы."),
("Файлы и заметки","Найти, прочитать, сравнить материалы и подготовить изменения. Для записи нужны соответствующие разрешения и проверки."),
("Серверы отдельно","Разрешённый серверный исполнитель может работать без вашего Mac. Не всякая функция доступна на каждом устройстве.")],"Сценарий","«Найди нужный документ и предложи обновления по новым материалам».","Вместо поиска по папкам — подготовленная версия для вашего решения."),
"en":("Let work leave<br><em>the chat.</em>","Your AI can work with approved files, windows and apps on a connected device. Not by magic: only with the access you choose.","You select the device and the limits.","How access works","Your computer remains yours",[
("Windows and apps","Supported screen, mouse and keyboard actions on a paired Mac depend on OS and account permissions."),
("Files and notes","Find, read, compare and prepare changes. Writing requires the relevant grants and safeguards."),
("Servers are separate","An approved server executor can work without your Mac. Capabilities differ by device.")],"An example","“Find the right document and suggest updates from these approved sources.”","A proposed revision for your decision instead of a hunt through folders.")},
"clients":{
"ru":("Ваш ИИ.<br><em>Знакомый разговор.</em>","LUCH создаётся для работы с выбранным вами ИИ. Но доступность подключения отличается между клиентами, и публичная установка ещё не равна работающему аккаунту.","Начните с того ИИ, которым уже пользуетесь.","Посмотреть интеграции","Интеграции и их статус",[
("ChatGPT","Исходный код интеграции опубликован. Работа в окружении основателя подтверждена; самостоятельное подключение нового пользователя пока не подтверждено."),
("Claude, Cursor, Gemini CLI","Доступен исходный код интеграций. Публикация в каталогах и независимый вход проверяются отдельно."),
("Kimi и новые клиенты","Адаптер Kimi остаётся кандидатом. Его наличие в публичном каталоге не подтверждено.")],"Выбор","«Я уже работаю в ChatGPT. Как понять, могу ли подключить LUCH?»","Проверить интеграцию и доступ к учётной записи, не обещая недоступную кнопку."),
"en":("Your AI.<br><em>A familiar conversation.</em>","LUCH is made to work with the AI you choose. But connection availability differs by client, and public installation isn't the same as a working account.","Begin with the AI you already use.","Explore integrations","AI clients and what is known",[
("ChatGPT","Integration source is published. It works in the founder's environment; independent new-user onboarding is not verified."),
("Claude, Cursor, Gemini CLI","Integration source is available. Directory publication and independent sign-in vary and are assessed separately."),
("Kimi and others","The Kimi adapter is a candidate. Public catalog listing has not been confirmed.")],"A choice","“I already use ChatGPT. Can I connect LUCH?”","Check the client and your account's access rather than promising an unavailable button.")},
"connect":{
"ru":("Один следующий шаг.<br><em>Без лабиринта.</em>","Сначала выберите свой ИИ-клиент. Затем проверьте доступ учётной записи. Если он открыт — подключите только нужный инструмент и начните с небольшой задачи.","Начните с того, что уже работает у вас.","Инструкция для технического подключения","Путь от запроса к результату",[
("1. Выберите ИИ","ChatGPT, Claude, Cursor и Gemini CLI имеют отдельные интеграции и требования."),
("2. Проверьте доступ","Для LUCH нужен разрешённый аккаунт и поддерживаемый способ входа. Публичный пакет не открывает доступ автоматически."),
("3. Разрешите нужное","Выберите браузер, файлы или устройство под конкретную задачу. Не требуется давать доступ ко всему сразу."),
("4. Посмотрите результат","Сверьте сделанное с запросом. Сессию браузера можно завершить, разрешения устройства — отозвать.")],"Первый запрос","«Посмотри эту открытую страницу и кратко перескажи её с ссылкой».","Начните без записи и убедитесь, что подключение действительно работает."),
"en":("One next step.<br><em>No maze.</em>","Choose your AI client first. Check your account's access. If enabled, connect only what's needed and start with a small task.","Start where your AI already works.","Technical connection guide","From first request to useful result",[
("1. Choose your AI","ChatGPT, Claude, Cursor and Gemini CLI each have different integration requirements."),
("2. Check access","LUCH requires an enabled account and supported sign-in. A public client package alone doesn't grant access."),
("3. Approve what's needed","Pick the browser, files or device for the task. You needn't authorize everything."),
("4. Check the outcome","Confirm what happened. Release the browser session or revoke device access when needed.")],"A first request","“Read this public page and give me a short summary with a source link.”","Begin read-only, and confirm the connection actually works.")},
"free":{
"ru":("Ваши инструменты.<br><em>Без платы за доступ.</em>","LUCH Core задуман как бесплатный набор инструментов для работы вашего ИИ с разрешёнными ресурсами. Ограничения безопасности и разумного использования остаются.","Бесплатные инструменты — не обещание безграничных серверных ресурсов.","Что входит","Что бесплатно, а что ещё не существует",[
("LUCH Core","Поддерживаемые браузерные действия, доступ к разрешённым файлам, устройствам и серверам — без отдельной платной подписки на функции Core."),
("Разумные ограничения","Облачные мощности и безопасность требуют лимитов. Доступ зависит от аккаунта и конкретной интеграции."),
("Управляемые агенты — позже","Длительная автономная работа на инфраструктуре LUCH — отдельная будущая услуга. Тарифы не объявлены, продаж нет.")],"Принцип","«Хочу пользоваться своим ИИ и своими инструментами».","Без искусственного разделения базовых функций на платные уровни."),
"en":("Your tools.<br><em>No feature tollgate.</em>","LUCH Core is intended as a free toolkit for your AI to work with approved resources. Fair-use, infrastructure and safety limits still apply.","Free tools do not mean unlimited hosted compute.","What's included","What's free and what is not yet a service",[
("LUCH Core","Supported browser actions, approved files, devices and servers do not require a separate paid Core feature tier."),
("Fair limits","Cloud resources and safety require limits. Access depends on account and integration."),
("Managed agents later","Long-running autonomous work on LUCH infrastructure is a future separate service. No prices or sales are announced.")],"The principle","“I want to use my own AI with the tools I already have.”","Core capability without artificial feature-tier barriers.")},
"agents":{
"ru":("Когда дело сложнее<br><em>одного запроса.</em>","В перспективе LUCH сможет предложить управляемых агентов для длительной работы. Сейчас это направление разработки, а не доступная подписка.","Не выдаём будущую услугу за работающий продукт.","Пока используйте Core","Что задумано",[
("Длинная задача","Помощь с работой, где нужны несколько инструментов, этапов и возвращение к результату."),
("Контроль и расходы","Прежде чем запускать длительную работу, человек должен видеть доступ, границы и стоимость."),
("Статус","Публичной подписки на Managed Agents и обещанных тарифов пока нет. Доступность будет объявлена отдельно.")],"Возможность","«Проведи исследование, собери материалы и принеси решение».","В будущем — работа с этапами и ясным местом для вашего решения."),
"en":("When work takes<br><em>more than one step.</em>","LUCH may later offer managed agents for longer work. Today this is a product direction, not an available subscription.","A future service is not a live promise.","Use Core today","What we're exploring",[
("Longer outcomes","Support for tasks spanning multiple tools, stages and return to a reviewable result."),
("Clear control and costs","Before an extended run, people should understand access, limits and cost."),
("Current status","Managed Agents are not on sale. No public subscription or pricing is announced.")],"A possibility","“Research this, collect the evidence and bring back options.”","In the future, a multi-step outcome with a clear moment for your decision.")},
"platform":{
"ru":("Не больше кнопок.<br><em>Больше сделанного.</em>","LUCH объединяет доступ к инструментам вокруг одной задачи. Возможности разные, но человек должен видеть работу целиком, а не устройство системы.","Инструменты появляются там, где нужны.","Исследовать возможности","Что может быть частью работы",[
("Веб и исследование","Публичные сайты через изолированный браузер, личные страницы — при соответствующем доступе."),
("Документы и компьютер","Работа с разрешёнными файлами, окнами, заметками и приложениями подключённого устройства."),
("Разработка и другие сервисы","GitHub, ограниченные серверные команды и отдельные интеграции. Каждая зависит от разрешений и состояния сервиса.")],"Направление","«Найди проблему, проверь материалы, предложи исправление».","Одна человеческая задача, даже если она касается нескольких систем."),
"en":("Not more buttons.<br><em>More work moved.</em>","LUCH brings different tools into one task. Capabilities vary, but the experience should stay centered on what you want to achieve.","Tools appear when the task needs them.","Explore capabilities","What can become part of the work",[
("Web and research","Public sites through an isolated browser; personal pages when the corresponding access exists."),
("Documents and computers","Approved files, windows, notes and applications on a connected device."),
("Development and services","GitHub, bounded server commands and specialized integrations. Each depends on authorization and readiness.")],"The direction","“Find the problem, check the source, suggest a fix.”","One human request even when several systems are involved.")},
"status":{
"ru":("Что доступно?<br><em>Без догадок.</em>","LUCH работает в подключённом окружении основателя. Возможности нового пользователя зависят от интеграции и доступа к аккаунту. Полный независимый путь подключения ещё не подтверждён.","Это описание подтверждённых возможностей, не мониторинг в реальном времени.","Подключение","Разделяем работающее, условное и будущее",[
("Проверено в окружении основателя","Изолированный серверный браузер, серверный исполнитель и отдельные интеграции выполняли реальные действия в разрешённом окружении."),
("Зависит от подключения","Управление Mac, доступ к файлам и заметкам зависят от наличия устройства, разрешений и конкретной сессии."),
("Ещё не общедоступно","Универсальная регистрация, полноценное управление iPhone, магазины браузерных расширений, Managed Agents и полный независимый новый пользовательский сценарий.")],"Текущий факт","«Могу ли я использовать это прямо сейчас?»","Проверить выбранного клиента и включённость аккаунта. Не объявлять доступ без проверки."),
"en":("What works?<br><em>No guessing.</em>","LUCH operates in the founder's connected environment. New-user access depends on the integration and enabled accounts. Independent end-to-end onboarding has not been verified.","A capability picture, not a real-time uptime monitor.","How to connect","Separate observed, conditional and future access",[
("Observed in founder setup","Isolated server browser, independent server executor and integrations have completed authorized actions."),
("Depends on pairing","Mac control, files and notes require the paired device, permissions and a suitable session."),
("Not general availability","Open signup, full native iPhone control, extension-store releases, Managed Agents and independent fresh-user end-to-end onboarding.")],"The question","“Can I use this right now?”","Check the client and account instead of claiming unverified availability.")},
"safety":{
"ru":("Доверие — это<br><em>право выбирать.</em>","Удобный ИИ не должен означать бесконтрольный доступ. Вы определяете, с чем он работает; важные действия не должны прятаться за обещанием автоматизации.","Доступ можно ограничить и отозвать.","О безопасности","Человеческий контроль в каждом действии",[
("Выберите конкретное","Устройство, браузер, файлы и сервисы выбираются отдельно. Недоступное устройство не подменяется другим."),
("Уточните важное действие","Покупки, удаление, публикации и изменения аккаунтов требуют конкретного намерения и подходящих подтверждений."),
("Видите результат","Подтверждение доставки запроса не означает выполнения. Фактическое действие и ограничения должны быть различимы.")],"Принцип","«Мой ИИ может помочь, но решение остаётся за мной».","Меньше тревоги от скрытой автоматизации, больше контроля."),
"en":("Trust is<br><em>the right to choose.</em>","A useful AI should not mean unlimited access. You decide what it can reach; consequential actions must not disappear behind a promise of automation.","Access can be scoped and revoked.","Safety","Human control in every action",[
("Choose the exact resource","Devices, browsers, files and services have separate permissions. An unavailable device is not silently replaced."),
("Make important actions explicit","Purchases, deletion, publishing and account changes require specific intent and proper confirmation."),
("Know what happened","A delivered request isn't a completed action. Results and limitations should be distinguishable.")],"The principle","“My AI can help, but the decision remains mine.”","Less anxiety from hidden automation, more control.")},
"help":{
"ru":("Разобраться<br><em>без инструкции на час.</em>","Здесь ответы на вопросы, которые действительно возникают перед подключением: доступ, безопасность, устройства и цена.","Если доступ ещё не открыт, так и скажем.","Частые вопросы","Короткие ответы",[
("Могу ли я пользоваться бесплатно?","Core предназначен для бесплатной работы с инструментами при ограничениях безопасности и ресурсов."),
("Будет ли ИИ управлять всем компьютером?","Нет. Только разрешёнными функциями поддерживаемого подключённого устройства."),
("Нужно держать Mac включённым?","Для изолированного серверного браузера — нет. Для доступа к самому Mac — да."),
("Могу ли я зарегистрироваться самостоятельно?","Полный самостоятельный путь нового пользователя пока не подтверждён. Проверяйте доступ конкретного клиента.")],"Поддержка","«Не могу подключиться. Куда сообщить?»","Сообщите о проблеме через GitHub Issue без паролей и личных данных."),
"en":("Understand it.<br><em>Without a manual.</em>","Answers to what matters before connecting: access, safety, devices and cost.","If access isn't ready, we say so.","Frequently asked questions","Short answers",[
("Is it free?","Core tools are intended to be free, subject to infrastructure and safety limits."),
("Will it control my whole computer?","No. Only authorized functions on a supported paired device."),
("Does my Mac have to stay on?","Not for the isolated server browser. Yes for operations on your Mac."),
("Can I sign up on my own?","Independent self-service onboarding is not yet verified. Check your client and account.")],"Support","“My connection isn't working. Where do I report it?”","Open a GitHub issue without passwords or personal data.")},
"privacy":{
"ru":("Ваши данные.<br><em>Ваши границы.</em>","LUCH работает с ресурсами только в пределах разрешений. Полный действующий документ о конфиденциальности опубликован отдельно; здесь — понятный путь к нему.","Правовой текст важнее обещаний на главной странице.","Политика конфиденциальности","Что важно понимать",[
("Доступ выбирается","Файлы, браузеры, учётные записи и устройства имеют собственные границы доступа."),
("Действия оставляют след","Для работы могут обрабатываться идентификаторы аккаунта и устройства, запросы и результаты разрешённых действий."),
("Полный документ","Актуальная англоязычная политика — по ссылке ниже. Перевод здесь носит справочный характер.")],"Документ","«Что происходит с моими данными?»","Прочитайте действующую политику конфиденциальности перед подключением."),
"en":("Your data.<br><em>Your boundaries.</em>","LUCH works within the access you approve. The complete current Privacy Policy is published separately; this is a clearer route to it.","The policy, not a slogan, defines the details.","Privacy Policy","What matters most",[
("Scoped access","Files, browser sessions, accounts and devices are subject to their own permissions."),
("Necessary processing","Work may involve account and device identifiers, authorized requests and action results."),
("Read the complete policy","The current effective Privacy Policy is available at the link below.")],"The document","“What happens to my data?”","Read the full effective Privacy Policy before connecting.")},
"terms":{
"ru":("Понятные условия.<br><em>Без мелкого шрифта.</em>","LUCH предоставляется с ограниченным доступом. Юридически значимые условия использования опубликованы отдельно; здесь — краткая навигация.","Это справочное описание, не замена действующих условий.","Полные условия","Главное перед использованием",[
("Ваши полномочия","Подключайте только те аккаунты, устройства и сервисы, которыми имеете право управлять."),
("Ограниченная доступность","Функции зависят от разрешений, клиента и состояния сервиса; общий открытый доступ не заявлен."),
("Действующие условия","Полный англоязычный документ приведён ниже. Перевод этой страницы справочный.")],"Документ","«Какие правила действуют?»","Откройте действующие условия использования."),
"en":("Clear terms.<br><em>Nothing hidden.</em>","LUCH is a limited-access service. The full effective Terms of Use are published separately; this page is a human-readable entry.","This summary doesn't replace the effective Terms.","Full terms","Before using LUCH",[
("Your authority","Only connect accounts, devices and services you have the right to control."),
("Limited access","Capabilities depend on permission, client and service availability. General public access is not claimed."),
("The legal document","Read the full current Terms of Use below.")],"The document","“What rules apply?”","Open the effective Terms of Use.")}
}
def logo(lang):return f'<a class="logo" href="/{lang}/" aria-label="LUCH"><img src="/assets/luch-ray.svg" alt="" width="30" height="30">LUCH<span class="dot">.</span></a>'
def head(lang,slug,title,desc,canonical=None):
 url=canonical or (f"/{lang}/"+(slug+"/" if slug else ""))
 hreflang=f'<link rel="alternate" hreflang="ru" href="{BRAND}/ru/{slug+"/" if slug else ""}"><link rel="alternate" hreflang="en" href="{BRAND}/en/{slug+"/" if slug else ""}">'
 return f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f9f7f1"><title>{escape(title)} — LUCH</title><meta name="description" content="{escape(desc,quote=True)}"><link rel="canonical" href="{BRAND}{url}">{hreflang}<link rel="icon" type="image/svg+xml" href="/assets/luch-ray.svg"><link rel="stylesheet" href="/assets/experience.css"><link rel="stylesheet" href="/assets/proof.css"><script defer src="/assets/experience.js"></script></head><body><a class="skip" href="#main">{LOC[lang]["skip"]}</a>'
def header(lang,slug=""):
 d=LOC[lang];links=[("work",f"/{lang}/#work"),("story",f"/{lang}/case/"),("tools",f"/{lang}/platform/")]
 menu=''.join(f'<a href="{u}">{d[k]}</a>' for k,u in links)
 action_href = f"/{lang}/status/" if slug=="connect" else (f"/{lang}/clients/" if slug=="status" else f"/{lang}/connect/")
 action_label = d["status"] if slug=="connect" else (("Выбрать ИИ" if lang=="ru" else "Choose AI") if slug=="status" else d["start"])
 return f'<header class="site-header"><div class="wrap header-inner">{logo(lang)}<nav class="main-nav" id="main-nav" data-main-nav aria-label="Main">{menu}</nav><div class="nav-actions"><a class="locale" href="/{d["lang"]}/{slug+"/" if slug else ""}" lang="{d["lang"]}">{d["switch"]}</a><a class="header-cta" href="{action_href}">{action_label} ↗</a><button data-menu-toggle class="nav-toggle" type="button" aria-label="Menu" aria-controls="main-nav" aria-expanded="false">☰</button></div></div></header>'
def footer(lang):
 d=LOC[lang];l=f"/{lang}/"
 return f'<footer class="site-footer"><div class="wrap"><div class="foot-head"><div>{logo(lang)}<p>{d["footer"]}</p></div><nav class="foot-nav"><a href="{l}platform/">{d["tools"]}</a><a href="{l}clients/">AI</a><a href="{l}connect/">{d["connect"]}</a><a href="{l}help/">{d["support"]}</a></nav></div><div class="foot-bottom"><span>© 2026 LUCH · {d["rights"]}</span><nav><a href="/privacy/">{d["privacy"]}</a><a href="/terms/">{d["terms"]}</a><a href="/security/">{d["safe"]}</a><a href="/support/">{d["support"]}</a><a href="{l}status/">{d["status"]}</a><a href="{GITHUB}">GitHub ↗</a></nav></div></div></footer></body></html>'
def cta(lang):
 ru=lang=="ru"
 title="Меньше переключений.<br><em>Больше жизни.</em>" if ru else "Less switching.<br><em>More living.</em>"
 info="Начните с одной понятной задачи. Если доступ к вашему аккаунту уже открыт, ИИ сможет использовать выбранные вами инструменты." if ru else "Start with one clear task. If your account is enabled, your AI can use the tools you choose."
 return f'<section class="cta-section"><div class="wrap cta-grid"><div><div class="eyebrow"><i></i>{LOC[lang]["next"]}</div><h2>{title}</h2><p>{info}</p></div><div class="cta-actions"><a class="button" href="/{lang}/connect/">{LOC[lang]["start"]} ↗</a><a class="button button-light" href="/{lang}/status/">{LOC[lang]["status"]} ↗</a></div></div></section>'
def home(lang):
 ru=lang=="ru";s=LOC[lang]
 if ru:
  t="Дело сдвинулось.<br><em>Это можно проверить.</em>"
  lead="Основатель попросил переделать сайт LUCH и не трогать Mac. ИИ работал через разрешённый сервер и GitHub: изучил сайт, подготовил новую версию, проверил и опубликовал её с разрешения. Коммит и результаты открыты."
  ask="«Переделай сайт LUCH для человека. Mac не трогай»"
  stages=[("Изучено","Живой сайт и исходники GitHub."),("Проверено","32 страницы × 4 размера экрана; дефект 320 px исправлен."),("Выпущено","С разрешения основателя; есть точный публичный коммит.")]
  end="Проверяемый результат. Не просто обещание."
  h2="От задачи<br><em>до ясного результата.</em>"
  subtitle="Вместо списка интеграций — знакомые ситуации. LUCH соединяет инструменты тогда, когда это нужно делу."
  rows=[("Разобраться","«Найди, почему после обновления страница изменилась».<br><a href='/ru/browser/'>Работа с сайтами ↗</a>"),("Собрать воедино","«Сверь материалы и подготовь новое письмо».<br><a href='/ru/computer/'>Файлы и компьютер ↗</a>"),("Двинуть проект","«Посмотри код, собери возможное исправление и покажи мне».<br><a href='/ru/platform/'>Инструменты разработки ↗</a>")]
  way="Вы остаётесь главным.<br><em>ИИ помогает действовать.</em>"
  values=[("Дело важнее инструмента","Не нужно запоминать, в каком приложении лежит следующий шаг."),("Доступ — ваш выбор","Разрешайте только нужное. Неиспользуемое остаётся закрытым."),("Не обещания, а результат","Где возможно, видно, что было сделано, а что осталось предложением.")]
  vignette="Не ещё один экран,<br><em>а немного свободы.</em>"
  vtext="Вы формулируете желаемое. ИИ помогает пройти путь через доступные инструменты. Вы возвращаетесь к тому, что действительно требует вашего внимания."
  result="Не «открыл десять вкладок». А «вот различия, вот источники, вот что стоит решить»."
  foot="Реальный случай из окружения основателя, а не проверка подключения нового пользователя."
 else:
  t="Work moved.<br><em>Here is the proof.</em>"
  lead="The founder asked to redesign LUCH without touching the Mac. The AI used permitted server and GitHub tools to inspect, revise, test and release the site with approval. You can inspect the commit and evidence."
  ask="“Redesign LUCH for people. Do not touch my Mac.”"
  stages=[("Inspected","The published website and GitHub source."),("Tested","32 pages × 4 widths; 320px overflow fixed."),("Released","With the founder’s authorization, linked to the exact commit.")]
  end="An inspectable result. Not a promise."
  h2="From intention<br><em>to a clear outcome.</em>"
  subtitle="Not a list of integrations, but situations you recognize. LUCH connects tools when the work calls for them."
  rows=[("Understand","“Find why the page changed after an update.”<br><a href='/en/browser/'>Working on the web ↗</a>"),("Bring it together","“Use these materials to prepare a better document.”<br><a href='/en/computer/'>Files and computers ↗</a>"),("Move the project","“Look at the code, suggest a fix and bring it back to me.”<br><a href='/en/platform/'>Development tools ↗</a>")]
  way="You stay in charge.<br><em>AI helps move.</em>"
  values=[("The work comes first","You shouldn't have to memorize where the next step lives."),("Access is your choice","Approve what's needed. Keep everything else closed."),("An outcome, not a promise","Where supported, see what happened and what is only a suggestion.")]
  vignette="Not another screen.<br><em>A little freedom.</em>"
  vtext="Describe what you want. Your AI follows the available, permitted path across tools. You come back when your judgment matters."
  result="Not “I opened ten tabs.” But “Here are the differences, the sources and what needs your decision.”"
  foot="A real founder-environment case, not an independent new-customer onboarding test."
 steps=''.join(f'<div class="taskline"><span class="sign">✓</span><div><strong>{a}</strong><p>{b}</p></div></div>' for a,b in stages)
 story=''.join(f'<div class="storyrow"><span class="story-index">0{i}</span><h3>{a}</h3><p>{b}</p></div>' for i,(a,b) in enumerate(rows,1))
 v3=''.join(f'<article><span class="why-number">0{i}</span><h3>{a}</h3><p>{b}</p></article>' for i,(a,b) in enumerate(values,1))
 sample="РЕАЛЬНЫЙ СЛУЧАЙ" if ru else "REAL WORK / FOUNDER"
 note="Есть исходники" if ru else "See source"
 html=f'{head(lang,"","ЛУЧ — жизнь без лишних шагов" if ru else "LUCH — work that moves",lead)}{header(lang)}'
 html+=f'<main id="main"><section class="hero"><div class="wrap hero-grid"><div><div class="eyebrow"><i></i>{"ИИ, который может работать с миром" if ru else "AI that can work across your world"}</div><h1>{t}</h1><p class="hero-lead">{lead}</p><div class="hero-actions"><a class="button" href="/{lang}/case/">{"Посмотреть реальные действия" if ru else "See the actual work"} ↗</a><a class="button button-light" href="/{lang}/connect/">{s["start"]} ↗</a></div><p class="hero-micro">{foot}</p></div><div class="hero-art-wrap"><div class="experience"><div class="experience-top"><span>LUCH / {sample}</span><b>✳</b></div><div class="experience-body"><div class="message-label">{"Основатель попросил" if ru else "The founder asked"}</div><p class="human-ask">{ask}</p>{steps}<div class="handoff"><div><strong>{end}</strong><br><small>{"Коммит и проверка доступны" if ru else "Commit and checks are public"}</small></div><span class="decision">{note}</span></div></div></div><span class="experience-caption">{"Реальный собственный случай. Подробнее — по ссылке слева." if ru else "A real first-party case. Follow the link on the left for evidence."}</span></div></div></section>'
 html+=f'<section id="stories" class="section sage"><div class="wrap"><div class="section-top"><div class="eyebrow"><i></i>{s["story"]}</div><div><h2>{h2}</h2><p class="section-intro">{subtitle}</p></div></div><div class="storylist">{story}</div></div></section>'
 html+=f'<section id="work" class="section dark"><div class="wrap"><div class="section-top"><div class="eyebrow"><i></i>{s["work"]}</div><div><h2>{way}</h2><p class="section-intro">{"LUCH создаётся не для того, чтобы впечатлять количеством кнопок. Он освобождает человека от необходимости управлять каждым техническим шагом." if ru else "LUCH is not here to impress you with more buttons. It is here to spare you from managing every technical step."}</p></div></div><div class="three-up">{v3}</div></div></section>'
 html+=f'<section class="section light"><div class="wrap"><div class="showcase"><div class="showcase-left"><div class="eyebrow"><i></i>LUCH</div><h3>{vignette}</h3><p>{vtext}</p><a class="button" href="/{lang}/platform/">{s["tools"]} ↗</a></div><div class="showcase-right"><div class="outcome-note"><strong>{"Возможный другой сценарий" if ru else "Another possible workflow"}</strong><p>“{result}”</p><small>{s["example"]}</small></div></div></div></div></section>'
 html+=f'<section class="proof-next"><div class="wrap"><p>{"Разбор реальной работы: действия, исходники и ограничения" if ru else "The real trail: work, source and limitations"}</p><a class="button" href="/{lang}/case/">{"Открыть настоящий случай" if ru else "Open the real case"} ↗</a></div></section>'
 return html+cta(lang)+'</main>'+footer(lang)
def subpage(lang,slug):
 if slug in ("connect","clients","platform","status"):return human_render(lang,slug,head,header,footer,cta)
 d=LOC[lang];title,lead,aside,feature,sectiontitle,rows,exlabel,example,outcome=PAGE[slug][lang];ru=lang=="ru"
 summary=escape(re.sub('<[^>]*>','',title.replace('<br>',' '))+'. '+lead[:130],quote=True)
 more=f"/privacy/" if slug=="privacy" else "/terms/" if slug=="terms" else "/docs/get-started/"
 if slug=="privacy" or slug=="terms": featurehref=more
 elif slug=="clients":featurehref=LINKS["chatgpt"]
 elif slug=="agents":featurehref=f"/{lang}/free/"
 elif slug=="help":featurehref="/support/"
 else:featurehref=f"/{lang}/connect/"
 items=''.join(f'<div class="detail-item"><span class="number">{i:02}</span><h3>{a}</h3><p>{b}</p></div>' for i,(a,b) in enumerate(rows,1))
 html=head(lang,slug,re.sub('<[^>]*>','',title.replace('<br>',' ')),summary)+header(lang,slug)
 html+=f'<main id="main"><section class="page-hero"><div class="wrap"><div><div class="eyebrow"><i></i>LUCH / {slug.upper()}</div><h1 class="page-h1">{title}</h1><p class="page-intro">{lead}</p><div class="hero-actions"><a class="button" href="#details">{"Посмотреть подробнее" if ru else "Explore details"} ↗</a></div></div><aside class="page-aside"><strong>{"Важная мысль" if ru else "The essential point"}</strong>{aside}</aside></div></section>'
 html+=f'<section class="feature-band"><div class="wrap"><h2>{feature}</h2><div><p>{outcome}</p><p><a href="{featurehref}">{d["read"]} ↗</a></p></div></div></section>'
 html+=f'<section class="details" id="details"><div class="wrap"><h2>{sectiontitle}</h2><div class="detail-list">{items}</div>'
 if slug=="clients":
  links=' · '.join(f'<a href="{u}">{n} ↗</a>' for n,u in [("ChatGPT",LINKS["chatgpt"]),("Claude",LINKS["claude"]),("Cursor",LINKS["cursor"]),("Gemini CLI",LINKS["gemini"]),("Kimi",LINKS["kimi"])])
  html+=f'<div class="soft-note"><strong>{"Исходный код интеграций" if ru else "Integration source"}:</strong> {links}. {"Публикация кода не означает открытый доступ для всех." if ru else "Published code does not imply open access for everyone."}</div>'
 if slug in ("privacy","terms"):
  html+=f'<div class="soft-note"><strong>{"Действующий документ" if ru else "Effective document"}:</strong> <a href="{more}">{("Политика конфиденциальности" if slug=="privacy" else "Условия использования") if ru else ("Privacy Policy" if slug=="privacy" else "Terms of Use")} ↗</a>. {"Эта страница — справочное изложение, не замена юридическому тексту." if ru else "This summary does not replace the complete policy."}</div>'
 if slug=="connect":
  html+=f'<div class="soft-note"><strong>LUCH Public Core</strong> · {"Для поддерживаемых MCP-клиентов и разрешённых аккаунтов:" if ru else "For enabled accounts on supported MCP hosts:"} <a href="/docs/get-started/">{"Техническое руководство" if ru else "Technical getting-started guide"} ↗</a>.</div>'
 if slug=="status":
  html+=f'<div class="soft-note">{"Этот раздел описывает подтверждённые классы возможностей; он не является проверкой работоспособности в текущую секунду." if ru else "This describes capability classes, not a live check of service uptime at this exact moment."}</div>'
 if slug=="agents":
  html+=f'<div class="soft-note">{"Управляемые агенты сейчас не продаются. Нет тарифов и кнопки покупки." if ru else "Managed Agents are not for sale now. There are no public plans or checkout."}</div>'
 html+='</div></section>'
 html+=f'<section class="section light"><div class="wrap"><div class="showcase"><div class="showcase-left"><div class="eyebrow"><i></i>{exlabel}</div><h3>{example}</h3><p>{outcome}</p></div><div class="showcase-right"><div class="outcome-note"><strong>{"То, ради чего всё" if ru else "The human outcome"}</strong><p>{outcome}</p><small>{d["example"]}</small></div></div></div></div></section>'
 if slug=="help":
  faqs=[("Как сообщить о проблеме?" if ru else "How do I report an issue?","Через GitHub Issues, без секретов и личных данных." if ru else "Use GitHub Issues, without secrets or personal data."),("Где полное руководство?" if ru else "Where is the technical guide?","В разделе подключения; он предназначен для поддерживаемых MCP-клиентов." if ru else "In the connection section, for supported MCP clients.")]
  html+=f'<section class="faq"><div class="wrap"><h2>{"Ещё два вопроса" if ru else "Two more questions"}</h2>'+''.join(f'<details><summary>{q}</summary><p>{a}</p></details>' for q,a in faqs)+'</div></section>'
 return html+cta(lang)+'</main>'+footer(lang)
def legacy(lang,slug,content):
 if 'class="legacy"' in content and 'experience.css' in content: return content
 src=re.search(r'<main[^>]*>(.*?)</main>',content,re.S|re.I)
 if not src: raise RuntimeError('No legacy main: '+slug)
 body=src.group(1)
 titles={"privacy":"Privacy Policy","terms":"Terms of Use","security":"Security","support":"Support","docs/get-started":"Getting Started"}
 title=titles[slug]
 # Preserve existing effective policy and technical instructions verbatim inside main.
 return head(lang,slug,title,"LUCH "+title,canonical="/"+slug+"/")+header(lang)+f'<main id="main" class="legacy"><div class="wrap">{body}</div></main>'+footer(lang)
def write(rel,content):
 f=P/rel;f.parent.mkdir(parents=True,exist_ok=True);f.write_text(content,encoding="utf-8")
def main():
 original={}
 for slug in ["privacy","terms","security","support","docs/get-started"]:
  original[slug]=(P/slug/"index.html").read_text(encoding="utf-8")
 for l in ("en","ru"):
  write(f"{l}/index.html",home(l))
  for slug in PAGE:write(f"{l}/{slug}/index.html",subpage(l,slug))
  write(f"{l}/case/index.html",human_render(l,"case",head,header,footer,cta))
 write("index.html",home("en").replace(f'<link rel="canonical" href="{BRAND}/en/">',f'<link rel="canonical" href="{BRAND}/">'))
 for slug,raw in original.items():write(f"{slug}/index.html",legacy("en",slug,raw))
 urls=["/","/en/","/ru/"]+[f"/{l}/{k}/" for l in ("en","ru") for k in PAGE]+[f"/{l}/case/" for l in ("en","ru")]+[f"/{k}/" for k in original]
 write("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'<url><loc>{BRAND}{u}</loc></url>\n' for u in urls)+'</urlset>\n')
 files=sorted([f for f in P.rglob("*") if f.is_file() and f.name!="MANIFEST.sha256" and ".git" not in f.parts and "__pycache__" not in f.parts and f.suffix!=".pyc"])
 write("MANIFEST.sha256",''.join(f'{hashlib.sha256(f.read_bytes()).hexdigest()}  {f.relative_to(P)}\n' for f in files))
 print("ROUTES",len(urls),"SOURCE_FILES",len(files))
if __name__=="__main__":main()
