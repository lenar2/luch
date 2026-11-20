'use strict';
/* BF2026 R172: Click in Lot12 opens the SAME first-party full-screen
   checkout sheet as individual courses. Keep all pricing/order data server
   verified and never release native payment without true provider total. */
(() => {
 if(location.hostname!=='wf.tati-lar.ru'||window.parent===window)return;
 const scope=document.getElementById('lot-10-set');
 const btn=scope?.querySelector('#submit'),hint=scope?.querySelector('#hint');
 if(!btn||!hint)return;
 btn.textContent='Оформить заказ';
 hint.textContent='Выбери 2–7 программ. Данные для заказа заполнишь на следующем экране.';
 btn.addEventListener('click',ev=>{
  ev.preventDefault();ev.stopImmediatePropagation();
  const q=window.BF2026SetQuote?.getSnapshot?.();
  if(!q||q.pricing_version!=='BF2026_LOT12_CUSTOM_SET_R153'||
     !Array.isArray(q.components)||q.count<2||q.count>7||
     !Number.isFinite(q.total_rub)||q.total_rub<=0){
   hint.classList.add('show');hint.textContent='Выбери от двух до семи совместимых программ.';return;
  }
  const selection={kind:'set',items:q.components.map(x=>x.key)};
  const source=q.components.find(x=>x.key==='source');
  if(source)selection.source_variant=String(source.variant);
  parent.postMessage({type:'bf2026:lot12-open',version:q.pricing_version,
   selection,expected_total_rub:q.total_rub,count:q.count,
   discount_percent:q.discount_percent,subtotal_rub:q.subtotal_rub},location.origin);
 },true);
})();
