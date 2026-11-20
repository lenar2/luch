'use strict';
/* BF2026 WF public site. Visual quote calculator, not a payment gateway.
 * Every commercial price must be checked again on a trusted server by GetCourse.
 */
(async()=>{
 const root=document.getElementById('lot-10-set');
 const $=selector=>root.querySelector(selector);
 const checks=[...root.querySelectorAll('.choice input[type="checkbox"]')];
 const radios=[...root.querySelectorAll('input[name="set-source-variant"]')];
 const count=$('#count');
 const hint=$('#hint');
 const button=$('#submit');
 const box=$('#source-tariff-box');
 const empty=$('#set-quote-placeholder');
 const filled=$('#set-quote-filled');
 const el={subtotal:$('#set-subtotal'),discount:$('#set-discount-pct'),saved:$('#set-saved'),total:$('#set-final-price')};
 const tiers=[...root.querySelectorAll('.tier')];
 const rubles=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:value%1?2:0}).format(value);
 const money=value=>rubles(value)+' ₽';
 let manifest=null;
 let current=null;
 const limit=7;
 button.disabled=true;
 button.setAttribute('aria-disabled','true');
 const keys=['rejection','devaluation','self','guilt','rejection_program','source','dgs2','knopochka','dnv','union','trainer'];
 const audioKeys=keys.slice(0,4);
 const dnvInput=checks[keys.indexOf('dnv')];
 const unionInput=checks[keys.indexOf('union')];
 const trainerInput=checks[keys.indexOf('trainer')];
 const inclusionNote=$('#trainer-inclusion-message');
 const inclusionText='Эта программа уже входит в «Тренера по отношениям», поэтому отдельно оплачивать её не нужно';
 const showInclusion=()=>{inclusionNote.textContent=inclusionText;inclusionNote.hidden=false;};
 const clearInclusion=()=>{inclusionNote.textContent='';inclusionNote.hidden=true;};
 const audioGroup=$('#audio-choice-group');
 const programInput=checks[4];
 const programLabel=programInput.closest('label');
 const upgradeNote=$('#audio-upgrade-status');
 const undoButton=$('#audio-upgrade-undo');
 let undoAudioKeys=null;
 const updateUpgradeNotice=show=>{
   upgradeNote.hidden=!show;
   programLabel.classList.toggle('vf106-program-auto',show);
 };
 undoButton.addEventListener('click',()=>{
   if(!undoAudioKeys)return;
   programInput.checked=false;
   checks.slice(0,4).forEach((input,i)=>input.checked=undoAudioKeys.includes(audioKeys[i]));
   undoAudioKeys=null;
   updateUpgradeNotice(false);
   // The audio accordion owns the names and the count; dispatch one change notification
   // after restoring the TWO audio selections (never re-enters the upgrade path).
   checks[0].dispatchEvent(new Event('change',{bubbles:true}));
   audioGroup.open=true;
   audioGroup.querySelector('summary')?.focus({preventScroll:true});
 });
 const getSelection=()=>checks.map((input,i)=>input.checked?keys[i]:null).filter(Boolean);
 const getSourceVariant=()=>radios.find(x=>x.checked)?.value||'1';
 function getQuote() {
  if(!manifest)return null;
  const selected=getSelection();
  if(selected.includes('trainer')&&(selected.includes('dnv')||selected.includes('union')))return null;
  const n=selected.length;
  if(n<manifest.minimum_items||n>manifest.maximum_items)return null;
  if(selected.filter(k=>audioKeys.includes(k)).length>manifest.max_individual_audio_items)return null;
  if(selected.includes('rejection_program') && selected.some(k=>audioKeys.includes(k)))return null;
  const byKey=new Map(manifest.products.map(p=>[p.key,p]));
  let subtotal=0;
  const components=selected.map(key=>{
   const product=byKey.get(key);
   if(!product)throw Error('Unrecognized bundle product '+key);
   const variant=key==='source'?product.variants.find(v=>v.key===getSourceVariant()):null;
   if(key==='source'&&!variant)throw Error('Unrecognized Source variant');
   const base=variant?variant.base_price_rub:product.base_price_rub;
   if(!Number.isSafeInteger(base)||base<0)throw Error('Invalid base price '+key);
   subtotal+=base;
   return {key,site_lot:product.site_lot,variant:variant?.key||null,base_price_rub:base};
  });
  const discount=manifest.tiers_percent[String(n)];
  if(!Number.isInteger(discount)||discount<0||discount>=100)throw Error('Invalid bundle discount');
  // Exact GetCourse native payable per Offer in kopecks.
  const finalPrice=Math.round(components.reduce((sum,c)=>sum+Math.round(c.base_price_rub*(100-discount))/100,0)*100)/100;
  return {currency:'RUB',count:n,components,subtotal_rub:subtotal,discount_percent:discount,
   total_rub:finalPrice,savings_rub:subtotal-finalPrice,pricing_version:manifest.id};
 }
 function redraw() {
  const selected=getSelection();
  const n=selected.length;
  const sourceSelected=selected.includes('source');
  box.hidden=!sourceSelected;
  const hasProgram=selected.includes('rejection_program');
  const hasAudio=selected.some(k=>['rejection','devaluation','self','guilt'].includes(k));
  checks.forEach((c,i)=>{
    const conflict=hasProgram&&i<4 || hasAudio&&keys[i]==='rejection_program';
    const coveredChoice=selected.includes('trainer')&&(keys[i]==='dnv'||keys[i]==='union');
    const trainerCanReplace=keys[i]==='trainer'&&(selected.includes('dnv')||selected.includes('union'));
    c.disabled=!c.checked && ((n>=limit&&!coveredChoice&&!trainerCanReplace)||conflict);
    c.closest('label')?.setAttribute('aria-label',conflict?'Нельзя добавить: эта программа уже включает выбранные аудиотерапии':c.value);
  });
  tiers.forEach((t,i)=>t.classList.toggle('is-selected',n===i+2));
  try {current=getQuote()}catch(e){
   console.error('Quote error',e);
   current=null;
   hint.classList.add('show');
   hint.textContent='Не получилось рассчитать стоимость. Попробуй обновить страницу.';
  }
  if(!manifest){
   count.textContent='Загружаем цены...';
   empty.textContent='Проверяем актуальные цены.';
   empty.hidden=false;filled.hidden=true;
  }else if(current){
   count.textContent='Выбрано '+n+' из '+checks.length+'. Стоимость сета: '+money(current.total_rub)+'.';
   el.subtotal.textContent=money(current.subtotal_rub);
   el.discount.textContent='−'+current.discount_percent+'%';
   el.saved.textContent=money(current.savings_rub);
   el.total.textContent=money(current.total_rub);
   empty.hidden=true;filled.hidden=false;
  }else{
   count.textContent='Выбрано '+n+' из '+checks.length+'. Для сета выбери от 2 до 7 продуктов.';
   empty.textContent=n===0?'Выбери минимум 2 продукта — здесь появится итоговая цена.':'Добавь ещё один продукт, чтобы увидеть цену сета.';
   empty.hidden=false;filled.hidden=true;
  }
  button.disabled=!current;
  button.setAttribute('aria-disabled',String(!current));
  button.textContent=current?'Собрать свой сет · '+money(current.total_rub):'Собрать свой сет';
  if(hint.classList.contains('show')&&current){
   hint.textContent='Стоимость: '+money(current.total_rub)+'. Оформление заказа пока недоступно.';
  }
 }
 function onChoice(e){
  const coveredInput=e.target===dnvInput||e.target===unionInput;
  if(coveredInput&&e.target.checked&&trainerInput.checked){
   e.target.checked=false;showInclusion();redraw();return;
  }
  if(e.target===trainerInput){
   if(trainerInput.checked){
    const removed=[dnvInput,unionInput].filter(x=>x.checked);
    removed.forEach(x=>{x.checked=false;});
    if(removed.length)showInclusion();else clearInclusion();
   }else clearInclusion();
  }else if(coveredInput)clearInclusion();
  const audioSelected=getSelection().filter(key=>audioKeys.includes(key));
  if(e.target.checked && checks.slice(0,4).includes(e.target) && audioSelected.length>2){
   // Keep only the last two previously checked audios as an undoable selection.
   undoAudioKeys=audioSelected.filter(key=>key!==keys[checks.indexOf(e.target)]).slice(0,2);
   checks.slice(0,4).forEach(input=>input.checked=false);
   programInput.checked=true;
   audioGroup.open=false;
   updateUpgradeNotice(true);
   // Make the visible course selection understandable, never initiate checkout.
   programInput.focus({preventScroll:true});
   programLabel.scrollIntoView({behavior:'instant',block:'nearest'});
   hint.classList.remove('show');
   hint.textContent='';
   redraw();
   return;
  }
  if(e.target===programInput && !e.target.checked){
   undoAudioKeys=null;
   updateUpgradeNotice(false);
  }
  if(getSelection().length>limit){
   e.target.checked=false;
   hint.classList.add('show');
   hint.textContent='Для одного сета можно выбрать не более семи продуктов.';
  }else{
   hint.classList.remove('show');
   hint.textContent='';
  }
  redraw();
 }
 checks.forEach(c=>c.addEventListener('change',onChoice));
 radios.forEach(r=>r.addEventListener('change',redraw));
 button.addEventListener('click',()=>{
  current=getQuote();
  if(!current)return;
  hint.classList.add('show');
  hint.textContent='В сете '+current.count+' продукта(ов), скидка '+current.discount_percent+'%, итоговая стоимость '+money(current.total_rub)+'. Оформление заказа пока недоступно.';
 });
 // Expose a read-only snapshot method for QA and a future trusted order adapter.
 window.BF2026SetQuote={getSnapshot:()=>getQuote(),getConfig:()=>manifest};
 try{
  const response=await fetch('assets/set-pricing-r162.json?v=r162',{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  manifest=await response.json();
  if(manifest.minimum_items!==2||manifest.maximum_items!==7||manifest.products.length!==11||manifest.max_individual_audio_items!==2)throw Error('Unexpected pricing manifest');
  const expected=checks.map(c=>c.value);
  if(expected.join('|')!=='Аудиотерапия «Исцеление раны отвержения»|Аудиотерапия «Исцеление раны обесценивания»|Аудиотерапия «Исцеление страха быть собой»|Аудиотерапия «Исцеление чувства вины»|Программа «Исцеление отвержения»|Программа «Источник»|Деньги в женском состоянии 2.0|Кнопочка женского состояния|Школа для девушек на выданье (ДНВ)|Курс «Союз нового времени»|Программа «Тренер по отношениям»')throw Error('Product order changed');
  const labels=manifest.products.map(p=>p.label);
  if(expected.some((label,i)=>label!==labels[i]))throw Error('Price product mismatch');
  redraw();
 }catch(e){
  console.error('Price catalog unavailable',e);
  empty.textContent='Не удалось загрузить цены. Покупка недоступна.';
  count.textContent='Каталог цен временно недоступен.';
  button.disabled=true;
  button.setAttribute('aria-disabled','true');
 }
})();
