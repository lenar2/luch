'use strict';
const $=id=>document.getElementById(id);
const strings={
 en:{
  eyebrow:'YOUR BROWSER · YOUR AI',headline:'Put this page to work.',
  intro:'Let the AI you already use explore, understand and work with websites you choose.',
  caps:['Read & understand','Navigate pages','Interact with permission','Capture evidence'],
  connected:'Connected',disconnected:'Not connected',statusScope:'Local LUCH Companion',
  pairLabel:'Pair with your LUCH Companion',pairButton:'Connect',
  pairHint:'Enter the one-time code from the LUCH Companion on this computer. The extension needs a compatible local Companion.',
  help:'How to connect',tabLabel:'Your current tab',grant:'Let LUCH read this tab',
  interact:'Allow interaction on this tab',revoke:'Stop sharing this tab',disconnect:'Disconnect LUCH',
  expired:'Not shared',read:'LUCH can read this tab',interacting:'LUCH can read and interact with this tab',
  sessionNote:'Sharing stays on until you revoke it, close the tab or browser session, or leave this website.',
  footer:'Only approved tabs. No access to cookies or saved passwords.',
  learn:'What LUCH can do',noTab:'Open a website to begin',error:'Connection error',working:'Checking connection…',
  blocked:'Local LUCH Companion is not reachable. Start it before pairing.'
 },
 ru:{
  eyebrow:'ВАШ БРАУЗЕР · ВАШ ИИ',headline:'Дайте ИИ работать с сайтом.',
  intro:'Пусть привычный ИИ изучает сайты, находит нужное и выполняет разрешённые действия в вашем браузере.',
  caps:['Чтение и анализ','Переходы по страницам','Действия с разрешения','Скриншоты и проверка'],
  connected:'Подключено',disconnected:'Не подключено',statusScope:'Локальный LUCH Companion',
  pairLabel:'Подключите LUCH Companion',pairButton:'Подключить',
  pairHint:'Введите одноразовый код из LUCH Companion на этом компьютере. Для работы расширения нужен совместимый локальный Companion.',
  help:'Как подключить',tabLabel:'Текущая вкладка',grant:'Разрешить чтение этой вкладки',
  interact:'Разрешить действия в этой вкладке',revoke:'Закрыть доступ к вкладке',disconnect:'Отключить LUCH',
  expired:'Доступ не предоставлен',read:'LUCH может читать эту вкладку',interacting:'LUCH может читать и взаимодействовать с этой вкладкой',
  sessionNote:'Доступ действует до вашего отзыва, закрытия вкладки или браузера либо перехода на другой сайт.',
  footer:'Только разрешённые вкладки. Без доступа к cookie и сохранённым паролям.',
  learn:'Все возможности LUCH',noTab:'Откройте сайт для начала',error:'Ошибка подключения',working:'Проверка соединения…',
  blocked:'Локальный LUCH Companion недоступен. Запустите его перед подключением.'
 }
};
let lang=(localStorage.getItem('luch_locale')||((navigator.language||'en').startsWith('ru')?'ru':'en'));
if(!strings[lang])lang='en';
const t=key=>strings[lang][key];
function setTexts(){
 document.documentElement.lang=lang;
 const map={'pair-label':'pairLabel','pair':'pairButton','pair-hint':'pairHint','help':'help','intro':'intro',
  'grant':'grant','interact':'interact','revoke':'revoke','disconnect':'disconnect','tab-label':'tabLabel',
  'footer':'footer','scope':'statusScope','eyebrow':'eyebrow','headline':'headline','session-note':'sessionNote','learn':'learn'};
 for(const [id,key] of Object.entries(map))$(id).textContent=t(key);
 ['read','navigate','interact','capture'].forEach((k,i)=>$('cap-'+k).textContent=t('caps')[i]);
 $('help').href='https://luch.lenarsalimov.ru/'+(lang==='ru'?'ru':'en')+'/connect/';
 $('learn').href='https://luch.lenarsalimov.ru/'+(lang==='ru'?'ru':'en')+'/browser/';
 $('locale').value=lang;
}
function call(message){return chrome.runtime.sendMessage(message).then(r=>{if(!r?.ok)throw new Error(r?.error||t('error'));return r})}
async function refresh(){
 try{const r=await call({op:'status'});
  $('pairing').hidden=r.connected;$('controls').hidden=!r.connected;
  $('status').textContent=r.connected?t('connected'):t('disconnected');
  $('dot').classList.toggle('connected',r.connected);
  $('currentTab').textContent=r.tab?.title||t('noTab');
  $('currentUrl').textContent=r.tab?.url||'';
  $('shareStatus').textContent=!r.granted?t('expired'):(r.scope==='interact'?t('interacting'):t('read'));
  $('grant').hidden=!!r.granted;$('interact').hidden=!r.granted||r.scope==='interact';
  $('revoke').hidden=!r.granted;
 }catch(e){$('feedback').textContent=String(e.message||t('error')).slice(0,240)}
}
function act(id,make){$(id).addEventListener('click',async()=>{
 const button=$(id);button.disabled=true;
 try{$('feedback').textContent='';const r=await call(make());$('feedback').textContent=r.message||'';await refresh()}
 catch(e){$('feedback').textContent=String(e.message||e).slice(0,240);await refresh()}
 finally{button.disabled=false}
})}
$('locale').addEventListener('change',ev=>{lang=ev.target.value;localStorage.setItem('luch_locale',lang);setTexts();refresh()});
act('pair',()=>({op:'pair',code:$('pairCode').value.trim()}));
act('grant',()=>({op:'grant-active'}));
act('interact',()=>({op:'allow-interaction'}));
act('revoke',()=>({op:'revoke-active'}));
act('disconnect',()=>({op:'disconnect'}));
setTexts();$('status').textContent=t('working');refresh();
setInterval(refresh,10000);
