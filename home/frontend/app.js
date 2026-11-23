'use strict';
/* LUCH Home R7 — browser UI for a real account-scoped, read-only website workflow.
 * No AI inference, no mock tool results, no private conversation URL, no paid API.
 */
(()=>{
const RU={
skip:'Перейти к содержимому',yourWorkspace:'ВАШЕ ПРОСТРАНСТВО',overview:'Обзор',
websiteCheck:'Проверка сайта',permissions:'Разрешения',activity:'История',assistants:'Помощники',
soon:'Скоро',controlLabel:'Ваш выбор. Ваши разрешения. Проверяемые результаты.',
backSite:'← На сайт LUCH',publicPreview:'ПУБЛИЧНАЯ БЕТА',signOut:'Выйти',
heroEyebrow:'LUCH HOME · ПЕРВОЕ РАБОЧЕЕ ПРОСТРАНСТВО',heroOne:'Ваша задача.',
heroTwo:'Результат, который можно проверить.',
heroLead:'Начните с настоящей проверки сайта. Вы выбираете публичный адрес, видите результат и в любой момент можете отозвать разрешение.',
benefit1:'01 · Выберите сайт',benefit2:'02 · Разрешите проверку',benefit3:'03 · Посмотрите доказательства',
aiComing:'ИИ-помощники пока не подключены. Позже сюда можно добавить SO 6.2, сохранив ваше пространство.',
getStarted:'НАЧАТЬ',publicBeta:'ПУБЛИЧНАЯ БЕТА',createTitle:'Откройте своё пространство.',
createDesc:'Создайте личную учётную запись: ваши разрешения и результаты будут отделены от данных других людей.',
username:'Имя пользователя',password:'Пароль',
uniquePwd:'Используйте уникальный пароль. В бета-версии восстановление через email пока недоступно.',
createAccount:'Создать пространство',existingAccount:'Уже есть аккаунт? Войти',welcomeBack:'С возвращением.',
signInDesc:'Войдите, чтобы продолжить работу со своими разрешениями и проверками.',
signIn:'Войти',newAccount:'Нет аккаунта? Создать',
accountPrivacy:'Не нужны email, банковская карта или API. Храним имя пользователя, защищённый хеш пароля и ваши проверки.',
hello:'Рады видеть вас,',overviewIntro:'Начните с выбранного сайта. LUCH покажет ответ HTTPS-сервера и сведения, которые действительно удалось прочитать.',
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
let state={authenticated:false}, page='overview', busy=false, lastResult=null;
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
function displayResult(r){
 if(!r){$('site-result').hidden=true;$('empty-result').hidden=false;
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
 for(let v of r.observations||[]){const li=document.createElement('li');li.textContent=tx(obs[v]||v);list.append(li)}
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
function render(){
 const signed=Boolean(state.authenticated);
 $('guest').hidden=signed;$('workspace').hidden=!signed;
 $('side-nav').hidden=!signed;$('user-chip').hidden=!signed;$('logout').hidden=!signed;
 document.body.classList.toggle('signed-in',signed);
 if(!signed){$('guest').hidden=false;return}
 text('user-chip',state.username);text('hello-name',state.username);
 const grant=state.grant;
 $('no-grant').hidden=Boolean(grant);$('granted').hidden=!grant;
 $('revoke-grant').hidden=!grant;
 text('current-origin',grant?.origin||'');
 text('permission-title',grant?.origin||(lang==='ru'?RU.noPermission:'No website selected.'));
 text('permission-badge',grant?tx('grantActive'):tx('notGranted'));
 text('stat-permission',grant?tx('grantActive'):tx('notGranted'));
 text('mission-status',grant?grant.origin:tx('notGranted'));
 text('stat-checks',(state.checks||[]).length);
 renderActivity();
 displayResult(lastResult||(state.checks?.[0]?.result||null));
 showPage(page);
}
async function refresh(){
 try{state=await request('state');render()}
 catch(e){showToast(tx('cannotConnect'))}
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
  await refresh();showPage('check');showToast(tx('permissionGranted'));
 }catch(e){reportError('check-feedback',e)}
 finally{setBusy(false)}
}
async function runCheck(){
 if(busy)return;
 text('check-feedback',tx('busy'));setBusy(true);
 try{
  const response=await request('check',{});
  lastResult=response.result;
  await refresh();showPage('check');showToast(tx('checked'));text('check-feedback','');
 }catch(e){reportError('check-feedback',e)}
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
 try{await request('logout',{});state={authenticated:false};page='overview';lastResult=null;render();showToast(tx('signedOut'))}
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
  state={authenticated:false};lastResult=null;page='overview';render();
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
document.querySelectorAll('[data-language]').forEach(x=>x.addEventListener('click',switchLanguage));
document.querySelectorAll('[data-go]').forEach(x=>x.addEventListener('click',()=>showPage(x.dataset.go)));
$('show-login').addEventListener('click',()=>toggleAuth(true));
$('show-register').addEventListener('click',()=>toggleAuth(false));
$('show-recovery').addEventListener('click',toggleRecovery);
$('recovery-back').addEventListener('click',()=>toggleAuth(true));
$('recovery-form').addEventListener('submit',recoverPassword);
$('rotate-recovery').addEventListener('click',rotateRecovery);
document.querySelectorAll('[data-login-shortcut]').forEach(b=>b.addEventListener('click',()=>{
 toggleAuth(true);$('auth-card').scrollIntoView({behavior:'smooth',block:'start'})
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
$('run-check').addEventListener('click',runCheck);
$('revoke-grant').addEventListener('click',revoke);
$('delete-account').addEventListener('click',deleteAccount);
$('logout').addEventListener('click',logout);
translate();
const hash=location.hash.replace('#','');
if(['overview','check','permissions','activity','assistants'].includes(hash))page=hash;
refresh();
})();
