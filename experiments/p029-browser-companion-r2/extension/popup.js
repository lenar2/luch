'use strict';
const $=id=>document.getElementById(id);
const strings={
 en:{
  connected:'Connected',disconnected:'Not connected',statusScope:'Local LUCH Companion',intro:'Only tabs you explicitly approve are visible to LUCH. Each approval expires in 15 minutes and can be revoked instantly.',
  pairLabel:'One-time pairing code',pairButton:'Connect',pairHint:'Open LUCH Companion on this device to get your pairing code. Never enter a website password here.',help:'How to connect LUCH',
  tabLabel:'Selected browser tab',grant:'Share this tab',revoke:'Revoke access',disconnect:'Disconnect browser',expired:'No access granted to this tab',
  granted:'This tab is shared with LUCH',until:'Permission expires',footer:'No browsing history, cookies or passwords are collected by the extension. Only approved tab content is readable.',
  noTab:'Switch to a normal website tab',error:'Connection error',working:'Checking connection…',blocked:'Local LUCH Companion is not reachable. Check that it is running.'
 },
 ru:{
  connected:'Подключено',disconnected:'Не подключено',statusScope:'Локальный LUCH Companion',intro:'LUCH видит только вкладки, которые вы явно разрешили. Разрешение действует 15 минут; его можно отозвать мгновенно.',
  pairLabel:'Одноразовый код подключения',pairButton:'Подключить',pairHint:'Откройте LUCH Companion на этом устройстве и получите код. Не вводите здесь пароли сайтов.',help:'Как подключить LUCH',
  tabLabel:'Текущая вкладка',grant:'Разрешить вкладку',revoke:'Отозвать доступ',disconnect:'Отключить браузер',expired:'Доступ к этой вкладке не разрешён',
  granted:'Эта вкладка доступна LUCH',until:'Доступ действует до',footer:'Расширение не собирает историю, cookie или пароли. Чтение возможно только для разрешённых вкладок.',
  noTab:'Откройте обычный сайт',error:'Ошибка соединения',working:'Проверка подключения…',blocked:'Локальный LUCH Companion недоступен. Проверьте, что он запущен.'
 }
};
let lang=(localStorage.getItem('luch_locale')||((navigator.language||'en').startsWith('ru')?'ru':'en'));if(!strings[lang])lang='en';
let refreshTimer;
const t=key=>strings[lang][key];
function setTexts(){
 document.documentElement.lang=lang;
 for(const [id,key] of Object.entries({'pair-label':'pairLabel','pair':'pairButton','pair-hint':'pairHint','help':'help','intro':'intro','grant':'grant','revoke':'revoke','disconnect':'disconnect','tab-label':'tabLabel','footer':'footer','scope':'statusScope'}))$(id).textContent=t(key);
 $('help').href='https://luch.lenarsalimov.ru/'+(lang==='ru'?'ru':'en')+'/connect/';
 $('locale').value=lang;
}
function call(message){return chrome.runtime.sendMessage(message).then(r=>{if(!r?.ok)throw new Error(r?.error||t('error'));return r;});}
async function refresh(){
 try{
  const r=await call({op:'status'});
  $('pairing').hidden=r.connected;$('controls').hidden=!r.connected;
  $('status').textContent=r.connected?t('connected'):t('disconnected');
  $('dot').classList.toggle('connected',r.connected);
  $('currentTab').textContent=r.tab?.title||t('noTab');
  $('currentUrl').textContent=r.tab?.url||'';
  $('shareStatus').textContent=r.granted?t('granted'):t('expired');
  $('grant').disabled=!r.tab?.url||r.granted;
  $('revoke').disabled=!r.granted;
  $('expiry').textContent=r.granted?(t('until')+': '+new Date(r.expiresAt).toLocaleTimeString(lang==='ru'?'ru-RU':'en-US')):'';
  if(r.error)$('feedback').textContent=r.error;
 }catch(e){$('feedback').textContent=String(e.message||t('error')).slice(0,240);}
}
function act(btn,make){$(btn).addEventListener('click',async()=>{
 const button=$(btn);button.disabled=true;
 try{$('feedback').textContent='';const r=await call(make());$('feedback').textContent=r.message||'';await refresh();}
 catch(e){$('feedback').textContent=String(e.message||e).slice(0,240);await refresh();}
 finally{button.disabled=false;}
});}
$('locale').addEventListener('change',ev=>{lang=ev.target.value;localStorage.setItem('luch_locale',lang);setTexts();refresh();});
act('pair',()=>({op:'pair',code:$('pairCode').value.trim()}));
act('grant',()=>({op:'grant-active'}));
act('revoke',()=>({op:'revoke-active'}));
act('disconnect',()=>({op:'disconnect'}));
setTexts();$('status').textContent=t('working');refresh();
refreshTimer=setInterval(refresh,10000);
