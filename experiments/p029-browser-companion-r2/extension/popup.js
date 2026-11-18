'use strict';
const $=id=>document.getElementById(id);
const strings={
 en:{
  eyebrow:'LUCH / BROWSER COMPANION',
  headline:'Share a tab with LUCH.',
  intro:'Connect a page you choose to your authorized LUCH workflow. You decide what LUCH can read and when it can interact.',
  caps:['Read & understand','Navigate pages','Interact with permission','Capture evidence'],
  paired:'Browser paired',notPaired:'Browser not paired',statusScope:'SECURE LUCH CLOUD',
  setupTitle:'Before you connect',
  setupSteps:[
   'Install this LUCH Browser Companion extension in Chrome or Opera.',
   'In your connected LUCH AI, use browser_companion_pairing_create to generate a one-time eight-digit code.',
   'Enter the code here. It expires after ten minutes.'
  ],
  setupBoundary:'Pairing links this browser directly to your LUCH account. Your existing ChatGPT, Claude or other supported AI connection remains the AI host; this extension does not create a second chat or require an OpenAI/Anthropic API key.',
  pairLabel:'One-time pairing code',pairButton:'Connect browser',
  pairHint:'Enter the eight digits returned by browser_companion_pairing_create.',
  localSetup:'How to connect LUCH to your existing AI',help:'Check account & setup requirements',
  tabLabel:'Current tab',grant:'Allow reading on this tab',
  interact:'Allow interaction on this tab',revoke:'Revoke access to this tab',
  disconnect:'Disconnect browser',expired:'No tab access granted',
  read:'LUCH can read this tab',interacting:'LUCH can read and interact with this tab',
  sessionNote:'Access ends when you revoke it, close this tab or the browser session, or navigate to another website origin.',
  hostNote:'This browser is paired to LUCH Cloud. Your existing ChatGPT must separately authorize the LUCH MCP connection.',
  footer:'Only approved tabs are shared. No cookie or browsing-history access. Page content you request may be sent to your authorized AI host.',
  learn:'How browser access works',noTab:'Open a regular website to begin',
  statusUnknown:'Could not check browser status',working:'Checking browser…',
  codeDenied:'That code was not accepted. Request a new code from ChatGPT and try again.',
  codeExpired:'That code has expired or is unavailable. Request a new code in ChatGPT.',
  alreadyPaired:'This browser is already paired. Disconnect first if you need to pair it again.',
  companionOffline:'LUCH cloud is not reachable. Check your internet connection and try again.',
  ordinaryPage:'Open a regular HTTP or HTTPS website before sharing a tab.',
  interactionRequired:'Approve interaction separately before asking LUCH to click or type.',
  tabPermissionRequired:'Approve this exact tab before using it.',
  pairSuccess:'Browser paired securely with LUCH Cloud.',
  readSuccess:'Read access granted for this tab.',
  interactSuccess:'Interaction access granted for this tab.',
  revokeSuccess:'Access revoked for this tab.',
  disconnectSuccess:'Browser disconnected from LUCH.',
  tabsHeading:'Open tabs overview',tabsExplain:'Optional: Chrome will ask permission to read the titles and addresses of all open tabs. Their contents remain private until you separately approve a tab.',
  listTabs:'Show my open tabs',tabSwitch:'Switch to tab',shareTabs:'Let authorized LUCH AI see these tab names and addresses',
  unshareTabs:'Stop sharing the tab overview',tabsShared:'Tab titles and addresses are shared with your authorized LUCH AI. Page contents are not.',
  tabsPrivate:'Only you can see this list until you choose to share it with LUCH.',
  cursorHeading:'Precise on-page pointer',cursorExplain:'Advanced mode. Chrome warns about debugger access when installing this extension. Pointer input remains OFF until you separately approve interaction and enable it for this tab. It is not your computer’s physical mouse.',
  enableCursor:'Enable precise pointer for this tab',disableCursor:'Disable precise pointer',
  cursorNotReady:'Approve interactions on this tab first.',
  permissionDenied:'Chrome permission was not granted.',
  error:'Something went wrong.',codePlaceholder:'12345678'
 },
 ru:{
  eyebrow:'LUCH / BROWSER COMPANION',
  headline:'Подключите вкладку к LUCH.',
  intro:'Подключите выбранную страницу к разрешённому рабочему процессу LUCH. Вы решаете, что можно читать и когда разрешать действия.',
  caps:['Чтение и анализ','Переходы по страницам','Действия с разрешения','Снимки и проверка'],
  paired:'Браузер подключён',notPaired:'Браузер не подключён',statusScope:'ЗАЩИЩЁННЫЙ LUCH CLOUD',
  setupTitle:'Перед подключением',
  setupSteps:[
   'Установите расширение LUCH Browser Companion в Chrome или Opera.',
   'В подключённом ChatGPT вызовите browser_companion_pairing_create, чтобы получить одноразовый восьмизначный код.',
   'Введите код здесь. Код действует десять минут.'
  ],
  setupBoundary:'Сопряжение напрямую связывает этот браузер с вашим аккаунтом LUCH. ChatGPT, Claude или другой поддерживаемый ИИ остаётся вашим существующим хостом. В расширении нет отдельного чата и не требуется API-ключ OpenAI/Anthropic.',
  pairLabel:'Одноразовый код подключения',pairButton:'Подключить браузер',
  pairHint:'Введите восемь цифр, выданных в ChatGPT командой browser_companion_pairing_create.',
  localSetup:'Как подключить LUCH к существующему ИИ',help:'Проверить требования к аккаунту и подключению',
  tabLabel:'Текущая вкладка',grant:'Разрешить чтение этой вкладки',
  interact:'Разрешить действия в этой вкладке',revoke:'Отозвать доступ к вкладке',
  disconnect:'Отключить браузер',expired:'Доступ к вкладке не предоставлен',
  read:'LUCH может читать эту вкладку',interacting:'LUCH может читать и взаимодействовать с вкладкой',
  sessionNote:'Доступ прекращается после отзыва, закрытия вкладки или сеанса браузера либо перехода на другой сайт.',
  hostNote:'Браузер привязан к LUCH Cloud. В существующем ChatGPT требуется отдельное разрешённое подключение LUCH MCP.',
  footer:'Передаются только разрешённые вкладки. Нет доступа к cookie и истории браузера. Запрошенное содержимое страницы может быть передано авторизованному ИИ-клиенту.',
  learn:'Как работает доступ к браузеру',noTab:'Откройте обычный сайт',
  statusUnknown:'Не удалось проверить состояние браузера',working:'Проверка браузера…',
  codeDenied:'Код не принят. Запросите новый код в ChatGPT и повторите попытку.',
  codeExpired:'Срок действия кода истёк. Запросите новый код в ChatGPT.',
  alreadyPaired:'Этот браузер уже привязан. Сначала отключите его для нового сопряжения.',
  companionOffline:'LUCH Cloud недоступен. Проверьте интернет-соединение и повторите попытку.',
  ordinaryPage:'Для доступа откройте обычную страницу HTTP или HTTPS.',
  interactionRequired:'Отдельно разрешите действия, прежде чем просить LUCH нажимать или вводить текст.',
  tabPermissionRequired:'Сначала разрешите доступ именно к этой вкладке.',
  pairSuccess:'Браузер безопасно подключён к LUCH Cloud.',
  readSuccess:'Чтение этой вкладки разрешено.',
  interactSuccess:'Взаимодействие с этой вкладкой разрешено.',
  revokeSuccess:'Доступ к этой вкладке отозван.',
  disconnectSuccess:'Браузер отключён от LUCH.',
  tabsHeading:'Все открытые вкладки',tabsExplain:'Необязательно. Chrome отдельно запросит разрешение видеть названия и адреса всех вкладок. Содержимое страниц останется закрытым, пока вы не разрешите доступ к конкретной вкладке.',
  listTabs:'Показать мои вкладки',tabSwitch:'Перейти к вкладке',shareTabs:'Разрешить моему ИИ через LUCH видеть названия и адреса вкладок',
  unshareTabs:'Перестать передавать обзор вкладок',tabsShared:'Названия и адреса вкладок доступны авторизованному ИИ через LUCH. Содержимое страниц не передаётся.',
  tabsPrivate:'Пока это список только для вас. ИИ не получит его без отдельного разрешения.',
  cursorHeading:'Точный курсор внутри страницы',cursorExplain:'Продвинутый режим. Chrome предупреждает о доступе отладчика при установке расширения. Действия курсора выключены, пока вы отдельно не разрешите их для выбранной вкладки. Это не физическая мышь компьютера.',
  enableCursor:'Включить точный курсор на этой вкладке',disableCursor:'Выключить точный курсор',
  cursorNotReady:'Сначала разрешите действия на этой вкладке.',
  permissionDenied:'Разрешение Chrome не предоставлено.',
  error:'Произошла ошибка.',codePlaceholder:'12345678'
 }
};
let lang=(localStorage.getItem('luch_locale')||((navigator.language||'en').toLowerCase().startsWith('ru')?'ru':'en'));
if(!strings[lang])lang='en';
const t=key=>strings[lang][key];
function setTexts(){
 document.documentElement.lang=lang;
 const map={
  'eyebrow':'eyebrow','headline':'headline','intro':'intro',
  'setup-title':'setupTitle','setup-boundary':'setupBoundary',
  'pair-label':'pairLabel','pair':'pairButton','pair-hint':'pairHint',
  'help':'help','grant':'grant','interact':'interact','revoke':'revoke',
  'disconnect':'disconnect','tab-label':'tabLabel','footer':'footer',
  'scope':'statusScope','session-note':'sessionNote','host-note':'hostNote',
  'learn':'learn',
  'tabs-heading':'tabsHeading','tabs-explain':'tabsExplain','list-tabs':'listTabs',
  'share-tabs':'shareTabs','unshare-tabs':'unshareTabs','cursor-heading':'cursorHeading',
  'cursor-explain':'cursorExplain','enable-cursor':'enableCursor','disable-cursor':'disableCursor'
 };
 for(const [id,key] of Object.entries(map))$(id).textContent=t(key);
 const steps=$('setup-steps');steps.replaceChildren();
 for(const value of t('setupSteps')){const item=document.createElement('li');item.textContent=value;steps.appendChild(item)}
 ['read','navigate','interact','capture'].forEach((key,index)=>$('cap-'+key).textContent=t('caps')[index]);
 $('pairCode').placeholder=t('codePlaceholder');
 $('pairCode').setAttribute('aria-label',t('pairLabel'));
 $('local-setup').textContent=t('localSetup');
 $('local-setup').href=(lang==='ru'?'https://github.com/lenar2/luch/blob/main/docs/CHATGPT_CONNECT.ru.md':'https://github.com/lenar2/luch/blob/main/docs/CHATGPT_CONNECT.md');
 $('help').href='https://luch.lenarsalimov.ru/'+(lang==='ru'?'ru':'en')+'/connect/';
 $('learn').href='https://luch.lenarsalimov.ru/'+(lang==='ru'?'ru':'en')+'/browser/';
 $('locale').value=lang;
}
function call(message){return chrome.runtime.sendMessage(message).then(r=>{if(!r?.ok)throw new Error(r?.error||t('error'));return r})}
function friendlyError(value){
 const raw=String(value||t('error'));
 const code=raw.toUpperCase();
 if(code.includes('PAIRING_DENIED'))return t('codeDenied');
 if(code.includes('PAIRING_UNAVAILABLE'))return t('codeExpired');
 if(code.includes('ALREADY_PAIRED'))return t('alreadyPaired');
 if(code.includes('FAILED TO FETCH')||code.includes('NETWORKERROR')||code.includes('ABORTERROR')||code.includes('BROKER_UNREACHABLE'))return t('companionOffline');
 if(code.includes('OPEN AN ORDINARY WEBPAGE'))return t('ordinaryPage');
 if(code.includes('INTERACTION_APPROVAL_REQUIRED'))return t('interactionRequired');
 if(code.includes('USER_TAB_PERMISSION_REQUIRED'))return t('tabPermissionRequired');
 return raw.slice(0,180);
}
async function refresh(){
 try{
  const r=await call({op:'status'});
  $('pairing').hidden=r.connected;$('controls').hidden=!r.connected;
  $('status').textContent=r.connected?t('paired'):t('notPaired');
  $('scope').textContent=t('statusScope');
  $('dot').classList.toggle('connected',r.connected);
  $('currentTab').textContent=r.tab?.title||t('noTab');
  $('currentUrl').textContent=r.tab?.url||'';
  $('shareStatus').textContent=!r.granted?t('expired'):(r.scope==='interact'?t('interacting'):t('read'));
  $('grant').hidden=!!r.granted;$('grant').disabled=!r.tab;
  $('interact').hidden=!r.granted||r.scope==='interact';
  $('revoke').hidden=!r.granted;
  $('pair').disabled=$('pairCode').value.length!==8;
  $('enable-cursor').hidden=!!r.preciseCursor;
  $('enable-cursor').disabled=!(r.granted&&r.scope==='interact');
  $('disable-cursor').hidden=!r.preciseCursor;
  $('share-tabs').hidden=!!r.tabOverviewSharing;
  $('unshare-tabs').hidden=!r.tabOverviewSharing;
  $('tabs-sharing-state').textContent=r.tabOverviewSharing?t('tabsShared'):t('tabsPrivate');
 }catch(e){
  $('pairing').hidden=false;$('controls').hidden=true;
  $('status').textContent=t('statusUnknown');$('scope').textContent=t('statusScope');
  $('dot').classList.remove('connected');
  $('feedback').textContent=friendlyError(e.message);
 }
}
function act(id,make){
 $(id).addEventListener('click',async()=>{
  const button=$(id);button.disabled=true;
  try{
   $('feedback').textContent='';
   await call(make());
   const success={pair:'pairSuccess',grant:'readSuccess',interact:'interactSuccess',revoke:'revokeSuccess',disconnect:'disconnectSuccess'};
   $('feedback').textContent=t(success[id]);
   if(id==='pair')$('pairCode').value='';
   await refresh();
  }catch(e){$('feedback').textContent=friendlyError(e.message);await refresh()}
  finally{button.disabled=id==='pair'&&$('pairCode').value.length!==8}
 });
}
$('locale').addEventListener('change',event=>{
 lang=event.target.value;localStorage.setItem('luch_locale',lang);setTexts();refresh();
});
$('pairCode').addEventListener('input',()=>{
 const clean=$('pairCode').value.replace(/[^0-9]/g,'').slice(0,8);
 if($('pairCode').value!==clean)$('pairCode').value=clean;
 $('pair').disabled=clean.length!==8;
});
$('pairCode').addEventListener('keydown',event=>{
 if(event.key==='Enter'&&!$('pair').disabled)$('pair').click();
});
act('pair',()=>({op:'pair',code:$('pairCode').value.trim()}));
act('grant',()=>({op:'grant-active'}));
act('interact',()=>({op:'allow-interaction'}));
act('revoke',()=>({op:'revoke-active'}));
act('disconnect',()=>({op:'disconnect'}));
const showTabList=tabs=>{
 const list=$('tab-list');list.replaceChildren();
 for(const tab of tabs){
  const li=document.createElement('li'),heading=document.createElement('strong'),
   url=document.createElement('small'),switcher=document.createElement('button');
  heading.textContent=tab.title||tab.url;url.textContent=tab.url;
  switcher.type='button';switcher.className='tab-switch';switcher.textContent=t('tabSwitch');
  switcher.addEventListener('click',async()=>{
   switcher.disabled=true;
   try{await call({op:'activate-open-tab',tabId:tab.id});$('feedback').textContent=t('tabPermissionRequired');await refresh()}
   catch(e){$('feedback').textContent=friendlyError(e.message);switcher.disabled=false}
  });
  li.append(heading,url,switcher);list.append(li);
 }
 $('tab-list-wrap').hidden=false;
 $('tabs-sharing-state').textContent=t('tabsPrivate');
};
$('list-tabs').addEventListener('click',async()=>{
 try{
  const granted=await chrome.permissions.request({permissions:['tabs']});
  if(!granted)throw new Error(t('permissionDenied'));
  const result=await call({op:'list-open-tabs'});
  showTabList(result.tabs);
  await refresh();
 }catch(e){$('feedback').textContent=friendlyError(e.message)}
});
$('share-tabs').addEventListener('click',async()=>{
 try{await call({op:'share-tab-overview',enabled:true});await refresh()}
 catch(e){$('feedback').textContent=friendlyError(e.message)}
});
$('unshare-tabs').addEventListener('click',async()=>{
 try{await call({op:'share-tab-overview',enabled:false});await refresh()}
 catch(e){$('feedback').textContent=friendlyError(e.message)}
});
$('enable-cursor').addEventListener('click',async()=>{
 try{
  await call({op:'precise-cursor',enabled:true});await refresh();
 }catch(e){$('feedback').textContent=friendlyError(e.message)}
});
$('disable-cursor').addEventListener('click',async()=>{
 try{await call({op:'precise-cursor',enabled:false});await refresh()}
 catch(e){$('feedback').textContent=friendlyError(e.message)}
});

setTexts();$('status').textContent=t('working');refresh();
setInterval(refresh,10000);
