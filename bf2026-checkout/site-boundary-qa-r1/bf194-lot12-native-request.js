'use strict';
/* BF2026 R194: instant Lot12 set confirmation -> native GetCourse lead form.
 * No paid order or charge is initiated on wf.tati-lar.ru. This native form
 * records a buyer request, not a payment or price-verified Deal.
 */
(()=>{
 if(location.hostname!=='wf.tati-lar.ru')return;
 const frame=document.getElementById('lot10-set-frame');
 if(!frame)return;
 const names={
  rejection:'Исцеление раны отвержения',
  devaluation:'Исцеление раны обесценивания',
  self:'Исцеление страха быть собой',
  guilt:'Исцеление чувства вины',
  rejection_program:'Исцеление отвержения',
  source:'Источник',
  dgs2:'Деньги в женском состоянии 2.0',
  knopochka:'Кнопочка женского состояния',
  dnv:'Школа для девушек на выданье',
  union:'Союз нового времени',
  trainer:'Тренер по отношениям'
 };
 const tiers={2:10,3:15,4:25,5:35,6:40,7:45};
 const fmt=x=>new Intl.NumberFormat('ru-RU').format(x)+' ₽';
 const root=document.createElement('div');
 root.id='bf172-set-layer';root.className='cart-layer';root.hidden=true;
 root.innerHTML=[
  '<div class="cart-backdrop" id="bf194-backdrop"></div>',
  '<aside class="cart-panel bf172-set-panel" role="dialog" aria-modal="true" aria-labelledby="bf194-title" tabindex="-1">',
  '<div class="cart-header"><div><span class="cart-kicker">БЕЛАЯ ПЯТНИЦА · ТВОЙ СЕТ</span><h2 id="bf194-title">Подтверди свой выбор</h2></div>',
  '<button type="button" id="bf194-close" aria-label="Закрыть">✕</button></div>',
  '<div id="bf172-set-items" class="cart-rows"></div>',
  '<p id="bf194-discount" class="bf194-discount"></p>',
  '<div class="cart-summary"><span>Стоимость твоего сета</span><strong id="bf172-set-total">—</strong></div>',
  '<section id="bf167-order"><div class="bf167-divider"><span>Подтверждение выбора</span></div>',
  '<div class="bf167-heading"><span class="bf167-seal" aria-hidden="true">✦</span>',
  '<div><h3>Почти готово</h3><p>Подтверди программы и стоимость, затем перейди на GetCourse</p></div></div>',
  '<form id="bf194-confirm-form"><div class="bf167-consents">',
  '<label><input type="checkbox" name="confirm" required><span>Хочу заказать эти <strong id="bf194-count"></strong> программы за <strong id="bf194-price"></strong>.</span></label>',
  '<label><input type="checkbox" name="consent" required><span>Согласна с <a href="https://study.shkola-dnv.com/oferta" target="_blank" rel="noopener noreferrer">условиями оферты</a> и обработкой данных для оформления заявки.</span></label>',
  '</div><p id="bf194-status" role="status" aria-live="polite"></p>',
  '<button class="bf167-pay" type="submit">Продолжить в GetCourse ↗</button>',
  '<p class="bf167-note">На GetCourse укажи имя, email и телефон. Это заявка на выбранный сет, не оплата. Счёт на подтверждённую сумму будет подготовлен отдельно.</p>',
  '</form></section></aside>'
 ].join('');
 document.body.appendChild(root);
 const form=root.querySelector('#bf194-confirm-form');
 const panel=root.querySelector('.bf172-set-panel');
 const rows=root.querySelector('#bf172-set-items');
 const amount=root.querySelector('#bf172-set-total');
 const countLabel=root.querySelector('#bf194-count');
 const priceLabel=root.querySelector('#bf194-price');
 const discount=root.querySelector('#bf194-discount');
 const note=root.querySelector('#bf194-status');
 let selected=null,focusBefore=null,previousOverflow='';
 function valid(s,info){
  if(!s||s.kind!=='set'||!Array.isArray(s.items)||
     !Object.hasOwn(tiers,s.items.length)||s.items.length!==info.count||
     !Number.isSafeInteger(info.expected_total_rub)||info.expected_total_rub<1||
     info.version!=='BF2026_LOT12_CUSTOM_SET_R153'||
     info.discount_percent!==tiers[s.items.length]||
     s.items.some(k=>!Object.hasOwn(names,k))||
     new Set(s.items).size!==s.items.length)return false;
  if(s.items.includes('source')){
   if(s.source_variant!=='1'&&s.source_variant!=='2')return false;
  }else if(s.source_variant!==undefined)return false;
  const audios=['rejection','devaluation','self','guilt'];
  if(s.items.filter(k=>audios.includes(k)).length>2)return false;
  if(s.items.includes('rejection_program')&&s.items.some(k=>audios.includes(k)))return false;
  return true;
 }
 function dismiss(){
  root.hidden=true;document.body.style.overflow=previousOverflow;
  focusBefore?.focus?.();
 }
 root.querySelector('#bf194-close').addEventListener('click',dismiss);
 root.querySelector('#bf194-backdrop').addEventListener('click',dismiss);
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!root.hidden)dismiss();
 });
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow||
     e.data?.type!=='bf2026:lot12-open'||!valid(e.data.selection,e.data))return;
  const s=e.data.selection;
  selected={selection:structuredClone(s),total:e.data.expected_total_rub,
    discount:e.data.discount_percent};
  rows.replaceChildren();
  for(const k of s.items){
   const row=document.createElement('div');row.className='cart-item';
   const title=document.createElement('strong');
   title.textContent=names[k]+(k==='source'?
     (s.source_variant==='2'?' · модули I + II':' · модуль I'):'');
   row.appendChild(title);rows.appendChild(row);
  }
  amount.textContent=fmt(selected.total);
  countLabel.textContent=String(s.items.length);
  priceLabel.textContent=fmt(selected.total);
  discount.textContent='Дополнительная скидка на сет — '+selected.discount+'%';
  form.reset();note.textContent='';
  if(root.hidden){
   focusBefore=document.activeElement;
   previousOverflow=document.body.style.overflow;
  }
  root.hidden=false;document.body.style.overflow='hidden';panel.focus();
 });
 form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!selected||!form.reportValidity())return;
  const s=selected.selection;
  // This native GetCourse form registers a lead; selected set / amount go
  // into UTM content. No price or offer is changed in GetCourse at redirect.
  const marker='BF26SET|'+s.items.length+'|'+s.items.join('.')+
   '|S'+(s.source_variant||'0')+'|R'+selected.total+'|D'+selected.discount;
  const url=new URL('https://study.shkola-dnv.com/pl/lite/widget/widget');
  url.searchParams.set('id','1687553');
  url.searchParams.set('utm_source','wf.tati-lar.ru');
  url.searchParams.set('utm_medium','site');
  url.searchParams.set('utm_campaign','bf2026_lot12');
  url.searchParams.set('utm_content',marker);
  url.searchParams.set('lot12_set',s.items.join(','));
  url.searchParams.set('lot12_price',String(selected.total));
  url.searchParams.set('lot12_source',s.source_variant||'0');
  note.textContent='Переходим на форму GetCourse…';
  window.location.assign(url.toString());
 });
})();
