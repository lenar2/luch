'use strict';
const $=id=>document.getElementById(id);
const strings={
 en:{
  eyebrow:'LUCH / BROWSER COMPANION',
  headline:'Connect Chrome to your AI.',
  intro:'Let your supported AI understand a page only after you approve it here. Clicks and typing need a second permission.',
  headlineConnected:'Your tab. Your choice.',introConnected:'Share this page with your AI, or keep it private. Other tabs stay closed.',
  offline:'Waiting for cloud connection',offlineScope:'RECONNECTING',offlineTab:'Your tab approval is saved. Actions will resume after reconnection.',
  advancedTitle:'More options · tab overview & precise pointer',
  revokePending:'Access to this tab is stopped on your device. Cloud sync will retry when online.',
  disconnectPending:'Access ended on this device. When online, also revoke this browser in your AI to invalidate the cloud token.',
  caps:['Read & understand','Navigate pages','Interact with permission','Capture evidence'],
  paired:'Browser paired',notPaired:'Browser not paired',statusScope:'SECURE LUCH CLOUD',
  setupTitle:'Connect in three steps',
  setupSteps:[
   'Connect LUCH in your existing supported AI using the setup link below.',
   'Ask your AI: Create a browser pairing code. Approve the request.',
   'Enter the eight-digit code here within ten minutes.'
  ],
  setupBoundary:'Your AI must support custom MCP connections for LUCH to work. You stay in your existing AI chat; there is no second LUCH chat and no personal model API key.',
  pairLabel:'One-time pairing code',pairButton:'Connect browser',
  pairHint:'The code comes from your own AI chat. Never share it in messages to others.',
  localSetup:'How to connect LUCH to your existing AI',help:'Check account & setup requirements',
  tabLabel:'Current tab',grant:'Allow reading on this tab',
  interact:'Allow interaction on this tab',revoke:'Revoke access to this tab',
  disconnect:'Disconnect browser',expired:'No tab access granted',
  read:'LUCH can read this tab',interacting:'LUCH can read and interact with this tab',
  sessionNote:'Access ends when you revoke it, close this tab or the browser session, or navigate to another website origin.',
  hostNote:'In your connected AI chat, ask: “Read my approved tab.” If LUCH is not connected to your AI yet, follow the setup guide.',
  footer:'Only approved tabs are shared. No cookie or browsing-history access. Page content you request may be sent to your authorized AI host.',
  learn:'How browser access works',noTab:'Open a regular website to begin',
  statusUnknown:'Could not check browser status',working:'Checking browser…',
  codeDenied:'That code was not accepted. Request a new code from ChatGPT and try again.',
  codeExpired:'This code has expired or was already used. Ask your AI to create a new code.',
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
  cursorHeading:'Precise on-page pointer',cursorExplain:'Advanced mode. Chrome requests the optional debugger permission only if you enable this feature. Interaction and pointer access are separate choices for this tab. This is not your computer’s physical mouse.',
  enableCursor:'Enable precise pointer for this tab',disableCursor:'Disable precise pointer',
  cursorNotReady:'Approve interactions on this tab first.',
  permissionDenied:'Chrome permission was not granted.',
  error:'Something went wrong.',codePlaceholder:'••••••••'
 },
 ru:{
  eyebrow:'LUCH / BROWSER COMPANION',
  headline:'Подключите Chrome к своему ИИ.',
  intro:'Совместимый ИИ сможет понимать выбранную страницу только после вашего разрешения. Нажатия и ввод текста разрешаются отдельно.',
  headlineConnected:'Вы решаете, что видит ИИ.',introConnected:'Разрешите эту вкладку для чтения или оставьте её закрытой. Остальные вкладки не затрагиваются.',
  offline:'Ожидание подключения к облаку',offlineScope:'НЕТ СВЯЗИ',offlineTab:'Разрешения сохранены. Действия возобновятся после восстановления связи.',
  advancedTitle:'Дополнительно · вкладки и точный курсор',
  revokePending:'На этом устройстве доступ к вкладке закрыт. Синхронизация с облаком повторится после восстановления связи.',
  disconnectPending:'На устройстве доступ отключён. Когда появится связь, дополнительно отзовите это устройство в своём ИИ.',
  caps:['Чтение и анализ','Переходы по страницам','Действия с разрешения','Снимки и проверка'],
  paired:'Браузер подключён',notPaired:'Браузер не подключён',statusScope:'ЗАЩИЩЁННЫЙ LUCH CLOUD',
  setupTitle:'Подключение за три шага',
  setupSteps:[
   'Подключите LUCH в привычном совместимом ИИ по инструкции ниже.',
   'Напишите ИИ: «Создай код подключения браузера». Разрешите этот запрос.',
   'Введите восемь цифр здесь в течение десяти минут.'
  ],
  setupBoundary:'Нужна поддержка пользовательского MCP в вашем ИИ и тарифе. Вы остаетесь в привычном чате: отдельный чат LUCH и личный API-ключ не нужны.',
  pairLabel:'Одноразовый код подключения',pairButton:'Подключить браузер',
  pairHint:'Код появится в вашем чате с ИИ. Не отправляйте его другим людям.',
  localSetup:'Как подключить LUCH к существующему ИИ',help:'Проверить требования к аккаунту и подключению',
  tabLabel:'Текущая вкладка',grant:'Разрешить чтение этой вкладки',
  interact:'Разрешить действия в этой вкладке',revoke:'Отозвать доступ к вкладке',
  disconnect:'Отключить браузер',expired:'Доступ к вкладке не предоставлен',
  read:'LUCH может читать эту вкладку',interacting:'LUCH может читать и взаимодействовать с вкладкой',
  sessionNote:'Доступ прекращается после отзыва, закрытия вкладки или сеанса браузера либо перехода на другой сайт.',
  hostNote:'В подключённом ИИ напишите: «Прочитай разрешённую вкладку». Если LUCH ещё не добавлен в ИИ, сначала откройте инструкцию подключения.',
  footer:'Передаются только разрешённые вкладки. Нет доступа к cookie и истории браузера. Запрошенное содержимое страницы может быть передано авторизованному ИИ-клиенту.',
  learn:'Как работает доступ к браузеру',noTab:'Откройте обычный сайт',
  statusUnknown:'Не удалось проверить состояние браузера',working:'Проверка браузера…',
  codeDenied:'Код не принят. Запросите новый код в ChatGPT и повторите попытку.',
  codeExpired:'Код устарел или уже использован. Попросите ИИ создать новый.',
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
  cursorHeading:'Точный курсор внутри страницы',cursorExplain:'Продвинутый режим. Только при его включении Chrome запросит дополнительное разрешение отладчика. Действия на вкладке разрешаются отдельно. Это не физическая мышь компьютера.',
  enableCursor:'Включить точный курсор на этой вкладке',disableCursor:'Выключить точный курсор',
  cursorNotReady:'Сначала разрешите действия на этой вкладке.',
  permissionDenied:'Разрешение Chrome не предоставлено.',
  error:'Произошла ошибка.',codePlaceholder:'••••••••'
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
  'learn':'learn','advanced-title':'advancedTitle',
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
 if(code.includes('PAIRING_UNAVAILABLE')||code.includes('PAIRING_CODE_INVALID_OR_EXPIRED'))return t('codeExpired');
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
  const connected=r.connected===true,online=connected&&r.online!==false;
  document.body.classList.toggle('is-connected',connected);
  $('pairing').hidden=connected;$('controls').hidden=!connected;
  $('headline').textContent=connected?t('headlineConnected'):t('headline');
  $('intro').textContent=connected?t('introConnected'):t('intro');
  $('status').textContent=!connected?t('notPaired'):(online?t('paired'):t('offline'));
  $('scope').textContent=online?t('statusScope'):(connected?t('offlineScope'):t('statusScope'));
  $('dot').classList.toggle('connected',online);
  $('dot').classList.toggle('offline',connected&&!online);
  $('connection').classList.toggle('offline',connected&&!online);
  $('currentTab').textContent=r.tab?.title||t('noTab');
  $('currentUrl').textContent=r.tab?.url||'';
  $('shareStatus').textContent=!online&&connected?t('offlineTab'):(!r.granted?t('expired'):(r.scope==='interact'?t('interacting'):t('read')));
  $('grant').hidden=!!r.granted;$('grant').disabled=!r.tab||!online;
  $('interact').hidden=!r.granted||r.scope==='interact';$('interact').disabled=!online;
  $('revoke').hidden=!r.granted;
  $('pair').disabled=$('pairCode').value.length!==8;
  $('enable-cursor').hidden=!!r.preciseCursor;
  $('enable-cursor').disabled=!online||!(r.granted&&r.scope==='interact');
  $('disable-cursor').hidden=!r.preciseCursor;$('disable-cursor').disabled=!online;
  $('list-tabs').disabled=!online;
  $('share-tabs').disabled=!online;$('unshare-tabs').disabled=!online;
  $('share-tabs').hidden=!!r.tabOverviewSharing;
  $('unshare-tabs').hidden=!r.tabOverviewSharing;
  $('tabs-sharing-state').textContent=r.tabOverviewSharing?t('tabsShared'):t('tabsPrivate');
 }catch(e){
  document.body.classList.remove('is-connected');
  $('pairing').hidden=false;$('controls').hidden=true;
  $('status').textContent=t('statusUnknown');$('scope').textContent=t('statusScope');
  $('dot').classList.remove('connected','offline');
  $('connection').classList.remove('offline');
  $('pair').disabled=$('pairCode').value.length!==8;
  $('feedback').textContent=friendlyError(e.message);
 }
}
function act(id,make){
 $(id).addEventListener('click',async()=>{
  const button=$(id);button.disabled=true;
  try{
   $('feedback').textContent='';
   const result=await call(make());
   const success={pair:'pairSuccess',grant:'readSuccess',interact:'interactSuccess',revoke:'revokeSuccess',disconnect:'disconnectSuccess'};
   $('feedback').textContent=id==='revoke'&&result.pendingSync?t('revokePending'):
     id==='disconnect'&&result.cloudRevoked===false?t('disconnectPending'):t(success[id]);
   if(id==='pair')$('pairCode').value='';
   await refresh();
  }catch(e){$('feedback').textContent=friendlyError(e.message);await refresh()}
  finally{if(id==='pair')button.disabled=$('pairCode').value.length!==8;}
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
  // This must run directly after a real click in the popup: requesting
  // powerful debugger access on installation is unnecessary for normal use.
  const approved=await chrome.permissions.request({permissions:['debugger']});
  if(!approved)throw new Error(t('permissionDenied'));
  await call({op:'precise-cursor',enabled:true});await refresh();
 }catch(e){$('feedback').textContent=friendlyError(e.message)}
});
$('disable-cursor').addEventListener('click',async()=>{
 try{await call({op:'precise-cursor',enabled:false});await refresh()}
 catch(e){$('feedback').textContent=friendlyError(e.message)}
});

setTexts();$('status').textContent=t('working');refresh();
setInterval(refresh,10000);
