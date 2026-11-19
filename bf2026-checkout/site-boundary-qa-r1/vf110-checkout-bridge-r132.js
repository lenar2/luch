'use strict';
/*
 * BF2026 R110: one trusted quote pipeline for regular cart and all 265 set selections.
 * No payments/customer records handled by this frontend. Native GetCourse form is
 * opened only after the backend releases an exact verified sale route.
 */
(()=>{
 if(location.hostname!=='wf.tati-lar.ru')return;
 const submit=document.querySelector('#cart-layer .cart-checkout');
 const snap=window.BF2026Cart?.getSnapshot;
 if(!submit||typeof snap!=='function')return;
 const originalText=submit.textContent;
 const titles={1:'rejection',2:'devaluation',3:'self',4:'guilt',5:'rejection_program',
               6:'dnv',7:'union',8:'trainer',9:'source'};
 const currency=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
 let serviceReady=false,activeRequest=null,requestSignature=null,sequence=0;
 let setCheckoutReady=false;
 const $=s=>document.querySelector(s);
 const post=async(endpoint,data)=>{
  const r=await fetch('/api/checkout/'+endpoint,{method:'POST',cache:'no-store',credentials:'same-origin',
     headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)});
  return {code:r.status,data:await r.json()};
 };
 const selection=()=>{
  const basket=snap();
  if(!basket||!Array.isArray(basket.lines)||!basket.lines.length)return null;
  const lines=basket.lines;
  if(lines.length===1){
   const line=lines[0];
   if(line.lot===10&&line.request?.kind==='set')return {request:line.request,expectedSubtotal:line.subtotal_rub,expectedTotal:line.display_price_rub};
   if(!Number.isInteger(line.lot)||line.lot<1||line.lot>12||[10,11].includes(line.lot))return null;
   const r={kind:'single',lot:line.lot};
   if(line.lot===9)r.variant=String(line.variant||'1');
   return {request:r,expectedSubtotal:line.display_price_rub,expectedTotal:line.display_price_rub};
  }
  // Multiple regular cart items share the same exact 2-5-item set rules.
  if(lines.length<2||lines.length>5||lines.some(l=>!Number.isInteger(l.lot)||!titles[l.lot]))return null;
  if(new Set(lines.map(l=>l.lot)).size!==lines.length)return null;
  const keys=lines.map(l=>titles[l.lot]);
  if(keys.includes('rejection_program')&&keys.some(k=>['rejection','devaluation','self','guilt'].includes(k)))return null;
  if(keys.filter(k=>['rejection','devaluation','self','guilt'].includes(k)).length>2)return null;
  const request={kind:'set',items:keys};
  const source=lines.find(l=>l.lot===9);
  if(source)request.source_variant=String(source.variant||'1');
  return {request,expectedSubtotal:lines.reduce((s,l)=>s+l.display_price_rub,0),expectedTotal:null};
 };
 function preventPayment(){
  setCheckoutReady=false;
  activeRequest=null;requestSignature=null;
  submit.disabled=true;submit.setAttribute('aria-disabled','true');submit.textContent=originalText;
 }
 function displayQuote(q,lines){
  $('#cart-total').textContent=currency(q.total_rub);
  $('#cart-sum').textContent=currency(q.total_rub);
  if(q.kind==='set'){
   $('#cart-message').textContent='Сет: скидка '+q.discount_percent+'% (экономия '+currency(q.savings_rub)+'). Итого '+currency(q.total_rub)+'. Оформление заказа пока недоступно.';
  }
 }
 // BF2026 R132: set-specific native plan and release gate.
 // A globally ready SINGLE-offer site may never authorize a MULTI-offer set.
 async function verifySetPlan(request,q){
  try{
   const [r,statusResponse]=await Promise.all([
    post('set/plan',request),
    fetch('/api/checkout/set/status',{credentials:'same-origin',cache:'no-store'})
   ]);
   const s=statusResponse.ok?await statusResponse.json():null;
   const p=r.data,order=p?.order,lines=order?.expected_line_items;
   if(r.code!==200||p?.ok!==true||!s?.ok||p.quote?.pricing_version!==q.pricing_version||
      p.quote?.count!==q.count||p.quote?.total_rub!==q.total_rub||
      p.quote?.discount_percent!==q.discount_percent||
      !order||order.expected_single_order!==true||order.create_new_offer_count!==0||
      order.expected_payment_total_rub!==q.total_rub||
      !Array.isArray(lines)||lines.length!==q.count||
      new Set(lines.map(x=>x.offer_id)).size!==q.count||
      lines.some(x=>!Number.isSafeInteger(x.offer_id)||x.offer_id<=0||
         !Number.isSafeInteger(x.line_price_rub)||x.line_price_rub<=0||
         !Array.isArray(x.product_training_pairs)||!x.product_training_pairs.length||
         x.product_training_pairs.some(g=>!Number.isSafeInteger(g.product_id)||
            !Number.isSafeInteger(g.training_id)||g.after_pay_days!==365))||
      lines.reduce((sum,x)=>sum+x.line_price_rub,0)!==q.total_rub)return {valid:false};
   return {valid:true,released:s.sale_ready===true&&s.public_release_allowed===true&&
      s.live_provider_import_enabled===true&&s.native_payment_link_verified===true&&
      s.native_receipt_verified===true&&s.grants_verified===true&&
      p.public_release_allowed===true};
  }catch{return {valid:false}}
 }
 async function update(){
  const n=++sequence;preventPayment();
  const basket=snap();
  if(basket.lines.length===0)return;
  const data=selection();
  if(!data){
    if(basket.lines.length>=2)$('#cart-message').textContent='Для сета выбери от 2 до 5 разных программ без повторяющихся аудиотерапий. Оформление такого выбора пока недоступно.';
    return;
  }
  try{
    const r=await post('quote',data.request);
    if(n!==sequence||r.code!==200||r.data.ok!==true||!r.data.quote)return;
    const q=r.data.quote;
    if(q.pricing_version!=='BF2026_LOT10_CUSTOM_SET_R107'||q.subtotal_rub!==data.expectedSubtotal||
       (data.expectedTotal!==null&&data.expectedTotal!==q.total_rub))return;
    displayQuote(q,basket.lines);
    if(q.kind==='set'){
      const verdict=await verifySetPlan(data.request,q);
      if(n!==sequence)return;
      if(!verdict.valid){
       preventPayment();
       $('#cart-message').textContent='Не удалось подтвердить состав и стоимость сета на сервере. Оформление недоступно.';
       return;
      }
      if(!verdict.released){
       $('#cart-message').textContent='Сет рассчитан сервером: '+currency(q.total_rub)+'. Оплата этого сета пока недоступна.';
       return;
      }
      setCheckoutReady=true;activeRequest=data.request;
      requestSignature=JSON.stringify(activeRequest);
      submit.disabled=false;submit.setAttribute('aria-disabled','false');
      submit.textContent='Перейти к оплате';
      $('#cart-message').textContent='Состав и стоимость сета подтверждены. Перейти к оплате.';
      return;
    }
    if(!serviceReady||r.data.availability.ready!==true)return;
    activeRequest=data.request;requestSignature=JSON.stringify(activeRequest);
    submit.disabled=false;submit.setAttribute('aria-disabled','false');
    submit.textContent='Перейти к оплате';
    $('#cart-message').textContent='Стоимость проверена. Для оформления нажми «Перейти к оплате».';
  }catch{
    if(n===sequence)preventPayment();
  }
 }
 async function start(){
  if(!activeRequest||submit.disabled)return;
  const current=selection();
  if(!current||JSON.stringify(current.request)!==requestSignature){preventPayment();return}
  const req=activeRequest,isSet=req.kind==='set';
  if(isSet&&!setCheckoutReady){preventPayment();return;}
  preventPayment();submit.textContent='Проверяем заказ…';
  try{
   const r=await post(isSet?'set/start':'start',req);
   if(r.code!==200||r.data.ok!==true||!r.data.checkout_url)throw Error('not_ready');
   const target=new URL(r.data.checkout_url);
   const allowedSameOrigin=target.origin===location.origin&&target.pathname==='/api/checkout/form';
   const allowedNative=target.protocol==='https:'&&target.hostname==='study.shkola-dnv.com'&&!target.username&&!target.password;
   if(!allowedSameOrigin&&!allowedNative)throw Error('unverified_payment_destination');
   location.assign(target.toString());
  }catch{
   submit.textContent=originalText;
   $('#cart-message').textContent='Оформление выбранного предложения пока недоступно.';
  }
 }
 // Existing cart events are dispatched synchronously by the original, untouched UI.
 window.addEventListener('bf2026:cart-updated',()=>{void update()});
 submit.addEventListener('click',()=>{void start()});
 fetch('/api/checkout/status',{credentials:'same-origin',cache:'no-store'})
  .then(r=>r.ok?r.json():null)
  .then(s=>{serviceReady=!!s&&s.pricing_version==='BF2026_LOT10_CUSTOM_SET_R107'&&(s.sales_ready===true||s.trainer_direct_checkout_ready===true||Number(s.native_direct_available_count)>0);return update()})
  .catch(()=>{serviceReady=false;preventPayment()});
})();

