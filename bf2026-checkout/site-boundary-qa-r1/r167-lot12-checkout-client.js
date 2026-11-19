'use strict';
/* BF2026 R167 Lot12 full native checkout form, owner-authorized order submission.
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
 const form=document.createElement('section');
 form.id='bf167-order';form.hidden=true;
 form.innerHTML=
  '<div class="bf167-divider"><span>Завершение заказа</span></div>'+
  '<div class="bf167-heading"><span class="bf167-seal" aria-hidden="true">✦</span><div><h3>Почти готово</h3><p>Укажи данные, чтобы получить доступ после оплаты</p></div></div>'+
  '<form id="bf167-form" novalidate autocomplete="on">'+
  '<div class="bf167-fields">'+
  '<label for="bf167-email">Электронная почта <em>*</em></label><input id="bf167-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" maxlength="160" required>'+
  '<label for="bf167-name">Твоё имя <em>*</em></label><input id="bf167-name" name="name" type="text" autocomplete="name" placeholder="Как к тебе обращаться" maxlength="120" minlength="2" required>'+
  '<label for="bf167-phone">Номер телефона <em>*</em></label><input id="bf167-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 999 123-45-67" maxlength="35" required></div>'+
  '<div class="bf167-consents">'+
  '<label><input type="checkbox" name="offer" required><span>Я согласна с <a href="https://study.shkola-dnv.com/oferta" target="_blank" rel="noopener noreferrer">условиями оферты</a></span></label>'+
  '<label><input type="checkbox" name="privacy" required><span>Согласна на обработку данных для оформления заказа и предоставления доступа</span></label></div>'+
  '<p id="bf167-status" role="status" aria-live="polite"></p>'+
  '<button class="bf167-pay" type="submit">Оформить и перейти к оплате ↗</button>'+
  '<p class="bf167-note">Заказ и оплата проходят через GetCourse. Мы не запрашиваем данные банковской карты.</p></form>';
 const inner=form.querySelector('form');
 const email=inner.elements.namedItem('email'),name=inner.elements.namedItem('name');
 const phone=inner.elements.namedItem('phone'),agree=inner.elements.namedItem('offer'),privacy=inner.elements.namedItem('privacy');
 const pay=inner.querySelector('.bf167-pay'),message=inner.querySelector('#bf167-status');
 button.insertAdjacentElement('afterend',form);
 function notice(txt){if(form.hidden){hint.classList.add('show');hint.textContent=txt}else{hint.classList.remove('show');message.textContent=txt}}
 async function post(name,value){
  const response=await fetch(api+name,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(value),credentials:'same-origin',cache:'no-store'});
  let json;try{json=await response.json()}catch{throw Error('GETCOURSE_RESPONSE_UNAVAILABLE')}
  return {status:response.status,json};
 }
 const hex=b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');

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
   form.hidden=false;button.hidden=true;message.textContent='';
   notice('Стоимость подтверждена сервером: '+fmt(result.json.quote.total_rub)+'. Введите email для создания заказа в GetCourse.');
   email.focus();
  }catch(e){notice('Не удалось подтвердить сумму сета на сервере. Заказ не отправлен.')}
  finally{flow.busy=false;button.disabled=false;button.textContent='Оформить заказ'}
 },true);
 inner.addEventListener('submit',async ev=>{
  ev.preventDefault();
  if(flow.busy)return;
  if(!inner.reportValidity())return;
  if(!email.validity.valid||!name.validity.valid){notice('Заполни email и имя.');return}
  if(phone.value.replace(/\D/g,'').length<10){notice('Проверь номер телефона.');phone.focus();return}
  if(!agree.checked||!privacy.checked){notice('Для оформления заказа отметь оба согласия.');return}
  if(!flow.selection||!flow.quote){notice('Сначала нажмите «Оформить заказ».');return}
  const pair=build();
  if(!pair||JSON.stringify(pair.selection)!==JSON.stringify(flow.selection)||pair.q.total_rub!==flow.quote.quote.total_rub){
   form.hidden=true;button.hidden=false;flow.quote=null;notice('Состав сета изменился. Нажми «Оформить заказ» ещё раз для подтверждения суммы.');return;
  }
  flow.busy=true;pay.disabled=true;pay.textContent='Создаём заказ в GetCourse…';
  try{
   if(!flow.nonce){const b=crypto.getRandomValues(new Uint8Array(32));flow.nonce=btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
   const result=await post('order',{selection:flow.selection,
     buyer:{email:email.value.trim(),name:name.value.trim(),phone:phone.value.trim()},
     offer_agreement:agree.checked,privacy_agreement:privacy.checked,nonce:flow.nonce});
   const url=result.json.checkout_url;
   if(result.status===200&&result.json.ok===true&&result.json.provider_verified===true&&
      result.json.public_release_allowed===true&&result.json.order_total_rub===flow.quote.quote.total_rub&&
      typeof url==='string'&&/^https:\/\/(?:study\.shkola-dnv\.com|singleladiesschool\.getcourse\.ru)\//.test(url)){
    notice('Заказ создан. Открываем страницу оплаты GetCourse…');
    window.top.location.assign(url);return;
   }
   if(result.status===200&&result.json.ok===true&&result.json.order_submitted===true&&result.json.deal_number){
     notice('Заказ №'+result.json.deal_number+' создан в GetCourse. Ссылка оплаты не вернулась автоматически; открой заказ в личном кабинете GetCourse.');flow.submitted=true;return;
   }
   const reason=String(result.json.code||result.status);
   notice('Ответ GetCourse: '+reason+'. Если заказ уже создан, не отправляй повторно — проверь GetCourse.');

  }catch(e){notice('Связь с GetCourse прервалась. Не отправляй запрос повторно, пока не проверен статус заказа.')}
  finally{flow.busy=false;pay.disabled=flow.submitted;pay.textContent='Оформить и перейти к оплате ↗'}
 });
})();
