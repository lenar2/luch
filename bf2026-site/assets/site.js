(function(){
"use strict";
const overlay=document.getElementById("selection-overlay");
const list=document.getElementById("selection-list");
const countEls=document.querySelectorAll("[data-count]");
const copy=document.getElementById("copy-selection");
const note=document.getElementById("copy-note");
const nav=document.getElementById("site-nav");
const menu=document.querySelector(".menu-toggle");
const entries=new Map();
let returnFocus=null;
const cards=Array.from(document.querySelectorAll("[data-product]"));
const labels=new Map(cards.map(c=>[c.dataset.product,c.dataset.label]));
const tentativePrices={
 source1:4990,source2:8990,union:9990,trainer:24990,
 knop1:3990,knop2:4990,money:5990,
 "bundle-spirit-relations":14990,"bundle-knop-money":9990
};
const rub=n=>new Intl.NumberFormat("ru-RU").format(n)+" ₽";
const conflicts={
 source1:["source2","bundle-spirit-relations"],
 source2:["source1","bundle-spirit-relations"],
 union:["trainer","bundle-spirit-relations"],
 trainer:["union","bundle-spirit-relations"],
 knop1:["bundle-knop-money"],knop2:["bundle-knop-money"],money:["bundle-knop-money"],
 "bundle-spirit-relations":["source1","source2","union","trainer"],
 "bundle-knop-money":["knop1","knop2","money"]
};
function addChoice(id){
 for(const conflict of conflicts[id]||[])entries.delete(conflict);
 entries.set(id,labels.get(id)||"Программа");
 render();
}
function render(){
 list.replaceChildren();
 if(!entries.size){
  const empty=document.createElement("div");
  empty.className="selection-empty";
  empty.textContent="Ты пока ничего не выбрала.";
  list.append(empty);
 }else{
  for(const [id,title] of entries){
   const row=document.createElement("div");row.className="selection-row";
   const info=document.createElement("div");
   const label=document.createElement("strong");label.textContent=title;
   const meta=document.createElement("small");meta.textContent="В записи · 1 год · "+rub(tentativePrices[id]||0)+" · цена акции";
   info.append(label,meta);
   const del=document.createElement("button");del.type="button";del.textContent="×";del.setAttribute("aria-label","Удалить "+title);
   del.addEventListener("click",()=>{entries.delete(id);render()});
   row.append(info,del);list.append(row);
  }
 }

 const total=Array.from(entries.keys()).reduce((sum,id)=>sum+(tentativePrices[id]||0),0);
 const totalNode=document.getElementById("selection-total-price");
 if(totalNode)totalNode.textContent=rub(total);
 // When the separate choices exactly match a discounted set, point it out.
 function suggestSet(ids,setId){
  if(!ids.every(id=>entries.has(id)))return;
  const regular=ids.reduce((sum,id)=>sum+tentativePrices[id],0);
  const offer=tentativePrices[setId];
  const box=document.createElement("div");
  box.className="selection-suggest";
  const label=document.createElement("p");
  label.textContent="Есть готовый сет: "+rub(offer)+" вместо "+rub(regular)+" за те же программы (цены акции).";
  const action=document.createElement("button");
  action.type="button";
  action.textContent="Заменить на сет";
  action.addEventListener("click",()=>{
   ids.forEach(id=>entries.delete(id));
   addChoice(setId);
  });
  box.append(label,action);
  list.append(box);
 }
 suggestSet(["source2","union"],"bundle-spirit-relations");
 suggestSet(["knop1","knop2","money"],"bundle-knop-money");
 countEls.forEach(x=>{x.textContent=String(entries.size)});
 document.querySelectorAll("[data-add]").forEach(b=>{
  const active=entries.has(b.dataset.add);b.classList.toggle("is-added",active);
  b.innerHTML=active?'Выбрано <span aria-hidden="true">✓</span>':'Выбрать <span aria-hidden="true"><svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M8 5h11v11"/></svg></span>';
  if(b.classList.contains("bundle-btn"))b.innerHTML=active?'Выбрано <span aria-hidden="true">✓</span>':'Выбрать сет <span aria-hidden="true"><svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 19 19 5M8 5h11v11"/></svg></span>';
 });
 copy.disabled=!entries.size;
 note.textContent="";
}
function openSelection(){
 returnFocus=document.activeElement;
 overlay.hidden=false;document.body.classList.add("selection-open");
 const close=overlay.querySelector("[data-close-selection]:not(.selection-shade)");close?.focus();
}
function closeSelection(){
 overlay.hidden=true;document.body.classList.remove("selection-open");
 if(returnFocus&&typeof returnFocus.focus==="function")returnFocus.focus();
}
document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>{
 const id=b.dataset.add, title=labels.get(id)||"Программа";
 if(entries.has(id))entries.delete(id);else{for(const conflict of conflicts[id]||[])entries.delete(conflict);entries.set(id,title);}
 render();openSelection();
}));
document.querySelectorAll("[data-open-selection]").forEach(b=>b.addEventListener("click",openSelection));
overlay.querySelectorAll("[data-close-selection]").forEach(b=>b.addEventListener("click",closeSelection));
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&!overlay.hidden)closeSelection();
 if(e.key==="Escape"&&nav.classList.contains("is-open"))toggleMenu(false);
 if(e.key==="Tab"&&!overlay.hidden){
  const focusable=Array.from(overlay.querySelectorAll("button:not([disabled])"));
  if(!focusable.length)return;
  if(e.shiftKey&&document.activeElement===focusable[0]){e.preventDefault();focusable[focusable.length-1].focus()}
  if(!e.shiftKey&&document.activeElement===focusable[focusable.length-1]){e.preventDefault();focusable[0].focus()}
 }
});
copy.addEventListener("click",async()=>{
 if(!entries.size)return;
 const message=["Чёрная пятница 2026 · Татьяна Салимова","Мой выбор:",
 ...Array.from(entries.entries()).map(([id,name],i)=>(i+1)+". "+name+" — "+rub(tentativePrices[id]||0)),
 "","Сумма выбранного: "+rub(Array.from(entries.keys()).reduce((sum,id)=>sum+(tentativePrices[id]||0),0)),
 "Все материалы в записи, самостоятельное прохождение, доступ 1 год.",
 "Когда откроется оплата, ты сможешь оформить заказ на этой странице."].join("\n");
 try{await navigator.clipboard.writeText(message);note.textContent="Список сохранён в буфер обмена."}
 catch(_){note.textContent="Копирование недоступно в этом браузере."}
});
function toggleMenu(open){nav.classList.toggle("is-open",open);menu.setAttribute("aria-expanded",String(open));menu.setAttribute("aria-label",open?"Закрыть меню":"Открыть меню")}
menu?.addEventListener("click",()=>toggleMenu(!nav.classList.contains("is-open")));
nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>toggleMenu(false)));
render();
})();
