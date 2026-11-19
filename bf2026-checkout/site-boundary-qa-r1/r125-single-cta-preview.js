'use strict';
/*
 * BF2026 R125. Real R109 lot-card buttons -> R124 exact stage-only single-form
 * inspect/prepare. THE PAYMENT BUTTON REMAINS DISABLED. No GetCourse URL.
 * Runs only on local isolated preview origin 127.0.0.1:18771.
 * No QA key, customer personal data or provider credential in frontend.
 */
(() => {
  if(location.protocol!=='http:'||location.hostname!=='127.0.0.1'||location.port!=='18771')return;
  const ROUTES=Object.freeze({
   1:{key:'single:rejection',title:'Исцеление раны отвержения',price:3333,offer:8934973,widget:1686768,pairs:[[4555636,936016494]]},
   2:{key:'single:devaluation',title:'Исцеление раны обесценивания',price:3333,offer:8934925,widget:1686753,pairs:[[4555642,936016504]]},
   3:{key:'single:self',title:'Исцеление страха быть собой',price:3333,offer:8934974,widget:1686770,pairs:[[4557112,936016509]]},
   4:{key:'single:guilt',title:'Исцеление чувства вины',price:3333,offer:8934979,widget:1686767,pairs:[[4557582,936016513]]},
   5:{key:'single:rejection_program',title:'Исцеление отвержения',price:6990,offer:8933492,widget:1686693,pairs:[[4557988,936022301]]},
   6:{key:'single:dnv',title:'Школа для девушек на выданье (ДНВ)',price:7200,offer:8934207,widget:1686740,pairs:[[4550894,583995140]]},
   7:{key:'single:union',title:'Союз нового времени',price:6000,offer:8919715,widget:1686738,pairs:[[4550895,933861292]]},
   8:{key:null,title:'Тренер по отношениям',price:28000,offer:8934247,widget:1686781,pairs:[[4550897,935051957]],hold:'TRAINER_NATIVE_QA_ONLY_NOT_IN_R124'},
   9:{
    title:'ИСТОЧНИК',variants:{
     '1':{key:'single:source:1',price:6000,offer:8934262,widget:1686741,pairs:[[4550889,934905122]]},
     '2':{key:'single:source:2',price:10000,offer:8934987,widget:1686774,pairs:[[4550889,934905122],[4550891,934905123]]}
    }},
   12:{key:'single:personal_zoom',title:'Личная работа',price:80000,offer:8934993,widget:1686776,pairs:[[4559058,null]]}
  });
  const snapshot=window.BF2026Cart?.getSnapshot;
  const container=document.getElementById('cart-panel');
  const existingPay=container?.querySelector('.cart-checkout');
  if(typeof snapshot!=='function'||!container||!existingPay)return;

  const row=document.createElement('section');
  row.id='r125-preview-review';row.setAttribute('aria-label','Проверка формы без оплаты');
  row.style.cssText='margin:12px 0;padding:12px;border:1px solid #b8a9b4;border-radius:10px;background:#fffdfb;color:#393039;font:inherit';
  row.innerHTML='<p style="margin:0 0 8px"><strong>Проверка оформления (без оплаты)</strong></p>'+
   '<p id="r125-route" aria-live="polite" style="margin:4px 0 8px">Выберите одно предложение.</p>'+
   '<label style="display:block;margin:8px 0"><input id="r125-oferta" type="checkbox" required> Я принимаю условия оферты для выбранного предложения.</label>'+
   '<label style="display:block;margin:8px 0"><input id="r125-marketing" type="checkbox"> Хочу получать добровольные рассылки (не обязательно).</label>'+
   '<button id="r125-review" type="button" disabled aria-disabled="true" style="padding:9px 14px;border:1px solid #625764;border-radius:8px">Проверить форму без оплаты</button>'+
   '<p id="r125-review-status" role="status" aria-live="polite" style="margin:8px 0 0">Платёжные ссылки отключены.</p>'+
   '<small>Это изолированная QA-проверка. Отметка в браузере не подтверждает проверку согласия GetCourse. Чек и доступы не подтверждены.</small>';
  existingPay.parentNode.insertBefore(row,existingPay);
  const $=id=>document.getElementById(id);
  const consent=$('r125-oferta'),marketing=$('r125-marketing');
  const review=$('r125-review'),routeInfo=$('r125-route'),status=$('r125-review-status');
  const candidates=[1,2,3,4,5,6,7,8,9,12];
  for(const lot of candidates){
   const card=document.querySelector('#lot-'+lot);
   const button=card?.querySelector('button.buy-lot[data-add="'+lot+'"]');
   const h=card?.querySelector('#lot-title-'+lot);
   if(!card||!button||!h||h.textContent.trim()!==ROUTES[lot].title||
      button.dataset.r125Lot!==String(lot)){
    status.textContent='Ошибка сверки карточек: проверка запрещена.';
    return;
   }
  }
  let active=null,activeKey=null,inspection=null,version=0,loading=false,attemptKey=null;
  const fail=(message)=>{status.textContent=message;review.disabled=true;review.setAttribute('aria-disabled','true');};
  function expect(line){
   if(!line||!Number.isInteger(line.lot)||!ROUTES[line.lot])return null;
   const card=ROUTES[line.lot],part=line.lot===9?card.variants?.[String(line.variant||'1')]:card;
   if(!part||!part.key||line.display_price_rub!==part.price)return null;
   const button=document.querySelector('#lot-'+line.lot+' button.buy-lot');
   if(button?.dataset.r125Offer!==String(part.offer)||
     button.dataset.r125Widget!==String(part.widget))return null;
   return {lot:line.lot,route:part.key,price:part.price,offer:part.offer,widget:part.widget,
    pairs:part.pairs,selection:{kind:'single',lot:line.lot,...(line.lot===9?{variant:String(line.variant||'1')}:{})}};
  }
  function enable(){
   const ready=!loading&&active&&inspection&&consent.checked&&!marketing.checked;
   review.disabled=!ready;
   review.setAttribute('aria-disabled',String(!ready));
  }
  function realMatch(body,item){
   if(!body||body.ok!==true||body.key!==item.route||body.offer_id!==item.offer||
     body.widget_id!==item.widget||body.price_rub!==item.price||
     body.checkout_url!==null||body.public_release_allowed!==false||
     body.fiscal_receipt_verified!==false||body.actual_grants_verified!==false||
     !Array.isArray(body.product_training_pairs))return false;
   const pairs=body.product_training_pairs.map(p=>[p.product_id,p.training_id]);
   return JSON.stringify(pairs)===JSON.stringify(item.pairs);
  }
  async function update(){
   const run=++version;const lines=snapshot().lines;
   active=null;inspection=null;attemptKey=null;activeKey=null;
   consent.checked=false;marketing.checked=false;
   review.disabled=true;review.setAttribute('aria-disabled','true');
   if(lines.length!==1){
    routeInfo.textContent=lines.length?'Для этой проверки выберите ровно одно предложение.':'Выберите одно предложение.';
    status.textContent='Сеты и несколько товаров проверяются отдельно. Реальной оплаты здесь нет.';
    return;
   }
   const lot=lines[0].lot;
   if(lot===8){
    routeInfo.textContent='Тренер по отношениям — отдельная QA-only форма (публичная оплата закрыта).';
    status.textContent='Маршрут R124 для этого предложения не зарегистрирован; подмена запрещена.';
    return;
   }
   const item=expect(lines[0]);
   if(!item){fail('Несовпадение карточки, цены, Offer или Widget — проверка запрещена.');return;}
   active=item;activeKey=JSON.stringify(item);
   routeInfo.textContent=ROUTES[lot].title+' · '+item.price.toLocaleString('ru-RU')+' ₽ · '+item.route;
   status.textContent='Проверяется соответствие серверной форме…';
   try{
    const resp=await fetch('/api/checkout/_qa/single-form/inspect?route='+encodeURIComponent(item.route),{
     credentials:'omit',cache:'no-store',redirect:'error',headers:{Accept:'application/json'}});
    if(!resp.ok)throw Error('READER_NOT_READY');
    const body=await resp.json();
    if(run!==version)return;
    if(!realMatch(body,item))throw Error('NATIVE_MAPPING_MISMATCH');
    inspection=body;
    status.textContent='IDs и цена совпадают. Для теста согласитесь с офертой. Оплата недоступна.';
    enable();
   }catch{if(run===version)fail('Сервер не подтвердил точные Offer/Widget/Training/price. Проверка запрещена.');}
  }
  consent.addEventListener('change',enable);
  marketing.addEventListener('change',()=>{
   enable();
   if(marketing.checked)status.textContent='Согласие на рассылку отдельно; в этой QA-проверке оно должно оставаться выключенным.';
  });
  window.addEventListener('bf2026:cart-updated',()=>{void update()});
  review.addEventListener('click',async()=>{
   if(!active||!inspection||!consent.checked||marketing.checked||loading){enable();return;}
   const now=snapshot().lines;
   if(now.length!==1||JSON.stringify(expect(now[0]))!==activeKey){fail('Состав корзины изменился; повторите проверку.');return;}
   loading=true;enable();
   const key=attemptKey||(attemptKey=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''));
   status.textContent='Сверяем согласие и состав в staging (без оплаты)…';
   try{
    const resp=await fetch('/api/checkout/_qa/single-form/prepare',{
     method:'POST',credentials:'omit',redirect:'error',cache:'no-store',
     headers:{'Content-Type':'application/json','Accept':'application/json',
      'X-BF2026-Idempotency-Key':key},
     body:JSON.stringify({selection:active.selection,consent:{
      oferta_custom_field_id:22204810,oferta_checkbox_checked:consent.checked,
      marketing_checkbox_checked:marketing.checked}})});
    const x=await resp.json();
    if(resp.status!==202||x.ok!==true||
       x.route_key!==active.route||x.widget_id!==active.widget||
       x.offer_id!==active.offer||x.price_rub!==active.price||
       x.fiscal_receipt_verified!==false||x.actual_grants_verified!==false||
       x.provider_side_consent_enforcement_verified!==false||
       x.public_release_allowed!==false||x.checkout_url!==null)
      throw Error('HOLD_CONTRACT_MISMATCH');
    status.textContent=x.duplicate?'Повтор подтверждён: одна QA-запись. Оплата и доступы недоступны.':
      'Состав и ввод согласия проверены сервером. Заказ не создан; оплата и доступы закрыты.';
   }catch{status.textContent='Проверка отклонена сервером. Заказ, оплата и доступы не создавались.';}
   finally{loading=false;enable();}
  });
  Object.defineProperty(window,'BF2026R125Preview',{value:Object.freeze({
   mode:'STAGE_ONLY_NO_PAYMENT',getStatus:()=>({
    route:active?.route||null,inspected:!!inspection,
    consent_checked:consent.checked,marketing_checked:marketing.checked,
    button_disabled:review.disabled,payment_button_disabled:existingPay.disabled,
    public_checkout_enabled:false})}),configurable:false});
  void update();
})();