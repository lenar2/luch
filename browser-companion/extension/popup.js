'use strict';
const $=id=>document.getElementById(id);
function call(message){return chrome.runtime.sendMessage(message).then(r=>{if(!r?.ok)throw new Error(r?.error||'Действие недоступно');return r;});}
async function refresh(){
 try{
  const r=await call({op:'status'});
  $('pairing').hidden=r.connected;$('controls').hidden=!r.connected;
  $('status').textContent=r.connected?'Подключено':'Не подключено';
  $('currentTab').textContent=r.tab?.url?`${r.tab.title||'Страница'}\n${r.tab.url}`:'Откройте сайт во вкладке Chrome';
  $('grant').disabled=!r.tab?.url||r.granted;
  $('revoke').disabled=!r.granted;
  $('expiry').textContent=r.granted?`Доступ до ${new Date(r.expiresAt).toLocaleTimeString()}`:'Эта вкладка не передаёт данные LUCH';
 }catch(e){$('feedback').textContent=e.message;}
}
function act(btn,make){$(btn).addEventListener('click',async()=>{try{$('feedback').textContent='';const result=await call(make());$('feedback').textContent=result.message||'Готово';await refresh();}catch(e){$('feedback').textContent=e.message;}});}
act('pair',()=>({op:'pair',code:$('pairCode').value.trim()}));
act('grant',()=>({op:'grant-active'}));
act('revoke',()=>({op:'revoke-active'}));
act('disconnect',()=>({op:'disconnect'}));
refresh();
