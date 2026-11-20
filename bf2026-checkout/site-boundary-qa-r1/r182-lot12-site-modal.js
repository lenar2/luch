'use strict';
/* R182 — first party full-screen set checkout with native price status; never create an order on open
   or on read-only plan. User enters data and explicitly submits only once. */
(()=>{
 if(location.hostname!=='wf.tati-lar.ru')return;
 const iframe=document.getElementById('lot10-set-frame');
 if(!iframe)return;
 const supported=['rejection','devaluation','self','guilt','rejection_program','source','dgs2',
   'knopochka','dnv','union','trainer'];
 const titles={rejection:'Исцеление раны отвержения',devaluation:'Исцеление раны обесценивания',
  self:'Исцеление страха быть собой',guilt:'Исцеление чувства вины',
  rejection_program:'Исцеление отвержения',source:'Источник',
  dgs2:'Деньги в женском состоянии 2.0',knopochka:'Кнопочка женского состояния',
  dnv:'Школа для девушек на выданье',union:'Союз нового времени',
  trainer:'Тренер по отношениям'};
 const fmt=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
 const root=document.createElement('div');root.id='bf172-set-layer';root.className='cart-layer';root.hidden=true;
 root.innerHTML=
 '<div class="cart-backdrop" id="bf172-set-backdrop"></div>'+
 '<aside class="cart-panel bf172-set-panel" role="dialog" aria-modal="true" aria-labelledby="bf172-set-title" tabindex="-1">'+
 '<div class="cart-header"><div><span class="cart-kicker">БЕЛАЯ ПЯТНИЦА · ТВОЙ ВЫБОР</span><h2 id="bf172-set-title">Твой сет</h2></div>'+
 '<button id="bf172-set-close" type="button" aria-label="Закрыть">✕</button></div>'+
 '<div id="bf172-set-items" class="cart-rows"></div>'+
 '<div class="cart-summary"><span>Итого</span><strong id="bf172-set-total">—</strong></div>'+
 '<section id="bf167-order">'+
 '<div class="bf167-divider"><span>Оформление заказа</span></div>'+
 '<div class="bf167-heading"><span class="bf167-seal" aria-hidden="true">✦</span><div><h3>Почти готово</h3><p>Укажи данные для доступа после оплаты</p></div></div>'+
 '<form id="bf172-set-form" novalidate autocomplete="on">'+
 '<div class="bf167-fields">'+
 '<label for="bf172-set-email">Электронная почта <em>*</em></label><input id="bf172-set-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" maxlength="160" required>'+
 '<label for="bf172-set-name">Твоё имя <em>*</em></label><input id="bf172-set-name" name="name" type="text" autocomplete="name" placeholder="Как к тебе обращаться" maxlength="120" minlength="2" required>'+
 '<label for="bf172-set-phone">Номер телефона <em>*</em></label><input id="bf172-set-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+7 999 123-45-67" maxlength="35" required>'+
 '</div><div class="bf167-consents">'+
 '<label><input type="checkbox" name="offer" required><span>Я согласна с <a href="https://study.shkola-dnv.com/oferta" target="_blank" rel="noopener noreferrer">условиями оферты</a></span></label>'+
 '<label><input type="checkbox" name="privacy" required><span>Согласна на обработку данных для оформления заказа и предоставления доступа</span></label></div>'+
 '<p id="bf172-set-status" role="status" aria-live="polite">Проверяем итоговую стоимость…</p>'+
 '<button class="bf167-pay" type="submit" disabled>Оформить и перейти к оплате</button>'+
 '<p class="bf167-note">Заказ и оплата — через GetCourse. Данные карты здесь не запрашиваются.</p>'+
 '</form></section></aside>';
 document.body.appendChild(root);
 const panel=root.querySelector('.bf172-set-panel'),form=root.querySelector('form'),
  status=root.querySelector('#bf172-set-status'),submit=root.querySelector('.bf167-pay'),
  amount=root.querySelector('#bf172-set-total'),items=root.querySelector('#bf172-set-items');
 const fields=n=>form.elements.namedItem(n);
 let selection=null,signature='',quote=null,quoteId=0,pending=false,sent=false,nonce=null,
   focusBefore=null,previousOverflow='';
 const fail=msg=>{status.textContent=msg;};
 const post=async(name,payload)=>{
  const r=await fetch('/api/checkout/lot12/'+name,{method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify(payload),credentials:'same-origin',cache:'no-store'});
  let data;try{data=await r.json()}catch{data={code:'RESPONSE_UNAVAILABLE'};}
  return {status:r.status,data};
 };
 function isValid(s){
  if(!s||s.kind!=='set'||!Array.isArray(s.items)||s.items.length<2||s.items.length>7||
     s.items.some(k=>!supported.includes(k))||new Set(s.items).size!==s.items.length||
     s.items.filter(k=>['rejection','devaluation','self','guilt'].includes(k)).length>2||
     (s.items.includes('rejection_program')&&s.items.some(k=>['rejection','devaluation','self','guilt'].includes(k))))return false;
  if(s.items.includes('source'))return s.source_variant==='1'||s.source_variant==='2';
  return s.source_variant===undefined;
 }
 function dismiss(){
  if(pending)return;
  root.hidden=true;document.body.style.overflow=previousOverflow;
  focusBefore?.focus?.();
 }
 root.querySelector('#bf172-set-close').addEventListener('click',dismiss);
 root.querySelector('#bf172-set-backdrop').addEventListener('click',dismiss);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden)dismiss()});
 const updateLabels=()=>{items.replaceChildren();
  for(const k of selection.items){
   const row=document.createElement('div');row.className='cart-item';
   const label=document.createElement('strong');label.textContent=titles[k]+(k==='source'?' · '+(selection.source_variant==='2'?'2 модуля':'1 модуль'):'');
   row.appendChild(label);items.appendChild(row);
  }
 };
 async function open(data){
  if(!isValid(data.selection)||data.version!=='BF2026_LOT12_CUSTOM_SET_R153'||
    !Number.isSafeInteger(data.expected_total_rub)||data.expected_total_rub<=0||data.count!==data.selection.items.length)return;
  const next=JSON.stringify(data.selection);
  if(next!==signature){form.reset();nonce=null;sent=false;}
  signature=next;selection=structuredClone(data.selection);quote=null;
  updateLabels();
  amount.textContent=fmt(data.expected_total_rub);
  if(root.hidden){focusBefore=document.activeElement;previousOverflow=document.body.style.overflow;}
  root.hidden=false;document.body.style.overflow='hidden';panel.focus();
  submit.disabled=true;submit.textContent='Оформить и перейти к оплате';
  status.textContent='Проверяем сумму сета…';
  const current=++quoteId;
  try{
   const r=await post('plan',selection);
   if(current!==quoteId||root.hidden)return;
   const q=r.data?.quote;
   if(r.status!==200||r.data?.ok!==true||
     q?.pricing_version!=='BF2026_LOT12_CUSTOM_SET_R153'||
     q?.total_rub!==data.expected_total_rub||q?.count!==data.count||
     q?.discount_percent!==data.discount_percent)throw Error('QUOTE_MISMATCH');
   quote=q;amount.textContent=fmt(q.total_rub);
   submit.disabled=sent;
   status.textContent=sent?
     'Этот заказ уже отправлялся. Проверь GetCourse или напиши Юле — повторную отправку не делаем.':
     'Сумма подтверждена: '+fmt(q.total_rub)+'. Заполни данные для оформления.';
  }catch{
   if(current===quoteId){submit.disabled=true;fail('Не получилось подтвердить сумму. Напиши Юле, чтобы оформить сет без ошибки.');}
  }
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==iframe.contentWindow||
   e.data?.type!=='bf2026:lot12-open')return;
  void open(e.data);
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(pending||sent||!quote||!selection)return;
  if(!form.reportValidity())return;
  const phone=fields('phone').value.trim();
  if(phone.replace(/\D/g,'').length<10||phone.replace(/\D/g,'').length>15){
   fail('Проверь номер телефона.');fields('phone').focus();return;
  }
  if(!fields('offer').checked||!fields('privacy').checked){fail('Подтверди оба согласия.');return;}
  pending=true;sent=true;submit.disabled=true;submit.textContent='Создаём заказ…';
  nonce ||= [...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
  try{
   const r=await post('order',{selection,
    buyer:{email:fields('email').value.trim(),name:fields('name').value.trim(),phone},
    nonce,offer_agreement:true,privacy_agreement:true});
   const d=r.data,url=d.checkout_url;
   if(r.status===200&&d.ok===true&&d.provider_verified===true&&
      d.public_release_allowed===true&&d.order_total_rub===quote.total_rub&&
      typeof url==='string'){
      const safe=new URL(url);
      if(safe.protocol==='https:'&&['study.shkola-dnv.com','singleladiesschool.getcourse.ru'].includes(safe.hostname)&&
        !safe.username&&!safe.password){window.location.assign(safe.href);return;}
   }
   if(r.status===200&&d?.order_submitted===true&&d.deal_number){
     fail('Заказ №'+d.deal_number+' создан. Применяем скидку в GetCourse…');
     submit.textContent='Подготавливаем оплату…';
     for(let i=0;i<25;i++){
       await new Promise(resolve=>setTimeout(resolve,1000));
       let verified;
       try{verified=await post('order-status',{deal_number:String(d.deal_number),nonce});}
       catch{continue;}
       const x=verified.data;
       if(verified.status===200&&x?.ok&&x.deal_number===String(d.deal_number)&&
         x.price_verified===true&&x.order_total_rub===quote.total_rub){
         if(x.payment_ready===true&&typeof x.checkout_url==='string'){
           try{
             const safe=new URL(x.checkout_url);
             if(safe.protocol==='https:'&&safe.hostname==='study.shkola-dnv.com'&&
                !safe.username&&!safe.password&&!safe.hash){
               fail('Скидка применена. Переходим к оплате GetCourse…');
               window.location.assign(safe.href);return;
             }
           }catch{}
         }
         fail('Заказ №'+d.deal_number+' готов на '+fmt(quote.total_rub)+
           '. Скидка подтверждена. Ссылка оплаты пока недоступна — напиши Юле.');
         return;
       }
       if(i===9)fail('Заказ №'+d.deal_number+' создан. GetCourse сохраняет скидку…');
     }
     fail('Заказ №'+d.deal_number+' создан. GetCourse ещё обрабатывает скидку. Не оформляй его повторно — напиши Юле.');
   }else{
     const detail=(typeof d?.code==='string'&&d.code.length<130)?' ('+d.code+')':'';
     fail('GetCourse не открыл оплату'+detail+'. Не отправляй заказ повторно — напиши Юле.');
   }
  }catch{fail('Связь с GetCourse прервалась. Чтобы избежать повторного заказа, напиши Юле.');}
  finally{pending=false;submit.disabled=true;submit.textContent='Проверить оформление у Юли';}
 });
})();
