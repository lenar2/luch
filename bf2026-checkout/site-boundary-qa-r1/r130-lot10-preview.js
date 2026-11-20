'use strict';
/* Isolated localhost preview: connect existing Lot10 visual set selector
 * to real server-side one-GetCourse-order planning. Never creates a deal.
 */
(()=>{
 if(location.hostname!=='127.0.0.1'||location.port!=='18777')return;
 const root=document.getElementById('lot-10-set');
 const button=root?.querySelector('#submit'),hint=root?.querySelector('#hint');
 if(!root||!button||!hint)return;
 const selections=['rejection','devaluation','self','guilt','rejection_program','dnv','union','trainer','source'];
 const inputs=[...root.querySelectorAll('.choice input[type="checkbox"]')];
 const source=[...root.querySelectorAll('input[name="set-source-variant"]')];
 let active=false,serial=0;
 const toSelection=()=>{
  const snapshot=window.BF2026SetQuote?.getSnapshot?.();
  if(!snapshot||snapshot.count<2||snapshot.count>5)return null;
  const items=inputs.map((input,i)=>input.checked?selections[i]:null).filter(Boolean);
  if(items.length!==snapshot.count)return null;
  const result={kind:'set',items};
  if(items.includes('source'))result.source_variant=String(source.find(x=>x.checked)?.value||'1');
  return {result,snapshot};
 };
 button.addEventListener('click',async event=>{
  const current=toSelection();
  if(!current)return;
  event.stopImmediatePropagation();
  if(active)return;
  active=true;
  const run=++serial;
  button.disabled=true;button.setAttribute('aria-disabled','true');
  hint.classList.add('show');
  hint.textContent='Проверяем на сервере состав и скидку для одного заказа GetCourse…';
  try{
   const r=await fetch('/api/checkout/set/plan',{method:'POST',
    credentials:'same-origin',cache:'no-store',
    headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify(current.result)});
   const data=await r.json();
   if(run!==serial)return;
   if(!r.ok||data.ok!==true||!data.order?.expected_single_order||
    data.quote?.total_rub!==current.snapshot.total_rub||
    data.order?.expected_payment_total_rub!==current.snapshot.total_rub||
    data.order.expected_line_items.length!==current.snapshot.count||
    data.order.expected_line_items.reduce((s,x)=>s+x.line_price_rub,0)!==
     current.snapshot.total_rub)throw Error('QUOTE_OR_PROVIDER_PLAN_MISMATCH');
   hint.textContent='Сервер подтвердил: '+current.snapshot.count+
    ' предложения в одном заказе GetCourse, итог '+
    new Intl.NumberFormat('ru-RU').format(current.snapshot.total_rub)+
    ' ₽. Подключение оплаты и выдачи доступов ещё не подтверждено; заказ не создан.';
  }catch{
   hint.textContent='Серверная сверка набора не завершилась. Заказ не создан. Оплата отключена.';
  }finally{
   active=false;button.disabled=false;button.setAttribute('aria-disabled','false');
  }
 },true);
})();
