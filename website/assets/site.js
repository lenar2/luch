(()=>{
 const btn=document.querySelector('.mobile-menu');
 const nav=document.querySelector('.nav');
 if(btn&&nav){
  const openLabel=btn.dataset.labelOpen||btn.getAttribute('aria-label')||'Open menu';
  const closeLabel=btn.dataset.labelClose||'Close menu';
  const setOpen=(open,restoreFocus=false)=>{
   btn.setAttribute('aria-expanded',String(open));
   btn.setAttribute('aria-label',open?closeLabel:openLabel);
   nav.classList.toggle('open',open);
   if(open){const first=nav.querySelector('a[href]');if(first)first.focus();}
   else if(restoreFocus)btn.focus();
  };
  btn.addEventListener('click',()=>setOpen(btn.getAttribute('aria-expanded')!=='true'));
  nav.querySelectorAll('a[href]').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
  document.addEventListener('keydown',e=>{
   if(e.key==='Escape'&&btn.getAttribute('aria-expanded')==='true'){
    e.preventDefault();setOpen(false,true);
   }
  });
  document.addEventListener('click',e=>{
   if(btn.getAttribute('aria-expanded')==='true'&&!btn.contains(e.target)&&!nav.contains(e.target))setOpen(false);
  });
 }
})();

// Accessible workflow explorer: one selected panel, arrow-key navigation and Home/End.
(()=>{
 const controls=[...document.querySelectorAll('[data-workflow-tab]')];
 if(!controls.length)return;
 const select=(n,focus=false)=>{
  const i=(n+controls.length)%controls.length;
  controls.forEach((button,j)=>{
   const current=i===j;
   button.setAttribute('aria-selected',String(current));
   button.tabIndex=current?0:-1;
   button.classList.toggle('is-active',current);
   const panel=document.getElementById(button.getAttribute('aria-controls'));
   if(panel)panel.hidden=!current;
  });
  if(focus)controls[i].focus();
 };
 controls.forEach((button,i)=>{
  button.addEventListener('click',()=>select(i));
  button.addEventListener('keydown',e=>{
   const next=e.key==='ArrowRight'||e.key==='ArrowDown'?i+1:e.key==='ArrowLeft'||e.key==='ArrowUp'?i-1:e.key==='Home'?0:e.key==='End'?controls.length-1:null;
   if(next!==null){e.preventDefault();select(next,true)}
  });
 });
})();
