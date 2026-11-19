'use strict';
/* R128 browser preview only. It requests a server challenge; it never posts
 * GetCourse forms, never submits consent booleans, and never starts payment.
 */
(() => {
 if(location.protocol!=='http:'||location.hostname!=='127.0.0.1'||location.port!=='18775')return;
 const snapshot=window.BF2026Cart?.getSnapshot;
 const cart=document.getElementById('cart-panel');
 const pay=cart?.querySelector('.cart-checkout');
 if(typeof snapshot!=='function'||!cart||!pay)return;
 const panel=document.createElement('section');
 panel.id='r128-consent-preview';
 panel.setAttribute('aria-label','Проверка серверной привязки оферты без заказа');
 panel.style.cssText='margin:12px 0;padding:12px;border:1px solid #a99aa8;border-radius:10px;background:#fff;color:#302a32;font:inherit';
 panel.innerHTML='<p style="margin:0 0 8px"><strong>Проверка привязки оферты (без заказа и оплаты)</strong></p>'+
  '<p id="r128-selection" aria-live="polite">Выберите одно предложение.</p>'+
  '<button id="r128-challenge" type="button" disabled aria-disabled="true">Проверить серверную привязку</button>'+
  '<p id="r128-result" role="status" aria-live="polite">Оплата отключена. Проверка согласия GetCourse не подтверждена.</p>'+
  '<small>Клиентская галочка не передаётся как доказательство согласия. Тест не создаёт заказ, оплату или доступ.</small>';
 pay.parentNode.insertBefore(panel,pay);
 const info=document.getElementById('r128-selection');
 const result=document.getElementById('r128-result');
 const button=document.getElementById('r128-challenge');
 let active=null,busy=false,version=0;
 function mappingFor(line){
  if(!line||!Number.isInteger(line.lot))return null;
  const card=document.querySelector('#lot-'+line.lot+' button.buy-lot[data-r128-lot="'+line.lot+'"]');
  if(!card)return null;
  if(line.lot===8)return {hold:true,reason:'Тренер по отношениям остаётся отдельным QA-маршрутом.'};
  let variant=null,route,offer,widget,guard;
  if(line.lot===9){
   variant=String(line.variant||'1');
   if(!['1','2'].includes(variant))return null;
   route=card.getAttribute('data-r128-route-'+variant);
   offer=card.getAttribute('data-r128-offer-'+variant);
   widget=card.getAttribute('data-r128-widget-'+variant);
   guard=card.getAttribute('data-r128-guard-block-'+variant);
  }else{
   route=card.dataset.r128Route;offer=card.dataset.r128Offer;
   widget=card.dataset.r128Widget;guard=card.dataset.r128GuardBlock;
  }
  if(!route||!offer||!widget||!guard||line.display_price_rub!==Number(card.dataset.r128Price))
   return null;
  return {selection:{kind:'single',lot:line.lot,...(variant?{variant}:{})},
   route,offer:Number(offer),widget:Number(widget),guard:Number(guard)};
 }
 function refresh(){
  const run=++version,lines=snapshot().lines||[];
  active=null;button.disabled=true;button.setAttribute('aria-disabled','true');
  if(lines.length!==1){
   info.textContent=lines.length?'Серверная проверка доступна только для одного индивидуального предложения.':'Выберите одно предложение.';
   result.textContent='Наборы и несколько товаров не направляются в этот индивидуальный маршрут.';
   return;
  }
  const line=lines[0],mapping=mappingFor(line);
  if(!mapping){
   info.textContent='Не удалось сверить карточку с существующим GetCourse CTA.';
   result.textContent='HOLD: неизвестное или изменённое соответствие.';
   return;
  }
  if(mapping.hold){
   info.textContent=mapping.reason;
   result.textContent='HOLD: этот виджет не входит в список индивидуальных маршрутов R123.';
   return;
  }
  active={...mapping,price:line.display_price_rub};
  info.textContent='Маршрут '+mapping.route+' · Offer '+mapping.offer+' · Widget '+mapping.widget+' · '+line.display_price_rub+' ₽';
  result.textContent='Готово к запросу серверной проверки. Заказ не создаётся.';
  button.disabled=false;button.setAttribute('aria-disabled','false');
  if(run!==version)active=null;
 }
 button.addEventListener('click',async()=>{
  if(busy||!active)return;
  busy=true;button.disabled=true;button.setAttribute('aria-disabled','true');
  try{
   const s=await fetch('/api/checkout/consent/session',{
    method:'POST',credentials:'same-origin',cache:'no-store'
   });
   if(!s.ok)throw Error('SESSION_HTTP_'+s.status);
   const c=await fetch('/api/checkout/consent/challenge',{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(active.selection)
   });
   const data=await c.json();
   if(!c.ok){
    result.textContent='HOLD: '+String(data.code||'SERVER_HOLD')+'. Заказ и оплата не создавались.';
   }else{
    result.textContent='Сервер выдал одноразовый challenge для Offer '+data.offer_id+
     '. Это только корреляция заказа, не доказательство согласия. Оплата и заказ не запускались.';
   }
  }catch(e){
   result.textContent='HOLD: серверная проверка недоступна. Заказ и оплата не запускались.';
  }finally{busy=false;refresh()}
 });
 const observer=new MutationObserver(refresh);
 observer.observe(cart,{subtree:true,childList:true,attributes:true});
 document.addEventListener('click',e=>{
  if(e.target.closest('button.buy-lot')||e.target.closest('.cart-remove')||
   e.target.closest('.cart-clear'))queueMicrotask(refresh);
 });
 refresh();
})();
