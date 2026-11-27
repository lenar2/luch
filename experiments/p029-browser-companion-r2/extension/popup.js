'use strict';
const $=id=>document.getElementById(id);
const strings={
 en:{
  eyebrow:'LUCH / BROWSER COMPANION',
  headline:'Your AI can do more in the browser.',
  intro:'Give your AI access to work with pages, find what matters, and help you finish tasks. You decide when it can act.',
  headlineConnected:'One step from getting things done.',introConnected:'All ordinary browser tabs are available after pairing. No per-tab or per-action confirmations in LUCH.',
  offline:'Waiting for cloud connection',offlineScope:'RECONNECTING',offlineTab:'Your tab approval is saved. Actions will resume after reconnection.',
  advancedTitle:'More options · tab overview & precise pointer',
  revokePending:'Access to this tab is stopped on your device. Cloud sync will retry when online.',
  disconnectPending:'Access ended on this device. When online, also revoke this browser in your AI to invalidate the cloud token.',
  caps:['Read & understand','Navigate pages','Interact with permission','Capture evidence'],
  paired:'Browser paired',notPaired:'Browser not paired',statusScope:'SECURE LUCH CLOUD',
  tabCapacityError:'Browser has more than 500 web tabs. Close some tabs to resume automatic coverage. Existing grants are still active.',
  setupTitle:'Connect LUCH to your AI',
  setupSteps:[
   'Open LUCH in the AI chat you already use.',
   'Ask the AI for a browser connection code.',
   'Enter the eight-digit code here within ten minutes.'
  ],
  setupBoundary:'Your AI must support custom MCP connections for LUCH to work. You stay in your familiar chat — no second chat or personal API key.',
  pairLabel:'One-time pairing code',pairButton:'Connect browser',
  pairHint:'Ask your connected AI chat: “Create a browser pairing code.” It is valid for 10 minutes.',
  localSetup:'How to connect LUCH to your existing AI',help:'Check account & setup requirements',
  tabLabel:'Current tab',grant:'Allow reading on this tab',
  interact:'Resume browser control',revoke:'Pause browser control',
  disconnect:'Disconnect browser',expired:'No tab access granted',
  read:'LUCH can read this tab',interacting:'LUCH can read and interact with this tab',
  sessionNote:'Full control remains active until you pause or disconnect it. Chrome permissions can also be revoked in browser settings.',
  hostNote:'In your connected AI chat, ask: “Read my approved tab.” If LUCH is not connected to your AI yet, follow the setup guide.',
  footer:'Nothing happens without your permission. LUCH does not ask for your browser history or cookies.',
  learn:'How browser access works',noTab:'Open a regular website to begin',
  statusUnknown:'Could not check browser status',working:'Checking browser…',
  codeDenied:'That code was not accepted. Request a new code from ChatGPT and try again.',
  codeExpired:'This code has expired or was already used. Ask your AI to create a new code.',
  alreadyPaired:'This browser is already paired. Disconnect first if you need to pair it again.',
  companionOffline:'LUCH cloud is not reachable. Check your internet connection and try again.',
  ordinaryPage:'Open a regular HTTP or HTTPS website before sharing a tab.',
  interactionRequired:'Interaction is available in all ordinary tabs after pairing.',
  tabPermissionRequired:'All ordinary web tabs are available when the browser is paired and active.',
  pairSuccess:'Browser paired securely with LUCH Cloud.',
  readSuccess:'Read access granted for this tab.',
  interactSuccess:'Full browser automation enabled.',
  revokeSuccess:'Browser automation paused.',
  disconnectSuccess:'Browser disconnected from LUCH.',
  tabsHeading:'Open tabs overview',tabsExplain:'All ordinary web tabs are available to your paired AI, including titles and addresses. No per-tab confirmation is required.',
  listTabs:'Show my open tabs',tabSwitch:'Switch to tab',shareTabs:'Let authorized LUCH AI see these tab names and addresses',
  unshareTabs:'Stop sharing the tab overview',tabsShared:'Tab titles and addresses are shared with your authorized LUCH AI. Page contents are not.',
  tabsPrivate:'Only you can see this list until you choose to share it with LUCH.',
  cursorHeading:'Precise on-page pointer',cursorExplain:'Precise pointer and keyboard are available across ordinary web tabs after browser pairing. There is no separate per-tab confirmation. The pointer stays inside webpages.',
  enableCursor:'Enable precise pointer for this tab',disableCursor:'Disable precise pointer',
  cursorNotReady:'Approve interactions on this tab first.',
  permissionKicker:'ONE-TIME SETUP',
  permissionHeading:'Allow LUCH to help you in Chrome',
  permissionDescription:'Chrome grants website, tabs, downloads and debugger access once when installing the extension. No additional confirmation in LUCH:',
  permissionBenefits:['Read open webpages','Click, type and navigate','Work with downloads'],
  permissionFootnote:'Access covers ordinary HTTP(S) tabs until you pause or disconnect. Chrome keeps its own permission controls.',
  readyKicker:'READY TO GO',
  readyHeading:'Your browser is connected',
  readyDescription:'Go back to your AI chat and try your first request:',
  readyPrompt:'Read the open webpage and tell me what matters most.',
  offlineHeading:'Your connection is coming back',
  offlineDescription:'Your browser pairing is saved. LUCH will reconnect automatically when the cloud is available.',
  connectedReadyHeadline:'Everything is ready. Just ask.',
  offlineHeadline:'Connection interrupted. Your setup is safe.',
  offlineIntro:'LUCH is reconnecting. You do not need to connect your account again.',
  connectedReadyIntro:'LUCH is connected. Keep working in the AI chat you already know.',
  fullFooter:'LUCH can access ordinary browser webpages until you pause it. Page information requested by your AI may be shared with that AI.',
  permissionDenied:'Chrome permission was not granted.',
  error:'Something went wrong.',codePlaceholder:'••••••••'
 },
 ru:{
  eyebrow:'LUCH / BROWSER COMPANION',
  headline:'Ваш ИИ может больше в браузере.',
  intro:'Дайте своему ИИ возможность работать со страницами, находить нужное и помогать с задачами. Вы решаете, когда он может действовать.',
  headlineConnected:'Один шаг — и можно поручать дела.',introConnected:'После подключения ИИ доступен весь обычный браузер: без подтверждений для каждой вкладки и действия.',
  offline:'Ожидание подключения к облаку',offlineScope:'НЕТ СВЯЗИ',offlineTab:'Разрешения сохранены. Действия возобновятся после восстановления связи.',
  advancedTitle:'Дополнительно · вкладки и точный курсор',
  revokePending:'На этом устройстве доступ к вкладке закрыт. Синхронизация с облаком повторится после восстановления связи.',
  disconnectPending:'На устройстве доступ отключён. Когда появится связь, дополнительно отзовите это устройство в своём ИИ.',
  caps:['Чтение и анализ','Переходы по страницам','Действия с разрешения','Снимки и проверка'],
  paired:'Браузер подключён',notPaired:'Браузер не подключён',statusScope:'ЗАЩИЩЁННЫЙ LUCH CLOUD',
  tabCapacityError:'В браузере больше 500 веб-вкладок. Закройте часть вкладок для возобновления полного покрытия. Ранее разрешённые вкладки остаются активными.',
  setupTitle:'Соедините LUCH с вашим ИИ',
  setupSteps:[
   'Откройте LUCH в том чате с ИИ, которым уже пользуетесь.',
   'Попросите ИИ создать код подключения браузера.',
   'Введите восемь цифр ниже в течение десяти минут.'
  ],
  setupBoundary:'Нужна поддержка пользовательского MCP в вашем ИИ и тарифе. Вы остаётесь в привычном чате — отдельный чат LUCH и личный API-ключ не нужны.',
  pairLabel:'Одноразовый код подключения',pairButton:'Подключить браузер',
  pairHint:'Попросите свой ИИ: «Создай код подключения браузера». Код действует 10 минут.',
  localSetup:'Как подключить LUCH к существующему ИИ',help:'Проверить требования к аккаунту и подключению',
  tabLabel:'Текущая вкладка',grant:'Разрешить чтение этой вкладки',
  interact:'Возобновить управление браузером',revoke:'Приостановить управление',
  disconnect:'Отключить браузер',expired:'Доступ к вкладке не предоставлен',
  read:'LUCH может читать эту вкладку',interacting:'LUCH может читать и взаимодействовать с вкладкой',
  sessionNote:'Полное управление работает до приостановки или отключения. Разрешения Chrome можно отозвать в настройках браузера.',
  hostNote:'В подключённом ИИ напишите: «Прочитай разрешённую вкладку». Если LUCH ещё не добавлен в ИИ, сначала откройте инструкцию подключения.',
  footer:'Вы управляете доступом. LUCH не запрашивает историю браузера и cookie-файлы.',
  learn:'Как работает доступ к браузеру',noTab:'Откройте обычный сайт',
  statusUnknown:'Не удалось проверить состояние браузера',working:'Проверка браузера…',
  codeDenied:'Код не принят. Запросите новый код в ChatGPT и повторите попытку.',
  codeExpired:'Код устарел или уже использован. Попросите ИИ создать новый.',
  alreadyPaired:'Этот браузер уже привязан. Сначала отключите его для нового сопряжения.',
  companionOffline:'LUCH Cloud недоступен. Проверьте интернет-соединение и повторите попытку.',
  ordinaryPage:'Для доступа откройте обычную страницу HTTP или HTTPS.',
  interactionRequired:'После подключения действия доступны во всех обычных вкладках.',
  tabPermissionRequired:'После подключения доступны все обычные веб-вкладки.',
  pairSuccess:'Браузер безопасно подключён к LUCH Cloud.',
  readSuccess:'Чтение этой вкладки разрешено.',
  interactSuccess:'Полное управление браузером включено.',
  revokeSuccess:'Автоматическое управление приостановлено.',
  disconnectSuccess:'Браузер отключён от LUCH.',
  tabsHeading:'Все открытые вкладки',tabsExplain:'После подключения вашему ИИ доступны все обычные вкладки, их названия и адреса. Отдельных подтверждений для вкладок нет.',
  listTabs:'Показать мои вкладки',tabSwitch:'Перейти к вкладке',shareTabs:'Разрешить моему ИИ через LUCH видеть названия и адреса вкладок',
  unshareTabs:'Перестать передавать обзор вкладок',tabsShared:'Названия и адреса вкладок доступны авторизованному ИИ через LUCH. Содержимое страниц не передаётся.',
  tabsPrivate:'Пока это список только для вас. ИИ не получит его без отдельного разрешения.',
  cursorHeading:'Точный курсор внутри страницы',cursorExplain:'Точный курсор и клавиатура работают на обычных веб-вкладках после подключения браузера. Отдельных подтверждений для каждой вкладки нет.',
  enableCursor:'Включить точный курсор на этой вкладке',disableCursor:'Выключить точный курсор',
  cursorNotReady:'Сначала разрешите действия на этой вкладке.',
  permissionKicker:'ПОСЛЕДНИЙ ШАГ',
  permissionHeading:'Разрешите LUCH помогать в браузере',
  permissionDescription:'Chrome выдаёт доступ к сайтам, вкладкам, загрузкам и отладчику при установке расширения. Дополнительных подтверждений в LUCH не будет:',
  permissionBenefits:['Читать веб-страницы','Нажимать, вводить текст и переходить','Работать со скачиваниями'],
  permissionFootnote:'Доступ ко всем обычным веб-вкладкам сохранится до «Приостановить» или «Отключить». Разрешения всегда можно изменить в Chrome.',
  readyKicker:'ВСЁ ГОТОВО',
  readyHeading:'Браузер подключён',
  readyDescription:'Вернитесь в привычный чат с ИИ и попробуйте первое поручение:',
  readyPrompt:'Прочитай открытую страницу и расскажи самое важное.',
  offlineHeading:'Восстанавливаем связь',
  offlineDescription:'Подключение браузера сохранено. LUCH продолжит работу автоматически, когда соединение восстановится.',
  connectedReadyHeadline:'Всё готово. Просто поручайте.',
  offlineHeadline:'Связь прервалась. Настройки сохранены.',
  offlineIntro:'LUCH восстанавливает соединение. Подключать аккаунт заново не нужно.',
  connectedReadyIntro:'LUCH подключён. Продолжайте работу в своём привычном чате с ИИ.',
  fullFooter:'LUCH может работать с обычными веб-вкладками до приостановки доступа. Запрошенные данные страницы могут передаваться вашему ИИ.',
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
  'share-tabs':'shareTabs','unshare-tabs':'unshareTabs',
  'permission-kicker':'permissionKicker','permission-heading':'permissionHeading',
  'permission-description':'permissionDescription','permission-footnote':'permissionFootnote',
  'ready-kicker':'readyKicker','ready-heading':'readyHeading','ready-description':'readyDescription',
  'ready-prompt':'readyPrompt','offline-heading':'offlineHeading','offline-description':'offlineDescription',
  'cursor-heading':'cursorHeading',
  'cursor-explain':'cursorExplain','enable-cursor':'enableCursor','disable-cursor':'disableCursor'
 };
 for(const [id,key] of Object.entries(map))$(id).textContent=t(key);
 const steps=$('setup-steps');steps.replaceChildren();
 for(const value of t('setupSteps')){const item=document.createElement('li');item.textContent=value;steps.appendChild(item)}
 ['read','navigate','interact','capture'].forEach((key,index)=>$('cap-'+key).textContent=t('caps')[index]);
 ['read','action','files'].forEach((key,i)=>$('permission-benefit-'+key).textContent=t('permissionBenefits')[i]);
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
  if(code.includes('BROWSER_WIDE_PERMISSION_REQUIRED')||code.includes('BROWSER_CAPABILITIES_PERMISSION_REQUIRED')||code.includes('ONLY PERMISSIONS SPECIFIED IN THE MANIFEST'))
   return t('permissionDenied');
  if(code.includes('BROWSER_TAB_CAPACITY_EXCEEDED'))return t('tabCapacityError');
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
  $('tab-box').hidden=!r.fullMode;
  $('shareStatus').hidden=!r.fullMode;
  const ready=connected&&online&&r.fullMode,offline=connected&&!online;
  $('headline').textContent=offline?t('offlineHeadline'):(ready?t('connectedReadyHeadline'):(connected?t('headlineConnected'):t('headline')));
  $('intro').textContent=offline?t('offlineIntro'):(ready?t('connectedReadyIntro'):(connected?t('introConnected'):t('intro')));
  $('permission-explainer').hidden=true;
  $('ready-card').hidden=!ready;
  $('offline-card').hidden=!connected||online;
  $('footer').textContent=r.fullMode?t('fullFooter'):t('footer');
  $('status').textContent=!connected?t('notPaired'):(online?t('paired'):t('offline'));
  $('scope').textContent=online?t('statusScope'):(connected?t('offlineScope'):t('statusScope'));
  $('dot').classList.toggle('connected',online);
  $('dot').classList.toggle('offline',connected&&!online);
  $('connection').classList.toggle('offline',connected&&!online);
  $('currentTab').textContent=r.tab?.title||t('noTab');
  $('currentUrl').textContent=r.tab?.url||'';
  $('shareStatus').textContent=!online&&connected?t('offlineTab'):(r.fullMode?t('interacting'):t('expired'));
  if(r.fullModeError) $('feedback').textContent=t('tabCapacityError');
  else if($('feedback').textContent===t('tabCapacityError'))$('feedback').textContent='';
  $('grant').hidden=true;
  $('interact').hidden=!!r.fullMode;$('interact').disabled=!online;
  $('revoke').hidden=!r.fullMode;
  $('pair').disabled=$('pairCode').value.length!==8;
  $('enable-cursor').hidden=true;
  $('enable-cursor').disabled=!online||!(r.granted&&r.scope==='interact');
  $('disable-cursor').hidden=true;$('disable-cursor').disabled=true;
  $('list-tabs').disabled=!online;
  $('share-tabs').disabled=!online;$('unshare-tabs').disabled=!online;
  $('share-tabs').hidden=true;
  $('unshare-tabs').hidden=true;
  $('tabs-sharing-state').textContent=r.tabOverviewSharing?t('tabsShared'):t('tabsPrivate');
 }catch(e){
  document.body.classList.remove('is-connected');
  $('pairing').hidden=false;$('controls').hidden=true;
  $('permission-explainer').hidden=true;$('ready-card').hidden=true;$('offline-card').hidden=true;
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
act('interact',()=>({op:'enable-full'}));
act('revoke',()=>({op:'disable-full'}));
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
   try{await call({op:'activate-open-tab',tabId:tab.id});$('feedback').textContent='';await refresh()}
   catch(e){$('feedback').textContent=friendlyError(e.message);switcher.disabled=false}
  });
  li.append(heading,url,switcher);list.append(li);
 }
 $('tab-list-wrap').hidden=false;
 $('tabs-sharing-state').textContent=t('tabsShared');
};
$('list-tabs').addEventListener('click',async()=>{
 try{
  const result=await call({op:'list-open-tabs'});
  showTabList(result.tabs);
  await refresh();
 }catch(e){$('feedback').textContent=friendlyError(e.message)}
});

setTexts();$('status').textContent=t('working');refresh();
setInterval(refresh,10000);
