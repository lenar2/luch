"""Human Experience / distinct page compositions, evidence first, bilingual."""
from html import escape

CASE_COMMIT="https://github.com/lenar2/luch/commit/06daa8d6b89a3dfd65e74628b895879e79a0c931"
CASE_RELEASE="https://github.com/lenar2/ai-factory-evidence/issues/4009#issuecomment-6692683064"
CASE_AUDIT="https://github.com/lenar2/ai-factory-evidence/issues/4009#issuecomment-6705944671"
HOSTS=[
 ("ChatGPT","https://github.com/lenar2/luch-claude-plugin/tree/main/integrations/chatgpt/"),
 ("Claude","https://github.com/lenar2/luch-claude-plugin/"),
 ("Cursor","https://github.com/lenar2/luch-cursor/"),
 ("Gemini CLI","https://github.com/lenar2/luch-gemini/"),
]
WORDS={
 "ru":{
  "case":("Реальная задача.<br><em>Проверяемый след.</em>","Мы начали не с описания функций, а с просьбы человека: переделать чрезмерно технический сайт LUCH и не трогать его Mac. Ниже — что действительно сделано, что можно проверить и чего этот случай не доказывает.","Это собственный случай LUCH, не отзыв клиента."),
  "connect":("Начните там,<br><em>где уже работает ваш ИИ.</em>","Прежде чем устанавливать что-либо, важно понять две вещи: доступен ли LUCH вашему аккаунту и какой ИИ вы используете.","Нет универсальной кнопки регистрации, которая гарантированно работает для всех."),
  "clients":("Одна задача.<br><em>Разные способы начать.</em>","LUCH — самостоятельный продукт. Интеграции для разных ИИ-клиентов не одинаковы по установке, подтверждённому доступу и готовности.","Открытый код — не действующий доступ."),
  "platform":("Не список возможностей.<br><em>Путь к результату.</em>","От вашей задачи к информации, материалам и изменениям — через те инструменты, к которым вы явно разрешили доступ.","Инструмент не выбирает полномочия за вас."),
  "status":("Что работает.<br><em>А что ещё нет.</em>","Здесь разделены фактически показанные возможности, действия с дополнительными условиями и неподтверждённый доступ для нового пользователя.","Не мониторинг доступности в текущую секунду."),
  "caseLabel":"СОБСТВЕННЫЙ ПОДТВЕРЖДЁННЫЙ СЛУЧАЙ",
  "human":"СМЫСЛ ЗАПРОСА · НЕ ДОСЛОВНАЯ ЦИТАТА",
  "asked":"«Переделай сайт LUCH для человека. Mac не трогай — там устанавливается Xcode».",
  "owner":"Работа в окружении основателя · ноябрь 2026",
  "fact":"Факт, который можно открыть",
  "steps":[
   ("01","Разобраться в настоящей проблеме","Открыты опубликованный LUCH и исходники GitHub. Запрос касался человеческого опыта, а не количества компонентов."),
   ("02","Подготовить отдельно от публикации","Переработаны русские и английские страницы в рабочей ветке, без взаимодействия с Mac."),
   ("03","Проверить и исправить","32 страницы проверены на четырёх размерах экрана; найден и исправлен горизонтальный выход за границы на 320 px."),
   ("04","Выпустить с разрешения","После согласия основателя обновлены GitHub и сайт, сохранена резервная копия. Публичный коммит и запись о выпуске доступны."),
   ("05","Остаться критичным","Позднейший самоаудит обнаружил слабый путь подключения и недостаточно убедительный первый экран. Это повод переделывать, а не скрывать ошибку.")
  ],
  "whatproved":"Что этот случай доказывает",
  "proved":"Реальный переход от человеческого запроса к выполненным действиям на разрешённом сервере и в GitHub — с проверяемой публикацией и без касания Mac.",
  "whatnot":"Чего он не доказывает",
  "notproved":"Самостоятельное подключение нового клиента, поддержку всех ИИ-хостов, независимую сертификацию безопасности или окончательное совершенство выпущенного дизайна.",
  "evidence":"Открыть публичный коммит",
  "release":"Запись о выпуске и проверках",
  "audit":"Честный самоаудит",
  "guide":"Выбрать путь подключения",
  "enabled":"У меня уже есть разрешённый аккаунт",
  "enabledDetail":"Выберите ИИ-клиент, подключите только необходимый ресурс и начните с запроса без записи.",
  "choose":"Выбрать мой ИИ",
  "notenabled":"Я пока не знаю, доступен ли мне LUCH",
  "notenabledDetail":"Открытый исходный код не создаёт аккаунт. Самостоятельный путь нового пользователя ещё не подтверждён.",
  "availability":"Посмотреть подтверждённый статус",
  "chooseHeader":"Один ИИ-клиент. Один понятный первый шаг.",
  "first":"Первый безопасный запрос",
  "firstTask":"«Прочитай эту публичную страницу и дай короткое резюме с ссылкой». Сначала проверьте фактический результат.",
  "notes":"Не отправляйте пароли в чат, не подменяйте отключённое устройство другим и отдельно подтверждайте публикацию, удаление или покупки.",
  "host":[
   ("ChatGPT","Кандидат публичной интеграции","Частная интеграция основателя работает; публичное включение нового пользователя и каталог OpenAI не подтверждены.","Изучить пакет ChatGPT"),
   ("Claude","Открытый исходный код адаптера","Требуются поддерживаемый способ подключения и разрешённый аккаунт; статус каталога проверяется отдельно.","Открыть адаптер Claude"),
   ("Cursor","Локальный плагин и OAuth","Есть инструкция для Cursor; вход нового независимого пользователя ещё требует проверки.","Открыть инструкцию Cursor"),
   ("Gemini CLI","Расширение командной строки","Есть команды установки; независимый полный OAuth-сценарий пока не подтверждён.","Открыть расширение Gemini")
  ],
  "hostsInfo":"Подключение зависит от клиента и вашего аккаунта. Наличие кода не обещает рабочий вход.",
  "different":"Что действительно различается между интеграциями",
  "differentDetails":[
   ("01","Среда работы","ChatGPT — разговор, Claude — помощник, Cursor — редактор, Gemini CLI — терминал. LUCH не заменяет эти интерфейсы."),
   ("02","Путь установки","Публикация в каталоге, локальный плагин, CLI-расширение и персональная интеграция — не одно и то же."),
   ("03","Разрешения","Даже при наличии клиента LUCH видит только те инструменты и устройства, которые разрешены вашему аккаунту.")
  ],
  "platformHeader":"Три типа работы, а не десятки отдельных кнопок",
  "lanes":[
   ("01","Понять","Откройте разрешённый сайт или информацию.","Узнайте, что источник действительно говорит, и где есть различия.","Изолированный браузер или согласованная сессия."),
   ("02","Подготовить","Найдите свои материалы и предложите изменение.","Получите черновик, сверку или конкретную правку.","Только доступные файлы, заметки и устройства."),
   ("03","Сделать проверяемое","Разберите проблему сайта, кода или выбранного сервера.","Вернитесь с диагностикой и изменением, которое можно осмотреть.","Уполномоченный GitHub/сервер; публикация отдельно.")
  ],
  "reality":"Реальный пример одного пути",
  "levels":[
   ("ПОКАЗАНО В ОКРУЖЕНИИ ОСНОВАТЕЛЯ","Изолированный браузер, разрешённые команды на выбранном сервере и работа с GitHub применялись в настоящих задачах. Доказательство одного выпуска — в открытом кейсе.","proved"),
   ("ЗАВИСИТ ОТ УСЛОВИЙ","Файлы, управление Mac, заметки, личные сайты и сервисы требуют соответствующего устройства, аккаунта и разрешений.","conditional"),
   ("НЕ ПОДТВЕРЖДЕНО ДЛЯ ВСЕХ","Самостоятельная регистрация нового пользователя, полный OAuth E2E, доступ ко всем устройствам, нативное управление iPhone и платные управляемые агенты.","unknown")
  ],
  "why":"Почему это важно",
  "whytext":"Надпись «подключено» и сообщение о принятии запроса ещё не означают выполненную работу. Важно различать результат, предложенную правку и отсутствие доступа.",
  "back":"Вернуться к LUCH"
 },
 "en":{
  "case":("A real request.<br><em>An inspectable trail.</em>","We began with a person's problem: LUCH felt like an engineering manual, and the Mac had to remain untouched. Here is what actually happened, what can be checked and what this case cannot prove.","An openly self-referential product case, not a customer testimonial."),
  "connect":("Start with the AI<br><em>you already use.</em>","Before installing anything, answer two questions: is LUCH enabled for your account, and which AI host do you use?","There is no verified one-click signup for every visitor."),
  "clients":("One outcome.<br><em>Different ways in.</em>","LUCH is independent of any particular AI. Host adapters have different installation paths, availability and evidence of readiness.","Open source is not an access grant."),
  "platform":("Not a tool list.<br><em>A path to an outcome.</em>","From your request to information, materials and potential changes, using only tools you have explicitly allowed.","Tools do not choose authority for you."),
  "status":("What works.<br><em>And what doesn't yet.</em>","Separate capabilities observed in an authorized environment, features requiring a connected device and unverified fresh-user access.","A capability record, not a live uptime monitor."),
  "caseLabel":"A REAL FIRST-PARTY CASE",
  "human":"THE REQUEST · PARAPHRASED",
  "asked":"“Redesign LUCH for human beings. Don't touch my Mac — Xcode is being installed.”",
  "owner":"Founder-authorized environment · November 2026",
  "fact":"Something you can inspect",
  "steps":[
   ("01","Understand the real problem","The published LUCH site and GitHub source were inspected. The request was about human experience, not how many components existed."),
   ("02","Prepare before publishing","English and Russian pages were redesigned on a separate branch, without using the Mac."),
   ("03","Test and correct","32 pages were checked at four viewport widths. Horizontal overflow on a 320px display was detected and fixed."),
   ("04","Release with permission","After the founder authorized release, GitHub and the live site were updated, with a backup. The public commit and release record are available."),
   ("05","Keep the critical eye","A later self-audit identified weak onboarding and an unconvincing hero. That is a reason to improve the work, not conceal its limits.")
  ],
  "whatproved":"What this case proves",
  "proved":"An actual chain from a human request to permitted server and GitHub work, ending in an inspectable publication, with the Mac excluded.",
  "whatnot":"What it does not prove",
  "notproved":"Self-service onboarding of a new customer, every AI host working equally, independent security certification or final design excellence.",
  "evidence":"Inspect the public commit",
  "release":"Release checks and record",
  "audit":"Read the critical self-audit",
  "guide":"Find your connection path",
  "enabled":"I already have an enabled account",
  "enabledDetail":"Choose your AI, connect only the resource needed and start with a read-only request.",
  "choose":"Choose my AI",
  "notenabled":"I don't know if I can use LUCH yet",
  "notenabledDetail":"Public source does not create an account. Independent fresh-user onboarding has not yet been verified.",
  "availability":"Check the actual status",
  "chooseHeader":"One host. One understandable next step.",
  "first":"A safe first request",
  "firstTask":"“Read this public page and summarize it with a source link.” Inspect the actual result before granting more access.",
  "notes":"Never paste passwords into chat, substitute an unavailable device, or let publication, deletion or purchases happen without specific approval.",
  "host":[
   ("ChatGPT","Public integration candidate","Founder private integration works; independent new-user onboarding and OpenAI Directory approval are unverified.","See ChatGPT candidate"),
   ("Claude","Published adapter source","Requires a supported host connection and enabled account; catalog approval is a separate check.","Explore Claude adapter"),
   ("Cursor","Local plugin with OAuth","Installation instructions exist; independent fresh-user sign-in still needs verification.","See Cursor installation"),
   ("Gemini CLI","Command-line extension","Install commands exist; independent full OAuth flow is not yet proven.","Explore Gemini extension")
  ],
  "hostsInfo":"Connection depends on your host and account. Source code is not proof of authorized access.",
  "different":"What actually differs between clients",
  "differentDetails":[
   ("01","Where you work","ChatGPT is a conversation, Claude an assistant, Cursor an editor and Gemini CLI a terminal. LUCH does not replace them."),
   ("02","Installation and approval","Directory publication, local plugins, CLI extensions and private installations are different things."),
   ("03","Your permission scope","Even with a client installed, LUCH can only reach what is authorized for your account.")
  ],
  "platformHeader":"Three kinds of work, not dozens of buttons",
  "lanes":[
   ("01","Understand","Open an approved page or information source.","See what it actually says and where details differ.","Isolated browser or specifically approved session."),
   ("02","Prepare","Find permitted materials and suggest a change.","Return with a draft, comparison or concrete proposed edit.","Only the files, notes and devices you authorize."),
   ("03","Make work inspectable","Investigate a website, codebase or selected server.","Bring back diagnostics and a reviewable change.","Approved GitHub/server access; publishing is separate.")
  ],
  "reality":"A real example of the path",
  "levels":[
   ("OBSERVED IN THE FOUNDER'S ENVIRONMENT","Isolated browser sessions, permitted server commands and GitHub work were used for real tasks. One release is documented in the public case.","proved"),
   ("DEPENDS ON CONNECTION","Files, Mac control, notes, personal sites and other services depend on paired devices, accounts and grants.","conditional"),
   ("NOT VERIFIED FOR EVERYONE","Open fresh-user enrollment, complete OAuth E2E, every device type, native full iPhone control and managed agents as a paid service.","unknown")
  ],
  "why":"Why the distinction matters",
  "whytext":"A receipt that a request was accepted is not a completed action. Results, proposals and unavailable access must remain distinguishable.",
  "back":"Back to LUCH"
 }
}
def a(label,href,kind="button"):
 return f'<a class="{kind}" href="{href}">{label} <span aria-hidden="true">↗</span></a>'
def eyebrow(label):
 return f'<div class="eyebrow"><i></i>{escape(label)}</div>'
def intro(lang,slug):
 d=WORDS[lang];title,lead,sub=d[slug]
 return f'<section class="proof-hero {"proof-hero-connect" if slug=="connect" else ""}"><div class="wrap proof-hero-grid"><div>{eyebrow("LUCH / "+slug.upper())}<h1>{title}</h1><p class="proof-lead">{lead}</p></div><aside class="proof-hero-aside"><span class="proof-aside-label">LUCH / 2026</span><p>{sub}</p></aside></div></section>'
def frame(lang,slug,body,head,header,footer,cta):
 d=WORDS[lang];title,lead,_=d[slug];clean=title.replace("<br>"," ").replace("<em>","").replace("</em>","")
 return head(lang,slug,clean,lead[:160])+header(lang,slug)+'<main id="main">'+body+cta(lang)+'</main>'+footer(lang)
def case(lang,head,header,footer,cta):
 d=WORDS[lang];body=intro(lang,"case")
 body+=f'<section class="case-intent"><div class="wrap case-intent-grid"><div><div class="proof-small">{d["human"]}</div><blockquote>{d["asked"]}</blockquote><p>{d["owner"]}</p></div><div class="case-stamp"><span>LUCH / REAL WORK</span><strong>32</strong><small>pages / routes</small><strong>04</strong><small>viewport widths</small><p>{d["fact"]}</p></div></div></section>'
 body+='<section class="case-timeline"><div class="wrap"><div class="proof-heading"><span>01 — 05</span><h2>'+("От желания к выполненному делу" if lang=="ru" else "From intention to completed work")+'</h2></div><div class="case-steps">'
 for number,title,detail in d["steps"]:
  body+=f'<article><span class="case-number">{number}</span><h3>{title}</h3><p>{detail}</p></article>'
 body+='</div><div class="case-receipts">'+a(d["evidence"],CASE_COMMIT)+a(d["release"],CASE_RELEASE,"button button-light")+a(d["audit"],CASE_AUDIT,"proof-link")+'</div></div></section>'
 body+=f'<section class="case-boundaries"><div class="wrap boundary-pair"><article><h2>{d["whatproved"]}</h2><p>{d["proved"]}</p></article><article><h2>{d["whatnot"]}</h2><p>{d["notproved"]}</p></article></div></section>'
 body+=f'<section class="proof-next"><div class="wrap"><p>{d["owner"]}</p>{a(d["guide"],f"/{lang}/connect/")}</div></section>'
 return frame(lang,"case",body,head,header,footer,cta)
def connect(lang,head,header,footer,cta):
 d=WORDS[lang];body=intro(lang,"connect")
 body+='<section class="connection-choice"><div class="wrap connection-split">'
 body+=f'<article class="connection-yes"><span>01 / {"READY" if lang=="en" else "ДОСТУП ЕСТЬ"}</span><h2>{d["enabled"]}</h2><p>{d["enabledDetail"]}</p>{a(d["choose"],"#host-choices")}</article>'
 body+=f'<article class="connection-no"><span>02 / {"CHECK FIRST" if lang=="en" else "СНАЧАЛА ПРОВЕРИТЬ"}</span><h2>{d["notenabled"]}</h2><p>{d["notenabledDetail"]}</p>{a(d["availability"],f"/{lang}/status/","button button-light")}</article>'
 body+='</div></section>'
 body+=f'<section class="host-select" id="host-choices"><div class="wrap"><div class="proof-heading"><span>LUCH / AI</span><h2>{d["chooseHeader"]}</h2><p>{d["hostsInfo"]}</p></div><div class="host-grid">'
 for i,((name,url),(nm,status,detail,act)) in enumerate(zip(HOSTS,d["host"]),1):
  body+=f'<article class="host-card"><span>0{i} / {escape(name)}</span><h3>{nm}</h3><p class="host-status">{status}</p><p>{detail}</p><a href="{url}">{act} ↗</a></article>'
 body+='</div></div></section>'
 body+=f'<section class="first-task"><div class="wrap first-task-inner"><div>{eyebrow(d["first"])}<h2>{d["firstTask"]}</h2></div><p>{d["notes"]}</p></div></section>'
 return frame(lang,"connect",body,head,header,footer,cta)
def clients(lang,head,header,footer,cta):
 d=WORDS[lang];body=intro(lang,"clients")
 body+=f'<section class="client-ledger"><div class="wrap"><div class="proof-heading"><span>01 / 04</span><h2>{d["chooseHeader"]}</h2></div><div class="client-rows">'
 for i,((name,url),(nm,status,detail,act)) in enumerate(zip(HOSTS,d["host"]),1):
  body+=f'<article class="client-row"><span>0{i}</span><h3>{name}</h3><div><strong>{nm}</strong><p>{detail}</p><small>{status}</small></div><a href="{url}">{act} ↗</a></article>'
 body+='</div></div></section>'
 body+=f'<section class="client-differences"><div class="wrap"><h2>{d["different"]}</h2><div class="client-diff-grid">'
 for num,title,description in d["differentDetails"]:
  body+=f'<article><span>{num}</span><h3>{title}</h3><p>{description}</p></article>'
 body+='</div></div></section>'
 body+=f'<section class="proof-next"><div class="wrap"><p>{d["hostsInfo"]}</p>{a(d["guide"],f"/{lang}/connect/")}</div></section>'
 return frame(lang,"clients",body,head,header,footer,cta)
def platform(lang,head,header,footer,cta):
 d=WORDS[lang];body=intro(lang,"platform")
 body+=f'<section class="work-lanes"><div class="wrap"><div class="proof-heading"><span>01 / 03</span><h2>{d["platformHeader"]}</h2></div>'
 for num,title,request,outcome,boundary in d["lanes"]:
  body+=f'<article class="work-lane"><span class="lane-number">{num}</span><h3>{title}</h3><div><div class="proof-small">{"ЗАПРОС" if lang=="ru" else "REQUEST"}</div><p>{request}</p></div><div><div class="proof-small">{"РЕЗУЛЬТАТ" if lang=="ru" else "OUTCOME"}</div><p>{outcome}</p></div><small>{boundary}</small></article>'
 body+='</div></section>'
 body+=f'<section class="platform-case"><div class="wrap"><div><span>LUCH / DOCUMENTED</span><h2>{d["reality"]}</h2><p>{d["proved"]}</p></div><div>{a(d["release"],f"/{lang}/case/")}{a(d["guide"],f"/{lang}/connect/","button button-light")}</div></div></section>'
 return frame(lang,"platform",body,head,header,footer,cta)
def status(lang,head,header,footer,cta):
 d=WORDS[lang];body=intro(lang,"status")
 body+='<section class="status-matrix"><div class="wrap">'
 for title,detail,statusclass in d["levels"]:
  body+=f'<article class="status-row {statusclass}"><div class="status-marker" aria-hidden="true"></div><div><span>{title}</span><p>{detail}</p></div></article>'
 body+='</div></section>'
 body+=f'<section class="status-why"><div class="wrap"><div>{eyebrow("LUCH / TRUST")}<h2>{d["why"]}</h2></div><p>{d["whytext"]}</p></div></section>'
 body+=f'<section class="proof-next"><div class="wrap"><p>{d["notenabledDetail"]}</p>{a(d["guide"],f"/{lang}/connect/")}{a(d["release"],f"/{lang}/case/","button button-light")}</div></section>'
 return frame(lang,"status",body,head,header,footer,cta)
SPECIALS={"case":case,"connect":connect,"clients":clients,"platform":platform,"status":status}
def render(lang,slug,head,header,footer,cta):
 return SPECIALS[slug](lang,head,header,footer,cta)
