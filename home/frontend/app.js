'use strict';
/* LUCH Home R7 — browser UI for a real account-scoped, read-only website workflow.
 * No AI inference, no mock tool results, no private conversation URL, no paid API.
 */
(()=>{
const RU={
skip:'Перейти к содержимому',yourWorkspace:'ВАШЕ ПРОСТРАНСТВО',overview:'Обзор',
websiteCheck:'Проверка сайта',permissions:'Разрешения',activity:'История',assistants:'Помощники',
soon:'Скоро',controlLabel:'Ваш выбор. Ваши разрешения. Проверяемые результаты.',
backSite:'← На сайт LUCH',signOut:'Выйти',
heroEyebrow:'LUCH HOME · ВАШЕ ПРОСТРАНСТВО',heroOne:'Ваш ИИ.',
heroTwo:'Ваша работа.',
heroLead:'Одно пространство для помощников, задач, инструментов и проверяемых результатов. Подключайте привычный ИИ через LUCH Core и используйте доступные инструменты Home.',
guestSiteLabel:'Какой сайт хотите проверить?',guestContinue:'Продолжить',
guestIntentExplainer:'Сначала выберите сайт. Затем войдите или создайте пространство и разрешите проверку только для чтения. Пока запрос не выполняется.',
taskNow:'ДОСТУПНО СЕЙЧАС',taskCheckTitle:'Проверить публичный сайт',
taskCheckDesc:'Поймите результат проверки, получите конкретные следующие шаги и сохраните отчёт для разработчика.',
taskLater:'НЕ ПОДКЛЮЧЕНО',taskAiTitle:'Поручить задачу ИИ',
taskAiDesc:'Agent 001 ранее отвечал через ChatGPT в закрытом тесте. Личный чат и SO 6.2 не подключены к публичному Home.',
platformNav:'ПЛАТФОРМА LUCH',openWorkspace:'Открыть пространство',connectExisting:'Подключить свой ИИ ↗',quickWebsite:'Проверить публичный сайт',
workspacePreview:'ВАШЕ ПРОСТРАНСТВО',agentPrivateProof:'Ранее проверено в закрытом тесте',agentPrivateExplanation:'В предыдущем закрытом тесте помощник получил настоящий ответ ChatGPT. Этот личный маршрут недоступен в публичном пространстве. Ответы не имитируются.',
agentLearn:'О помощниках ↗',workspacePermission:'Ваши разрешения и действия',workspaceHistory:'Ваши сохранённые результаты',
openAssistants:'Открыть помощников ↗',agentUnavailable:'Чтобы отправлять сообщения, требуется личное подключение модели. Частная беседа владельца не передаётся публичным аккаунтам.',
agentMessage:'Сообщение помощнику',agentSend:'Отправить',agentUnavailableShort:'Отправка выключена до личного подключения.',
agentConnections:'ПОДКЛЮЧЕНИЯ И РАЗРЕШЕНИЯ',agentCoreDescription:'Совместимые ИИ-клиенты можно подключить отдельно через Core со своей авторизацией. Чат Home при этом не подключается автоматически.',soPlanned:'Подключение модели запланировано. Не подключена.',
previousSite:'Сейчас разрешён:',replaceGrantNote:'Разрешение на другой сайт заменит текущее. Запрос начнётся только после нажатия кнопки проверки.',
keepGrant:'Оставить текущий сайт',chooseOtherSite:'Выбрать другой сайт',
historyNotice:'Сохранённые наблюдения относятся к прошлым проверкам, а не к текущему состоянию сайта. Они доступны и после отзыва разрешения.',
historyEvents:'Журнал действий',
attemptHistory:'Ниже — наблюдение предыдущей проверки. Оно не подтверждает успех последней попытки.',
diagnosisEyebrow:'ЧТО ЭТО ЗНАЧИТ ДЛЯ ВАС',nextSteps:'Что делать дальше',
rulesDisclosure:'Вывод основан на сохранённом HTTPS-ответе и явных правилах, а не на ИИ. На сайте ничего не изменено.',
handoffLabel:'Подготовить отчёт для разработчика',handoffIntro:'Скопируйте или выделите отчёт. LUCH никуда его не отправляет.',
copyReport:'Скопировать отчёт',technicalDetails:'Технические доказательства',
samplePreviewLabel:'ЧТО ПОКАЖЕТ ПРОВЕРКА',sampleExampleTag:'ИЛЛЮСТРАТИВНЫЙ ПРИМЕР',
samplePreviewCaption:'Главная страница ответила на запрос. Далее откройте её на телефоне и проверьте важный сценарий клиента. Это пример, а не текущая проверка.',
sampleMetric1:'ОТВЕТ',sampleMetric2:'ЗАГОЛОВОК',
sampleBoundaries:'Настоящая проверка объяснит наблюдаемые факты и предложит следующие шаги. Без ИИ, редактирования и автоматических действий.',
benefit1:'01 · Выберите сайт',benefit2:'02 · Разрешите проверку',benefit3:'03 · Посмотрите доказательства',
aiComing:'ИИ-помощники пока не подключены. Позже сюда можно добавить SO 6.2, сохранив ваше пространство.',
getStarted:'НАЧАТЬ',publicBeta:'ПУБЛИЧНАЯ БЕТА',createTitle:'Сохраните свои проверки.',
createDesc:'Личное пространство хранит разрешения, результаты и данные восстановления отдельно от других пользователей.',
username:'Имя пользователя',password:'Пароль',
uniquePwd:'Используйте уникальный пароль. В бета-версии восстановление через email пока недоступно.',
createAccount:'Создать пространство',existingAccount:'Уже есть аккаунт? Войти',welcomeBack:'С возвращением.',
signInDesc:'Войдите, чтобы продолжить работу со своими разрешениями и проверками.',
signIn:'Войти',newAccount:'Нет аккаунта? Создать',
accountPrivacy:'Не нужны email, банковская карта или API. Храним имя пользователя, защищённый хеш пароля и ваши проверки.',
hello:'Рады видеть вас,',overviewIntro:'Здесь ваши помощники, доступные инструменты и сохранённые результаты. Используйте только подключения и разрешения своего пространства.',
firstRealTask:'ВАША ПЕРВАЯ РЕАЛЬНАЯ ЗАДАЧА',missionOne:'Проверьте сайт.',missionTwo:'Увидьте доказательства.',
missionDesc:'Настоящий ограниченный HTTPS-запрос. Без паролей от сайта, изменений файлов и скрытых действий ИИ.',
startWebsiteCheck:'Открыть проверку сайта',notGranted:'Разрешение не выдано',
brandWords:'ВАШ ИИ · ВАШ КОНТРОЛЬ · ВАШ РЕЗУЛЬТАТ',permissionStatus:'ДОСТУП К САЙТУ',
manageAccess:'Управление разрешениями ↗',checksRecorded:'ЗАПИСАННЫЕ ПРОВЕРКИ',viewActivity:'Посмотреть историю ↗',
aiConnection:'ПОДКЛЮЧЕНИЕ ИИ',notConnected:'Не подключён',comingLater:'SO 6.2 подключим позже ↗',
checkHeadOne:'Что показывает',checkHeadTwo:'ваш сайт?',
checkIntro:'Выберите публичный HTTPS-домен. LUCH проверит главную страницу, прочитает ограниченный объём метаданных и сохранит результат.',
source:'ИСТОЧНИК',readOnly:'ТОЛЬКО ЧТЕНИЕ',websiteAddress:'Адрес публичного сайта',
originOnly:'Только главная HTTPS-страница. Без паролей, локальных сетей и переходов по редиректам.',
consentCopy:'Разрешаю LUCH сделать запрос только для чтения к этому публичному сайту и сохранить результат в моём аккаунте.',
grantThisWebsite:'Разрешить проверку этого сайта',permissionActive:'АКТИВНОЕ РАЗРЕШЕНИЕ',
scopeDisclosure:'Только GET / по защищённому HTTPS. Без входа, записи, выполнения JavaScript и переходов по редиректам.',
runCheck:'Выполнить реальную проверку',changePermission:'Изменить или отозвать доступ ↗',
evidence:'НАБЛЮДАЕМЫЙ РЕЗУЛЬТАТ',notRun:'НЕ ЗАПУЩЕНО',
resultPlaceholder:'Ваш результат появится здесь.',
resultPlaceholderDesc:'Сначала разрешите проверку одного публичного сайта. Данные появятся после нового реального HTTPS-запроса.',
responseTime:'ВРЕМЯ',mobileViewport:'МОБИЛЬНАЯ ВЁРСТКА',checkedAt:'Время проверки',
sourceHash:'Начало SHA-256 содержимого',observations:'Наблюдения',
limitedCheck:'Это ограниченная проверка HTML и HTTPS, а не полноценный аудит доступности, SEO или безопасности.',
permissionHeadOne:'Ваши инструменты.',permissionHeadTwo:'Ваше решение.',
permissionIntro:'Доступ ограничен главной страницей выбранного публичного HTTPS-сайта. Вы можете немедленно остановить новые проверки.',
activeGrant:'РАЗРЕШЕНИЕ НА ПРОВЕРКУ САЙТА',noPermission:'Сайт ещё не выбран.',
permissionScope:'Разрешено: главная публичная HTTPS-страница, только чтение. Запрещено: пароли, локальные сети, внутренние сервисы, файлы и устройства.',
chooseWebsite:'Выбрать сайт',revoke:'Отозвать разрешение',
revokeNote:'После отзыва прежнее разрешение нельзя использовать для новой проверки.',
activityHeadOne:'Что произошло',activityHeadTwo:'и когда.',
activityIntro:'Здесь только ваши проверки и изменения разрешений, без событий других пользователей.',
recordedResults:'СОХРАНЁННЫЕ РЕЗУЛЬТАТЫ',yourAccount:'ТОЛЬКО ВАШ АККАУНТ',
noActivity:'Событий пока нет. После первой проверки результат появится здесь.',
assistantHeadOne:'Ваш ИИ.',assistantHeadTwo:'С вашего разрешения.',
assistantIntro:'Здесь будут работать ИИ-помощники с теми подключениями и правами, которые вы выберете.',
modelComing:'SO 6.2 · подключение запланировано',
modelExplainer:'В публичном Home пока нет API модели. Чат, доступ к файлам и автоматические действия выключены. Когда модель появится, она будет использовать ваши разрешения, а не чужую учётную запись.',
useAvailableTool:'Открыть доступную проверку сайта',accountControl:'Ваш аккаунт и данные',retention:'Проверки и история хранятся до 90 дней. Вы можете удалить учётную запись вместе со всеми данными.',
deleteAccount:'Удалить мой аккаунт и данные',privacy:'Конфиденциальность',terms:'Условия',
tryNow:'Бесплатно проверить сайт ↗',showPassword:'Показать пароль',hidePassword:'Скрыть пароль',
acceptPolicies:'Я ознакомился с Политикой конфиденциальности и Условиями использования LUCH Home.',
forgotPassword:'Забыли пароль? Восстановить по коду',recoveryTitle:'Восстановление аккаунта',
recoveryDesc:'Введите резервный код, сохранённый при регистрации. Пароль изменится, остальные сеансы завершатся.',
recoveryCode:'Резервный код',newPassword:'Новый пароль',resetPassword:'Сменить пароль',
backToLogin:'Вернуться ко входу',saveCodeTitle:'Сохраните резервный код',
saveCodeDesc:'Храните этот код в безопасном месте. LUCH показывает его только сейчас и не сможет восстановить. Знающий код и логин сможет сменить пароль.',
copyCode:'Скопировать код',savedCodeConfirm:'Я надёжно сохранил резервный код.',
continueToHome:'Продолжить в Home',recoverySettings:'Восстановление аккаунта',
recoverySettingsDesc:'Выпустите новый резервный код. Старый сразу перестанет работать.',
newRecoveryCode:'Выпустить новый код',
sampleHeading:'Посмотрите пример результата до регистрации',sampleDisclosure:'Только пример: это не текущая проверка вашего аккаунта.',
sampleDomain:'Пример сайта',sampleLimits:'LUCH проверяет метаданные публичной главной страницы и не изменяет сайт.'
};
const P={
en:{
waiting:'Checking connection…',grantActive:'Allowed',notGranted:'Not granted',yes:'Yes',no:'No',unknown:'Unknown',
noResult:'No website check yet.',permissionGranted:'Permission granted for this website.',permissionRevoked:'Permission revoked. A new check is now blocked.',
checked:'Website checked and saved to your account.',busy:'Working…',
error:'Could not complete this request.',sessionExpired:'Session expired. Please sign in again.',
signedIn:'You are signed in.',signedOut:'You have signed out.',
signupOK:'Workspace created.',badSite:'Enter a public HTTPS website address.',
confirmRevoke:'Revoke permission for this website? Further checks will be blocked.',
statusGood:'VERIFIED RESPONSE',statusOther:'RESPONSE RECEIVED',loginError:'Could not sign in. Please check your credentials.',
noTitle:'No HTML title found',savedAt:'Checked',scopeResult:'Read-only HTTPS result',viewResult:'View result',
eventCheck:'Website check',eventGrant:'Permission granted',eventRevoke:'Permission revoked',eventAccount:'Account created',eventLogin:'Signed in',
obs200:'Website responded successfully.',obs300:'Website returned a redirect; redirects were not followed.',
obsBad:'Website returned a non-success HTTP status.',obsViewport:'No mobile viewport meta tag was found in the inspected HTML.',
obsTitle:'No HTML title was found in the inspected content.',obsNotHTML:'Response was not HTML; page metadata was not inspected.',
siteLimit:'Only verified public HTTPS websites are supported. Paths, private IPs and redirects cannot be inspected.',
grantRequired:'Grant one website before running a check.',cannotConnect:'Connection unavailable. Please try again.',
resetDone:'Password reset. Sign in with the new password.',copyDone:'Recovery code copied.',recoveryNotSaved:'Please save and confirm the code first.',
errorSignup:'Please check your username, password and acceptance of the policies.',errorGrant:'Please choose a public HTTPS website.',
errorAuth:'Credentials or recovery code are incorrect.',errorRate:'Too many attempts. Try again later.',errorAccess:'This operation is not permitted.',
errorNetwork:'Cannot verify this website. Please try another public HTTPS site.'
},
ru:{
waiting:'Проверяем соединение…',grantActive:'Разрешено',notGranted:'Не разрешено',yes:'Есть',no:'Нет',unknown:'Неизвестно',
noResult:'Проверок сайта пока нет.',permissionGranted:'Разрешение для этого сайта выдано.',
permissionRevoked:'Разрешение отозвано. Новая проверка заблокирована.',
checked:'Сайт проверен, результат сохранён в вашем аккаунте.',busy:'Выполняется…',
error:'Не удалось выполнить запрос.',sessionExpired:'Сеанс истёк. Войдите снова.',
signedIn:'Вы вошли.',signedOut:'Вы вышли.',signupOK:'Пространство создано.',
badSite:'Укажите публичный HTTPS-адрес сайта.',
confirmRevoke:'Отозвать разрешение для сайта? Новые проверки станут недоступны.',
statusGood:'ОТВЕТ ПОДТВЕРЖДЁН',statusOther:'ОТВЕТ ПОЛУЧЕН',loginError:'Не удалось войти. Проверьте данные.',
noTitle:'Заголовок HTML не найден',savedAt:'Проверено',scopeResult:'Результат чтения HTTPS',viewResult:'Посмотреть результат',
eventCheck:'Проверка сайта',eventGrant:'Разрешение выдано',eventRevoke:'Разрешение отозвано',eventAccount:'Аккаунт создан',eventLogin:'Выполнен вход',
obs200:'Сайт ответил успешно.',obs300:'Сайт вернул перенаправление, переход по нему не выполнялся.',
obsBad:'Сайт вернул HTTP-статус ошибки.',obsViewport:'В проверенной части HTML не найден мобильный viewport.',
obsTitle:'В проверенной части HTML не найден заголовок title.',
obsNotHTML:'Ответ не является HTML; метаданные страницы не изучались.',
siteLimit:'Поддерживаются только публичные HTTPS-сайты. Пути, частные IP и редиректы не обрабатываются.',
grantRequired:'Сначала разрешите проверку одного сайта.',
cannotConnect:'Нет соединения. Повторите позже.',
resetDone:'Пароль изменён. Войдите с новым паролем.',copyDone:'Резервный код скопирован.',recoveryNotSaved:'Сначала сохраните код и подтвердите это.',
errorSignup:'Проверьте имя, пароль и согласие с условиями.',errorGrant:'Укажите публичный HTTPS-сайт.',
errorAuth:'Логин, пароль или резервный код неверны.',errorRate:'Слишком много попыток. Повторите позже.',
errorAccess:'Недостаточно прав для этого действия.',errorNetwork:'Не удалось проверить сайт. Попробуйте другой публичный HTTPS-адрес.'
}};
const $=id=>document.getElementById(id);
// Preserve original English DOM strings before translating an initial ?lang=ru request.
document.querySelectorAll('[data-i18n]').forEach(n=>{n.dataset.enOriginal=n.textContent});
const escapeText=value=>String(value??'');
let lang=new URLSearchParams(location.search).get('lang')==='ru'?'ru':'en';
let state={authenticated:false}, page='overview', busy=false, lastResult=null, pendingGuestSite='', selectingOtherSite=false, failedAttempt=null;
function tx(key){return P[lang][key]||key}
function translate(){
 document.documentElement.lang=lang;
 document.title=lang==='ru'?'LUCH Home — ваше пространство':'LUCH Home — your workspace';
 document.querySelectorAll('[data-i18n]').forEach(n=>{
  let key=n.dataset.i18n;
  if(lang==='ru' && RU[key]!==undefined)n.textContent=RU[key];
  else n.textContent=n.dataset.enOriginal ??= n.textContent;
 });
 document.querySelectorAll('[data-language]').forEach(b=>{
  b.textContent=lang==='en'?'РУ':'EN';
  b.setAttribute('aria-label',lang==='en'?'Switch to Russian':'Переключить на английский');
 });
 document.querySelectorAll('[data-platform-path]').forEach(a=>a.href='/'+lang+'/'+a.dataset.platformPath+'/');
 $('agent-input').placeholder=lang==='ru'?'Чат недоступен':'Chat unavailable';
 document.querySelector('[data-privacy]').href=lang==='ru'?'/ru/privacy/':'/en/privacy/';
 document.querySelector('[data-terms]').href=lang==='ru'?'/ru/terms/':'/en/terms/';
 if(state.authenticated)render();
}
function switchLanguage(){
 lang=lang==='en'?'ru':'en';
 const u=new URL(location.href);
 if(lang==='ru')u.searchParams.set('lang','ru');else u.searchParams.delete('lang');
 history.replaceState(null,'',u.pathname+u.search+u.hash);
 translate();
}
async function request(path,payload=null,needsCsrf=true){
 const options={method:payload===null?'GET':'POST',credentials:'same-origin',cache:'no-store',
 headers:{'Accept':'application/json'}};
 if(payload!==null){
  options.headers['Content-Type']='application/json';
  if(needsCsrf)options.headers['X-LUCH-CSRF']=state.csrf||'';
  options.body=JSON.stringify(payload);
 }
 let response;
 try{response=await fetch('/home/api/'+path,options)}
 catch{throw new Error(tx('cannotConnect'))}
 let json={};
 try{json=await response.json()}catch{}
 if(!response.ok) {
  const e=new Error(json.error || tx('error'));e.status=response.status;e.code=json.error_code||'';throw e;
 }
 return json;
}
function text(id,value){$(id).textContent=escapeText(value)}
function showToast(message){
 const el=$('toast');el.textContent=message;el.hidden=false;
 clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>{el.hidden=true},4600);
}
function reportError(where,error){
 const status=error?.status;
 const msg=status===401?tx('sessionExpired'):
  lang==='en'?(error?.message||tx('error')):
  status===429?tx('errorRate'):status===403?tx('errorAccess'):
  status===422?tx('errorNetwork'):
  where==='check-feedback'?tx('errorGrant'):
  where==='auth-feedback'?tx('errorAuth'):tx('error');
 text(where,msg);
 if(error?.status===401)refresh();
}
function setBusy(on){
 busy=on;
 document.querySelectorAll('form button[type=submit], #run-check, #revoke-grant, #rotate-recovery').forEach(x=>x.disabled=on);
}
function showPage(next){
 if(!state.authenticated)return;
 page=next;
 document.querySelectorAll('[data-page]').forEach(n=>n.hidden=n.dataset.page!==next);
 document.querySelectorAll('[data-go]').forEach(n=>{
   let active=n.dataset.go===next && n.classList.contains('nav-link');
   n.classList.toggle('active',active);
   if(active)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');
 });
 const u=new URL(location.href);u.hash=next==='overview'?'':next;
 history.replaceState(null,'',u.pathname+u.search+u.hash);
 window.scrollTo({top:0,behavior:'instant'});
}
function formatDate(n){
 return new Intl.DateTimeFormat(lang==='ru'?'ru-RU':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(n*1000))
}
// BEGIN R83 DIAGNOSIS (pure; no I/O or model calls).
function diagnoseWebsite(r,locale='en'){
 const ru=locale==='ru', L=(en,rs)=>ru?rs:en;
 const status=Number.isInteger(r?.http_status)?r.http_status:null;
 const html=['text/html','application/xhtml+xml'].includes(String(r?.content_type||'').split(';')[0].trim().toLowerCase());
 const out={code:'unknown',title:'',summary:'',actions:[],limits:L('One HTTPS GET of the homepage; at most 96 KiB, no redirects or JavaScript. Not a full uptime, security, mobile, SEO or checkout test.','Один HTTPS GET главной страницы, до 96 КиБ, без переходов и JavaScript. Это не полная проверка доступности, безопасности, мобильной версии, SEO или оплаты.')};
 const add=(code,en,rs,ev)=>out.actions.push({code,text:L(en,rs),evidence:ev});
 const set=(code,en,rs,es,ss)=>Object.assign(out,{code,title:L(en,rs),summary:L(es,ss)});
 if(status>=200&&status<300){
  set('responded','Your homepage answered this request.','Главная страница ответила на запрос.','The HTTPS server returned HTTP '+status+'. This confirms a response at the recorded time, not that the whole website works.','HTTPS-сервер вернул HTTP '+status+'. Это подтверждает ответ в момент проверки, но не работу всего сайта.');
  if(html&&status!==204&&status!==205&&status!==206){
   if(r.page_title===null||r.page_title==='')add('title','No title was found in the inspected HTML. Ask your developer to check the homepage HTML title. A missing title can make the page harder to identify in browser tabs and search previews.','В проверенной части HTML не найден заголовок. Попросите разработчика проверить HTML-заголовок главной страницы. Без него страницу труднее распознать во вкладках и поисковых превью.','title_not_found_in_examined_html');
   if(r.mobile_viewport===false)add('viewport','No viewport tag was found in the inspected HTML. Ask your developer to verify the viewport meta tag and test the page on a real phone. This tag alone does not establish mobile usability.','В проверенной части HTML не найден тег viewport. Попросите разработчика проверить тег viewport и протестировать страницу на настоящем телефоне. Сам тег не доказывает удобство мобильной версии.','viewport_not_found_in_examined_html');
   if(r.meta_description===false)add('description','No meta description was found in the inspected HTML. If this is a public landing page, ask whether a descriptive meta description is useful. It may help communicate the page topic; search engines may use other text.','В проверенной части HTML не найден meta description. Если это публичный лендинг, уточните, нужен ли описательный meta description. Он может помочь передать тему страницы; поисковики могут выбрать другой текст.','description_not_found_in_examined_html');
  }else if(!html||status===204||status===205||status===206)add('content','Open the intended customer-facing page in a browser and ask the developer whether this response or content type is expected.','Откройте нужную клиентскую страницу в браузере и уточните у разработчика, ожидается ли такой ответ или тип содержимого.','content_not_fully_inspectable');
  add('journey','On a phone and desktop, open the site and try one important customer action (for example, find contact details or start an order). LUCH has not tested that action.','Откройте сайт на телефоне и компьютере и попробуйте важное действие клиента (например, найти контакты или начать оформление заказа). LUCH это действие не проверял.','customer_journey_not_tested');
 }else if(status===304){
  set('not_modified','The server returned Not Modified.','Сервер вернул Not Modified.','HTTP 304 was observed. A fresh page body was not established; this is not a successful inspection of its content.','Получен HTTP 304. Свежий HTML не подтверждён; это не успешная проверка содержимого.');
  add('verify','Open the homepage in a regular browser and verify the expected content.','Откройте главную страницу в обычном браузере и проверьте ожидаемое содержимое.','observed_304');
 }else if(status>=300&&status<400){
  set('redirect','The homepage returned a redirect.','Главная страница вернула перенаправление.','HTTP '+status+' was observed. LUCH did not follow it; the destination and final page are unknown.','Получен HTTP '+status+'. LUCH не переходил по перенаправлению; конечная страница неизвестна.');
  add('redirect_target','Open the address in your browser. Verify it ends at the intended public page, not a login screen, error or redirect loop.','Откройте адрес в браузере. Убедитесь, что он ведёт на нужную публичную страницу, а не на вход, ошибку или цикл перенаправлений.','redirect_not_followed');
 }else if(status>=500&&status<600){
  set('server_error','The server returned an error.','Сервер вернул ошибку.','HTTP '+status+' indicates a server-side or upstream error for this request. The cause and impact on other visitors are not established.','HTTP '+status+' указывает на ошибку сервера или вышестоящего сервиса для этого запроса. Причина и влияние на других посетителей не установлены.');
  add('retry','Try the homepage in a normal browser and repeat the check later if you have permission. If the error persists, send this report to the site operator.','Откройте главную страницу в обычном браузере и повторите проверку позже при наличии разрешения. Если ошибка сохраняется, передайте отчёт оператору сайта.','observed_5xx');
  add('operator','If you manage the site, ask your developer to compare server or hosting logs around the recorded time.','Если вы управляете сайтом, попросите разработчика сверить журналы сервера или хостинга на указанное время.','cause_not_verified');
 }else if(status>=400&&status<500){
  set('client_response','The server did not return a successful page.','Сервер не вернул успешную страницу.','HTTP '+status+' was observed. It can reflect access policy, a missing page or request filtering; it is not proof that the website is down.','Получен HTTP '+status+'. Возможны правила доступа, отсутствующая страница или фильтрация запросов; это не доказательство недоступности всего сайта.');
  if(status===401||status===403)add('access','Check the public address in a normal browser. If it is supposed to be public, ask the owner whether automated requests are intentionally restricted. Do not bypass access controls.','Проверьте публичный адрес в обычном браузере. Если страница должна быть публичной, уточните у владельца, не ограничены ли автоматические запросы. Не обходите ограничения доступа.','observed_access_status');
  else if(status===404||status===410)add('missing','Confirm that the intended homepage address still exists. If you manage it, send the observed status and URL to your developer.','Уточните, существует ли нужный адрес главной страницы. Если вы управляете сайтом, отправьте статус и адрес разработчику.','observed_missing_status');
  else if(status===429)add('rate','Wait before trying again; the server may be rate limiting requests. Do not repeatedly retry.','Подождите перед повторной проверкой: сервер может ограничивать частоту запросов. Не повторяйте запросы многократно.','observed_rate_status');
  else add('check_address','Verify the address in a normal browser. Ask the site operator to investigate the recorded HTTP status if unexpected.','Проверьте адрес в обычном браузере. Если статус неожиданен, попросите оператора сайта разобраться.','observed_4xx');
 }else{
  set('unknown','The response cannot be interpreted reliably.','Ответ нельзя надёжно интерпретировать.','No supported final HTTP status was recorded. Do not infer website health or a cause.','Нет поддерживаемого итогового HTTP-статуса. Нельзя делать вывод о состоянии сайта или причине.');
  add('verify','Check the intended address manually and ask the operator if the unexpected response persists.','Проверьте нужный адрес вручную и обратитесь к оператору, если необычный ответ сохраняется.','unsupported_status');
 }
 // Practical customer-journey verification precedes optional search metadata.
 if(out.code==='responded'){
  const priorities={content:0,title:1,viewport:2,journey:3,description:4};
  out.actions.sort((a,b)=>(priorities[a.code]??9)-(priorities[b.code]??9));
 }
 return out;
}
// END R83 DIAGNOSIS
// BEGIN R832 COMPARISON (pure; stored observations only).
function compareObservations(current,checks,locale='en'){
 const L=(en,ru)=>locale==='ru'?ru:en;
 if(!current||!current.origin||!Number.isInteger(current.checked_at)||!Number.isInteger(current.http_status))return null;
 const candidates=(checks||[]).map(c=>c.result).filter(r=>r&&r.origin===current.origin&&Number.isInteger(r.checked_at)&&r.checked_at<current.checked_at&&Number.isInteger(r.http_status)).sort((a,b)=>b.checked_at-a.checked_at);
 const prior=candidates[0];
 // An ambiguous same-second prior cannot be ordered reliably.
 if(!prior||candidates.filter(r=>r.checked_at===prior.checked_at).length!==1)return null;
 const changes=[];
 const add=(key,label,before,after)=>{if(before!==after)changes.push({key,label,before,after})};
 add('http',L('HTTP response','HTTP-ответ'),String(prior.http_status),String(current.http_status));
 const html200=r=>r.http_status===200&&['text/html','application/xhtml+xml'].includes(String(r.content_type||'').split(';')[0].trim().toLowerCase());
 const title=r=>typeof r.page_title==='string'?r.page_title:r.page_title===null?L('Not found','Не найден'):null;
 const flag=x=>x===true?L('Found','Найден'):x===false?L('Not found','Не найден'):null;
 if(html200(prior)&&html200(current)){
  for(const [key,label,b,a] of [
    ['title',L('Page title','Заголовок'),title(prior),title(current)],
    ['viewport',L('Viewport tag','Тег viewport'),flag(prior.mobile_viewport),flag(current.mobile_viewport)],
    ['description',L('Description tag','Тег description'),flag(prior.meta_description),flag(current.meta_description)]]){
   if(b!==null&&a!==null)add(key,label,b,a);
  }
 }
 const hashValid=x=>typeof x==='string'&&/^[a-f0-9]{24}$/.test(x);
 const bytesComparable=html200(prior)&&html200(current)&&hashValid(prior.sha256_prefix)&&hashValid(current.sha256_prefix);
 const content=bytesComparable?(prior.sha256_prefix===current.sha256_prefix?L('The recorded content hash prefixes match.','Зафиксированные префиксы хеша совпадают.'):L('The recorded content hash prefixes differ. Dynamic content may change without any repair.','Зафиксированные префиксы хеша отличаются. Динамическое содержимое может меняться без исправлений.')):'';
 return {priorAt:prior.checked_at,currentAt:current.checked_at,title:L('What changed since the previous check?','Что изменилось с прошлой проверки?'),
 summary:changes.length?L('The following recorded observations differ.','Следующие зафиксированные наблюдения отличаются.'):L('No differences were found in the comparable status and metadata.','В сравнимых статусе и метаданных отличий не найдено.'),changes,content,
 limits:L('Same website, two recorded requests only. This does not prove a repair, continuous uptime, or customer journey success.','Один сайт, два зафиксированных запроса. Это не доказывает исправление, непрерывную доступность или успех клиентского сценария.')};
}
// END R832 COMPARISON
function showComparison(target,r){
 target.replaceChildren();
 const c=compareObservations(r,state.checks,lang);
 target.hidden=!c;if(!c)return;
 const h=document.createElement('h4');h.textContent=c.title;
 const dates=document.createElement('p');dates.className='field-note';dates.textContent=formatDate(c.priorAt)+' → '+formatDate(c.currentAt);
 const summary=document.createElement('p');summary.textContent=c.summary;
 target.append(h,dates,summary);
 for(const change of c.changes){const p=document.createElement('p');p.className='comparison-change';p.textContent=change.label+': '+change.before+' → '+change.after;target.append(p)}
 if(c.content){const p=document.createElement('p');p.textContent=c.content;target.append(p)}
 const limits=document.createElement('p');limits.className='field-note';limits.textContent=c.limits;target.append(limits);
}
function diagnosisReport(r,d){
 const tr=(en,rs)=>lang==='ru'?rs:en;
 return [tr('LUCH website observation (not a complete audit)','Наблюдение LUCH (не полный аудит)'),
 r.origin,formatDate(r.checked_at),'HTTP '+r.http_status,
 tr('Page title: ','Заголовок страницы: ')+String(r.page_title??'—'),
 tr('Content type: ','Тип содержимого: ')+String(r.content_type??'—'),
 tr('Observed response time: ','Наблюдаемое время ответа: ')+String(r.elapsed_ms??'—')+' ms',
 tr('Examined bytes: ','Проверено байт: ')+String(r.bytes_examined??'—'),
 'SHA-256: '+String(r.sha256_prefix||'—'),'',d.title,d.summary,'',
 tr('Suggested next steps:','Предлагаемые следующие шаги:'),
 ...d.actions.map((a,i)=>(i+1)+'. '+a.text),'',d.limits,
 tr('Rule-based explanation. No AI or website changes.','Объяснение по правилам. Без ИИ и изменений сайта.')].join('\n');
}
function renderDiagnosis(r){
 const actions=$('diagnosis-actions');actions.replaceChildren();
 text('copy-diagnosis-status','');
 if(!r){delete $('result-diagnosis').dataset.outcome;text('diagnosis-title','');text('diagnosis-summary','');text('diagnosis-limits','');$('diagnosis-report').value='';return}
 const d=diagnoseWebsite(r,lang);
 text('diagnosis-title',d.title);text('diagnosis-summary',d.summary+' '+(lang==='ru'?'Последнее сохранённое наблюдение: ':'Last saved observation: ')+formatDate(r.checked_at)+'.');
 text('diagnosis-limits',d.limits);
 $('result-diagnosis').dataset.outcome=d.code;
 for(const a of d.actions){const li=document.createElement('li');li.dataset.action=a.code;li.textContent=a.text;actions.append(li)}
 $('diagnosis-report').value=diagnosisReport(r,d);
}
// BEGIN R83 ATTEMPT STATUS (not a site diagnosis).
function describeCheckFailure(status,locale='en'){
 const L=(en,ru)=>locale==='ru'?ru:en;
 const title=L('No new result was confirmed.','Новый результат не подтверждён.');
 if(status===422)return {title,detail:L('LUCH could not establish a verified HTTPS response. This does not establish that the website is down.','LUCH не удалось получить подтверждённый HTTPS-ответ. Это не доказывает, что сайт недоступен.'),next:L('Open the address in a normal browser. If the issue persists, ask the site operator to check DNS, TLS and hosting; the cause is not established.','Откройте адрес в обычном браузере. Если проблема сохраняется, попросите оператора сайта проверить DNS, TLS и хостинг; причина не установлена.')};
 if(status===403||status===401)return {title,detail:L('The check was not authorized by LUCH. This is not an HTTP status returned by the website.','LUCH не разрешил проверку. Это не HTTP-статус самого сайта.'),next:L('Review your session and current permission before starting another check.','Проверьте состояние входа и текущее разрешение перед новой проверкой.')};
 if(status===429)return {title,detail:L('LUCH limited this request. No new website observation was confirmed.','LUCH ограничил частоту запросов. Новое наблюдение сайта не подтверждено.'),next:L('Wait before trying again; do not repeatedly retry.','Подождите перед повторной попыткой; не повторяйте запросы многократно.')};
 return {title,detail:L('The check could not be completed or confirmed by LUCH. No conclusion about current website health follows.','LUCH не смог завершить или подтвердить проверку. Делать вывод о текущем состоянии сайта нельзя.'),next:L('Check your connection and try again later if needed; you can also open the address in a normal browser.','Проверьте соединение и при необходимости повторите позже; можно также открыть адрес в обычном браузере.')};
}
// END R83 ATTEMPT STATUS
function renderAttemptNotice(){
 const note=$('check-attempt-notice');
 const visible=Boolean(failedAttempt&&state.authenticated&&state.grant?.origin===failedAttempt.origin&&!selectingOtherSite);
 note.hidden=!visible;
 if(!visible){
  ['check-attempt-title','check-attempt-detail','check-attempt-next'].forEach(id=>text(id,''));
  $('check-attempt-history').hidden=true;
  return;
 }
 const d=describeCheckFailure(failedAttempt.status,lang);
 text('check-attempt-title',d.title);
 text('check-attempt-detail',d.detail);
 text('check-attempt-next',d.next);
 $('check-attempt-history').hidden=$('site-result').hidden;
}
function displayResult(r){
 renderDiagnosis(r);showComparison($('result-comparison'),r);
 if(!r){$('site-result').hidden=true;$('empty-result').hidden=false;
  ['result-title','result-http','result-time','result-mobile','result-origin','result-checked','result-hash'].forEach(id=>text(id,''));
  $('result-observations').replaceChildren();
  text('result-badge',lang==='ru'?'НЕ ЗАПУЩЕНО':'NOT RUN');
  $('result-badge').className='result-badge';return;
 }
 lastResult=r;
 $('site-result').hidden=false;$('empty-result').hidden=true;
 const good=r.http_status>=200&&r.http_status<300;
 text('result-badge',good?tx('statusGood'):tx('statusOther'));
 $('result-badge').className='result-badge'+(good?' good':'');
 text('result-title',r.page_title||tx('noTitle'));
 text('result-http',r.http_status);
 text('result-time',r.elapsed_ms+' ms');
 text('result-mobile',r.mobile_viewport===null?tx('unknown'):r.mobile_viewport?tx('yes'):tx('no'));
 text('result-origin',r.origin);
 text('result-checked',formatDate(r.checked_at));
 text('result-hash',r.sha256_prefix);
 const list=$('result-observations');list.replaceChildren();
 const obs={
  'Website responded successfully.':'obs200',
  'Website returned a redirect; redirects were not followed.':'obs300',
  'Website returned a non-success HTTP status.':'obsBad',
  'No mobile viewport meta tag was found in the inspected HTML.':'obsViewport',
  'No HTML title was found in the inspected content.':'obsTitle',
  'Response was not HTML; page metadata was not inspected.':'obsNotHTML'
 };
 for(let v of r.observations||[]){const li=document.createElement('li');
  if(r.http_status===304&&v==='Website returned a redirect; redirects were not followed.')li.textContent=lang==='ru'?'Сервер вернул HTTP 304, свежий HTML не подтверждён.':'The server returned HTTP 304; a fresh HTML body was not established.';
  else li.textContent=tx(obs[v]||v);list.append(li)}

}
function renderSavedResults(){
 const target=$('saved-results');target.replaceChildren();
 const checks=state.checks||[];
 if(!checks.length){const p=document.createElement('p');p.className='field-note';p.textContent=tx('noResult');target.append(p);return}
 for(const check of checks){
  const r=check.result||{};
  const card=document.createElement('details');card.className='saved-result';
  const summary=document.createElement('summary');
  const label=document.createElement('strong');label.textContent=r.origin||check.origin||'';
  const status=document.createElement('span');status.textContent='HTTP '+String(r.http_status??tx('unknown'));
  summary.append(label,status);card.append(summary);
  const date=document.createElement('p');date.className='field-note';date.textContent=formatDate(r.checked_at||check.at);
  const dl=document.createElement('dl');dl.className='result-details';
  for(const [name,value] of [
    [lang==='ru'?'Заголовок страницы':'Page title',r.page_title||tx('noTitle')],
    [lang==='ru'?'Время ответа':'Response time',r.elapsed_ms+' ms'],
    [lang==='ru'?'Мобильная разметка':'Mobile viewport',r.mobile_viewport===null?tx('unknown'):r.mobile_viewport?tx('yes'):tx('no')],
    ['SHA-256',r.sha256_prefix||'—']]){
   const dt=document.createElement('dt'),dd=document.createElement('dd');
   dt.textContent=name;dd.textContent=String(value);dl.append(dt,dd);
  }
  const d=diagnoseWebsite(r,lang);
  const explanation=document.createElement('p');explanation.className='saved-diagnosis';explanation.textContent=d.title+' '+d.summary;
  const next=document.createElement('ol');next.className='diagnosis-actions';
  for(const a of d.actions){const li=document.createElement('li');li.textContent=a.text;next.append(li)}
  const limits=document.createElement('p');limits.className='field-note';limits.textContent=d.limits;
  const comparison=document.createElement('section');comparison.className='observation-comparison';showComparison(comparison,r);
  card.append(date,explanation,next,limits,comparison,dl);target.append(card);
 }
}
function renderActivity(){
 const el=$('activity-list');el.replaceChildren();
 const recent=(state.events||[]);
 if(!recent.length){const p=document.createElement('p');p.textContent=lang==='ru'?RU.noActivity||'Событий пока нет.':tx('noResult');el.append(p);return}
 const names={WEBSITE_CHECK:'eventCheck',CONSENT_GRANTED:'eventGrant',ACCESS_REVOKED:'eventRevoke',ACCOUNT_CREATED:'eventAccount',SIGNED_IN:'eventLogin'};
 for(const evt of recent){
  const row=document.createElement('div');row.className='activity-row';
  const icon=document.createElement('span');icon.textContent=evt.event==='WEBSITE_CHECK'?'◇':'◈';
  const wrap=document.createElement('div');
  const title=document.createElement('strong');title.textContent=tx(names[evt.event]||evt.event);
  const detail=document.createElement('p');detail.textContent=evt.detail||'';
  const time=document.createElement('time');time.textContent=formatDate(evt.at);
  wrap.append(title,detail,time);row.append(icon,wrap);el.append(row);
 }
}
let agentEpoch=0,agentTimer=null,agentBusy=false,agentRetry=null;
function al(en,ru){return lang==='ru'?ru:en}
function clearAgent(){
 agentEpoch++;clearTimeout(agentTimer);agentRetry=null;agentBusy=false;
 $('agent-dialogue').replaceChildren();$('agent-input').value='';$('agent-input').disabled=true;
 $('agent-send').disabled=true;$('agent-grant').hidden=true;$('agent-revoke').hidden=true;
}
async function refreshAgent(){
 const epoch=++agentEpoch;clearTimeout(agentTimer);
 if(!state.authenticated){clearAgent();return;}
 const user=state.username;
 let a;
 try{a=await request('agent')}catch{a={configured:false,authorized:false,jobs:[]}}
 if(epoch!==agentEpoch||!state.authenticated||state.username!==user)return;
 const pending=a.jobs.some(j=>j.state==='pending'),ready=a.configured&&a.authorized;
 $('agent-input').disabled=!ready||pending||agentBusy;$('agent-send').disabled=$('agent-input').disabled;
 $('agent-grant').hidden=!a.configured||a.authorized;$('agent-revoke').hidden=!a.authorized;
 text('agent-grant',al('Authorize private chat','Разрешить личный чат'));
 text('agent-revoke',al('Revoke private chat','Отозвать доступ'));
 text('agent-state-label',ready?al('Private route authorized','Личный маршрут разрешён'):al('Not connected','Не подключён'));
 text('agent-blocked',ready?al('Real replies only. No automatic resend. Core tools not connected.','Только настоящие ответы. Без автоматического повтора. Инструменты Core не подключены.'):al('Personal connection required.','Требуется личное подключение.'));
 $('agent-input').placeholder=ready?al('Message Agent 001','Сообщение Agent 001'):al('Chat unavailable','Чат недоступен');
 const panel=$('agent-dialogue');panel.replaceChildren();
 if(!ready){const p=document.createElement('p');p.textContent=al('Private conversation is not available to public accounts.','Личный чат недоступен публичным аккаунтам.');panel.append(p);}
 for(const j of a.jobs){
  const u=document.createElement('p');u.textContent=al('You: ','Вы: ')+j.message;panel.append(u);
  const r=document.createElement('p');r.textContent=j.state==='done'?'ChatGPT: '+j.reply:j.state==='pending'?al('Awaiting real response…','Ожидается настоящий ответ…'):al('No verified reply. Check before sending again.','Нет подтверждённого ответа. Проверьте перед новой отправкой.');panel.append(r);
 }
 if(pending)agentTimer=setTimeout(refreshAgent,2000);
}
$('agent-grant').addEventListener('click',async()=>{
 if(!confirm(al('Allow this workspace to send messages to your bound private ChatGPT conversation?','Разрешить отправку сообщений в привязанный личный чат ChatGPT?')))return;
 try{await request('agent/grant',{consent:true});await refreshAgent()}catch(e){showToast(e.message)}
});
$('agent-revoke').addEventListener('click',async()=>{
 try{await request('agent/revoke',{});clearAgent();await refreshAgent()}catch(e){showToast(e.message)}
});
$('agent-send').addEventListener('click',async()=>{
 if(agentBusy||$('agent-send').disabled)return;
 const message=$('agent-input').value.trim();
 if(!message||message.length>450)return;
 if(agentRetry&&agentRetry.message!==message){showToast(al('Check the previous send first.','Сначала проверьте предыдущую отправку.'));return;}
 const id=agentRetry?.id||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
 const user=state.username;const csrf=state.csrf;
 agentRetry={id,message};agentBusy=true;$('agent-send').disabled=true;
 try{await request('agent/send',{id,message});if(state.username===user&&state.csrf===csrf&&state.authenticated){$('agent-input').value='';agentRetry=null;}}
 catch(e){showToast(e.message)}
 finally{if(state.username===user&&state.csrf===csrf&&state.authenticated){agentBusy=false;await refreshAgent()}}
});

function render(){
 const signed=Boolean(state.authenticated);
 $('guest').hidden=signed;$('workspace').hidden=!signed;
 $('side-nav').hidden=!signed;$('user-chip').hidden=!signed;$('logout').hidden=!signed;
 document.body.classList.toggle('signed-in',signed);
 if(!signed){
  clearAgent();
  $('guest').hidden=false;
  $('pre-auth-panel').hidden=false;$('auth-card').hidden=true;
  $('activity-list').replaceChildren();$('saved-results').replaceChildren();
  ['user-chip','hello-name','current-origin','permission-title','permission-badge','stat-permission','mission-status','previous-origin','stat-checks'].forEach(id=>text(id,''));
  $('rotate-password').value='';
  failedAttempt=null;displayResult(null);lastResult=null;renderAttemptNotice();
  return;
 }
 text('user-chip',state.username);text('hello-name',state.username);
 const grant=state.grant;
 const choosing=Boolean(grant)&&selectingOtherSite;
 $('no-grant').hidden=Boolean(grant)&&!choosing;$('granted').hidden=!grant||choosing;
 $('replace-grant-note').hidden=!choosing;
 text('previous-origin',choosing?grant.origin:'');
 $('revoke-grant').hidden=!grant;
 text('current-origin',grant?.origin||'');
 text('permission-title',grant?.origin||(lang==='ru'?RU.noPermission:'No website selected.'));
 text('permission-badge',grant?tx('grantActive'):tx('notGranted'));
 text('stat-permission',grant?tx('grantActive'):tx('notGranted'));
 text('mission-status',grant?grant.origin:tx('notGranted'));
 text('stat-checks',(state.checks||[]).length);
 renderActivity();renderSavedResults();
 const activeOrigin=grant?.origin;
 const ownChecks=state.checks||[];
 const matchingResult=activeOrigin&&!choosing?ownChecks.find(c=>c.origin===activeOrigin)?.result:null;
 displayResult(matchingResult||null);renderAttemptNotice();
 showPage(page);
 refreshAgent();
}
async function refresh(){
 try{
  const next=await request('state');
  if(!next.authenticated||state.username!==next.username||state.csrf!==next.csrf){clearAgent();lastResult=null;selectingOtherSite=false;failedAttempt=null;}
  state=next;render();
 }
 catch(e){showToast(tx('cannotConnect'))}
}
function revealAuth(preferLogin=false){
 $('pre-auth-panel').hidden=true;
 $('auth-card').hidden=false;
 toggleAuth(preferLogin);
 $('auth-card').scrollIntoView({behavior:'smooth',block:'start'});
}
function prepareGuestWebsite(e){
 e.preventDefault();
 const raw=$('guest-website-url').value.trim();
 let value='',valid=false;
 try{
  const u=new URL(raw.includes('://')?raw:'https://'+raw);
  valid=u.protocol==='https:' && Boolean(u.hostname) && u.hostname.includes('.') && !u.username && !u.password &&
    (u.pathname==='/' || u.pathname==='') && !u.search && !u.hash && !u.port;
  value='https://'+u.hostname.toLowerCase().replace(/\.$/,'');
 }catch{}
 if(!valid){
  text('guest-intent-feedback',lang==='ru'?'Укажите публичный HTTPS-домен без пути, порта и параметров.':'Enter a public HTTPS website address without a path, port or query.');
  return;
 }
 pendingGuestSite=value;
 $('website-url').value=value;
 text('guest-intent-feedback','');
 if(state.authenticated){pendingGuestSite='';showPage('check');return}
 revealAuth(false);
 const target=$('register-username');
 target.focus({preventScroll:true});
}
function toggleAuth(login){
 $('register-pane').hidden=login;$('login-pane').hidden=!login;$('recovery-pane').hidden=true;
 text('auth-feedback','');
}
function toggleRecovery(){
 $('register-pane').hidden=true;$('login-pane').hidden=true;$('recovery-pane').hidden=false;
 text('auth-feedback','');
}
let shownRecoveryCode='';
function presentRecoveryCode(code){
 shownRecoveryCode=code;
 text('recovery-code-display',code);
 $('recovery-saved').checked=false;
 $('close-recovery').disabled=true;
 $('recovery-dialog').showModal();
 $('recovery-saved').focus();
}

async function authenticate(mode,e){
 e.preventDefault();if(busy)return;
 const f=e.currentTarget;
 const uname=f.elements.username.value.trim();
 const pwd=f.elements.password.value;
 text('auth-feedback','');setBusy(true);
 try{
  const body=mode==='register'?{username:uname,password:pwd,accepted_terms:$('terms-agreement').checked}:{username:uname,password:pwd};
  const v=await request(mode,body,false);
  f.elements.password.value='';
  await refresh();
  if(v.authenticated){
   if(pendingGuestSite){
    $('website-url').value=pendingGuestSite;
    selectingOtherSite=Boolean(state.grant&&state.grant.origin!==pendingGuestSite);
    pendingGuestSite='';
    render();showPage('check');
   }
   showToast(mode==='register'?tx('signupOK'):tx('signedIn'));
   if(mode==='register'&&v.recovery_code)presentRecoveryCode(v.recovery_code);
  }
 }catch(e){reportError('auth-feedback',e)}
 finally{setBusy(false)}
}
async function consent(e){
 e.preventDefault();if(busy)return;
 const addr=$('website-url').value.trim();
 if(!$('consent-box').checked){text('check-feedback',tx('grantRequired'));return}
 text('check-feedback','');setBusy(true);
 try{
  await request('consent',{origin:addr});$('consent-box').checked=false;
  selectingOtherSite=false;lastResult=null;failedAttempt=null;
  await refresh();showPage('check');showToast(tx('permissionGranted'));
 }catch(e){reportError('check-feedback',e)}
 finally{setBusy(false)}
}
async function runCheck(){
 if(busy)return;
 const attemptedOrigin=state.grant?.origin;
 text('check-feedback',tx('busy'));setBusy(true);
 try{
  const response=await request('check',{});
  lastResult=response.result;failedAttempt=null;
  await refresh();showPage('check');showToast(tx('checked'));text('check-feedback','');
  if(!$('site-result').hidden){
   const result=$('result-diagnosis');
   result.scrollIntoView({behavior:'instant',block:'start'});
   result.focus({preventScroll:true});
  }
 }catch(e){
  failedAttempt={origin:attemptedOrigin,status:e?.status||null};
  reportError('check-feedback',e);
  renderAttemptNotice();
  if(!$('check-attempt-notice').hidden){
   $('check-attempt-notice').scrollIntoView({behavior:'instant',block:'start'});
   $('check-attempt-notice').focus({preventScroll:true});
  }
 }
 finally{setBusy(false)}
}
async function revoke(){
 if(busy||!state.grant)return;
 if(!window.confirm(tx('confirmRevoke')))return;
 text('permission-feedback','');setBusy(true);
 try{
  await request('revoke',{});
  await refresh();showPage('permissions');showToast(tx('permissionRevoked'));
 }catch(e){reportError('permission-feedback',e)}
 finally{setBusy(false)}
}
async function logout(){
 if(busy)return;setBusy(true);
 try{await request('logout',{});state={authenticated:false};page='overview';lastResult=null;pendingGuestSite='';selectingOtherSite=false;$('guest-website-url').value='';$('website-url').value='';$('consent-box').checked=false;render();showToast(tx('signedOut'))}
 catch(e){showToast(tx('error'))}
 finally{setBusy(false)}
}
async function deleteAccount(){
 if(busy||!state.authenticated)return;
 const warning=lang==='ru'?'Удалить аккаунт и все данные без возможности восстановления?':'Permanently delete your account and all its data?';
 if(!window.confirm(warning))return;
 const answer=window.prompt(lang==='ru'?'Для удаления введите имя пользователя:':'Type your username to confirm deletion:');
 if(answer!==state.username)return;
 setBusy(true);
 try{
  await request('delete-account',{username:state.username});
  state={authenticated:false};lastResult=null;page='overview';pendingGuestSite='';selectingOtherSite=false;$('guest-website-url').value='';$('website-url').value='';$('consent-box').checked=false;render();
  showToast(lang==='ru'?'Аккаунт и данные удалены.':'Account and data deleted.');
 }catch(e){reportError('permission-feedback',e)}
 finally{setBusy(false)}
}
async function recoverPassword(e){
 e.preventDefault();if(busy)return;
 const f=e.currentTarget;setBusy(true);text('auth-feedback','');
 try{
  await request('recovery/reset',{username:f.elements.username.value.trim(),
    recovery_code:f.elements.recovery_code.value.trim(),password:f.elements.password.value},false);
  f.reset();toggleAuth(true);showToast(tx('resetDone'));
 }catch(e){reportError('auth-feedback',e)}
 finally{setBusy(false)}
}
async function rotateRecovery(){
 if(busy)return;
 const password=$('rotate-password').value;
 if(!password){text('permission-feedback',tx('errorAuth'));return}
 setBusy(true);text('permission-feedback','');
 try{
  const result=await request('recovery/rotate',{password});
  $('rotate-password').value='';
  presentRecoveryCode(result.recovery_code);
 }catch(e){reportError('permission-feedback',e)}
 finally{setBusy(false)}
}
$('guest-website-intent').addEventListener('submit',prepareGuestWebsite);
document.querySelectorAll('[data-language]').forEach(x=>x.addEventListener('click',switchLanguage));
document.querySelectorAll('[data-go]').forEach(x=>x.addEventListener('click',()=>showPage(x.dataset.go)));
$('show-login').addEventListener('click',()=>toggleAuth(true));
$('show-register').addEventListener('click',()=>toggleAuth(false));
$('show-recovery').addEventListener('click',toggleRecovery);
$('recovery-back').addEventListener('click',()=>toggleAuth(true));
$('recovery-form').addEventListener('submit',recoverPassword);
$('rotate-recovery').addEventListener('click',rotateRecovery);
document.querySelectorAll('[data-create-shortcut]').forEach(b=>b.addEventListener('click',()=>{revealAuth(false);$('register-username').focus({preventScroll:true})}));
document.querySelectorAll('[data-login-shortcut]').forEach(b=>b.addEventListener('click',()=>{
 revealAuth(true);$('login-username').focus({preventScroll:true})
}));
document.querySelectorAll('[data-toggle-password]').forEach(b=>b.addEventListener('click',()=>{
 const f=$(b.dataset.togglePassword);f.type=f.type==='password'?'text':'password';
 b.textContent=f.type==='password'?(lang==='ru'?RU.showPassword:'Show password'):(lang==='ru'?RU.hidePassword:'Hide password')
}));
$('copy-recovery').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(shownRecoveryCode);showToast(tx('copyDone'))}
 catch{showToast(lang==='ru'?'Скопируйте код вручную.':'Select and copy the code manually.')}
});
$('recovery-dialog').addEventListener('cancel',e=>e.preventDefault());
$('recovery-saved').addEventListener('change',e=>$('close-recovery').disabled=!e.target.checked);
$('close-recovery').addEventListener('click',()=>{
 if(!$('recovery-saved').checked){showToast(tx('recoveryNotSaved'));return}
 $('recovery-dialog').close();shownRecoveryCode='';text('recovery-code-display','');
});
$('register-form').addEventListener('submit',e=>authenticate('register',e));
$('login-form').addEventListener('submit',e=>authenticate('login',e));
$('grant-form').addEventListener('submit',consent);
$('choose-other-site').addEventListener('click',()=>{
 if(!state.authenticated||busy)return;
 selectingOtherSite=true;$('website-url').value='';$('consent-box').checked=false;render();$('website-url').focus();
});
$('keep-grant').addEventListener('click',()=>{
 selectingOtherSite=false;$('consent-box').checked=false;render();
});
$('copy-diagnosis').addEventListener('click',async()=>{
 const field=$('diagnosis-report');
 if(!state.authenticated||!field.value)return;
 try{await navigator.clipboard.writeText(field.value);text('copy-diagnosis-status',lang==='ru'?'Отчёт скопирован.':'Report copied.')}
 catch{field.focus();field.select();text('copy-diagnosis-status',lang==='ru'?'Выделите и скопируйте отчёт вручную.':'Select and copy the report manually.')}
});
$('run-check').addEventListener('click',runCheck);
$('revoke-grant').addEventListener('click',revoke);
$('delete-account').addEventListener('click',deleteAccount);
$('logout').addEventListener('click',logout);
translate();
const hash=location.hash.replace('#','');
if(['overview','check','permissions','activity','assistants'].includes(hash))page=hash;
refresh();
})();
