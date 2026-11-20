'use strict';
/* BF2026 R163 Lot12 interactive trial checkout. Trusted price+provider only.
   Never invent a payment link or fall back to incorrect native single-offer widgets. */
(()=>{
 if(location.hostname!=='wf.tati-lar.ru'||window.parent===window)return;
 const scope=document.querySelector('#lot-10-set');
 const button=scope?.querySelector('#submit');
 const hint=scope?.querySelector('#hint');
 if(!button||!hint)return;
 button.textContent='Оформить заказ';
 hint.textContent='Выбери от 2 до 7 программ, чтобы оформить выбранный сет.';
 const fmt=v=>new Intl.NumberFormat('ru-RU').format(v)+' ₽';
 const api='/api/checkout/lot12/';
 const flow={selection:null,quote:null,nonce:null,busy:false};
 const form=document.createElement('form');
 form.id='bf163-order-trial';
 form.hidden=true;
 form.noValidate=true;
 form.style.cssText='margin:16px auto 0;max-width:540px;padding:18px 17px 16px;border:1px solid #d7bc8b;border-radius:18px;background:rgba(255,248,237,.95);box-sizing:border-box;text-align:left';
 const label=document.createElement('label');
 label.textContent='Email для оформления заказа в GetCourse';
 label.style.cssText='display:block;font:600 15px/1.5 Manrope,sans-serif;color:#523a28;margin-bottom:8px';
 const email=document.createElement('input');
 email.type='email';email.required=true;email.autocomplete='email';email.name='email';
 email.placeholder='Ваш email';
 email.style.cssText='display:block;width:100%;box-sizing:border-box;padding:13px;border:1px solid #cab28e;border-radius:10px;font:16px Manrope,sans-serif;background:white;color:#372b23';
 label.appendChild(email);
 const consent=document.createElement('label');
 consent.style.cssText='display:flex;gap:9px;margin:12px 0 15px;font:13px/1.4 Manrope,sans-serif;color:#584c42;align-items:flex-start';
 const agree=document.createElement('input');agree.type='checkbox';agree.required=true;agree.style.marginTop='3px';
 const consentText=document.createElement('span');
 consentText.textContent='Согласен(на) с условиями оформления заказа и обработкой данных для покупки.';
 consent.append(agree,consentText);
 const pay=document.createElement('button');pay.type='submit';
 pay.textContent='Создать заказ';
 pay.style.cssText='display:block;width:100%;padding:13px;border:0;border-radius:10px;background:#7d563c;color:white;font:600 17px Cormorant Garamond,serif;cursor:pointer';
 const message=document.createElement('p');message.setAttribute('role','status');
 message.style.cssText='font:13px/1.6 Manrope,sans-serif;color:#784d35;margin:10px 0 0';
 form.append(label,consent,pay,message);
 button.insertAdjacentElement('afterend',form);
 function notice(txt){hint.classList.add('show');hint.textContent=txt;message.textContent=txt}
 async function post(name,value){
  const response=await fetch(api+name,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(value),credentials:'same-origin',cache:'no-store'});
  let json;try{json=await response.json()}catch{throw Error('GETCOURSE_RESPONSE_UNAVAILABLE')}
  return {status:response.status,json};
 }
 const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const sha=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 function build(){
  const q=window.BF2026SetQuote?.getSnapshot?.();
  if(!q||q.pricing_version!=='BF2026_LOT12_CUSTOM_SET_R153'||!Array.isArray(q.components)||q.count<2||q.count>7)return null;
  const selection={kind:'set',items:q.components.map(x=>x.key)};
  const source=q.components.find(x=>x.key==='source');
  if(source)selection.source_variant=String(source.variant);
  return {q,selection};
 }
 button.addEventListener('click',async event=>{
  event.preventDefault();event.stopImmediatePropagation();
  if(flow.busy)return;
  const pair=build();if(!pair){notice('Выбери от 2 до 7 совместимых программ.');return}
  flow.busy=true;button.disabled=true;button.textContent='Проверяем сумму…';
  try{
   const result=await post('plan',pair.selection);
   if(result.status!==200||result.json.ok!==true||result.json.quote.total_rub!==pair.q.total_rub||
      result.json.quote.count!==pair.q.count)throw Error('PRICE_NOT_VERIFIED');
   flow.selection=pair.selection;flow.quote=result.json;flow.nonce=null;
   form.hidden=false;message.textContent='';
   notice('Стоимость подтверждена сервером: '+fmt(result.json.quote.total_rub)+'. Введите email для создания заказа в GetCourse.');
   email.focus();
  }catch(e){notice('Не удалось подтвердить сумму сета на сервере. Заказ не отправлен.')}
  finally{flow.busy=false;button.disabled=false;button.textContent='Оформить заказ'}
 },true);
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();
  if(flow.busy)return;
  if(!email.validity.valid){notice('Введите правильный email для оформления заказа.');email.focus();return}
  if(!agree.checked){notice('Для оформления заказа необходимо согласие с условиями.');return}
  if(!flow.selection||!flow.quote){notice('Сначала нажмите «Оформить заказ».');return}
  const pair=build();
  if(!pair||JSON.stringify(pair.selection)!==JSON.stringify(flow.selection)||pair.q.total_rub!==flow.quote.quote.total_rub){
   form.hidden=true;flow.quote=null;notice('Состав сета изменился. Нажми «Оформить заказ» ещё раз для подтверждения суммы.');return;
  }
  flow.busy=true;pay.disabled=true;pay.textContent='Создаём заказ…';
  try{
   if(!flow.nonce){const b=crypto.getRandomValues(new Uint8Array(32));flow.nonce=btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
   const revision=await sha(flow.quote.native_plan.plan_sha256);
   const idempotencyKey=await sha(email.value.trim().toLowerCase()+':'+flow.nonce);
   const result=await post('start',{selection:flow.selection,email:email.value.trim(),
     nonce:flow.nonce,offerRevisionSha256:revision,idempotencyKey});
   const url=result.json.checkout_url;
   if(result.status===200&&result.json.ok===true&&result.json.provider_verified===true&&
      result.json.public_release_allowed===true&&result.json.order_total_rub===flow.quote.quote.total_rub&&
      typeof url==='string'&&/^https:\/\/(?:study\.shkola-dnv\.com|singleladiesschool\.getcourse\.ru)\//.test(url)){
    notice('Заказ создан. Открываем страницу оплаты GetCourse…');
    window.top.location.assign(url);return;
   }
   notice('GetCourse пока не создал подтверждённый заказ. Оплата не открыта; выбранный сет и сумма сохранены в форме.');
  }catch(e){notice('Не удалось получить подтверждение от GetCourse. Платёж не создан. Попробуйте позже.')}
  finally{flow.busy=false;pay.disabled=false;pay.textContent='Создать заказ'}
 });
})();
