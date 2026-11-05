(()=>{
  const menu=document.querySelector('.menu-toggle'); const nav=document.querySelector('.head-nav');
  if(menu&&nav){
    const openLabel=menu.dataset.labelOpen||menu.getAttribute('aria-label')||'Open menu';
    const closeLabel=menu.dataset.labelClose||'Close menu';
    const setOpen=open=>{menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?closeLabel:openLabel);nav.classList.toggle('is-open',open);if(open){const first=nav.querySelector('a[href]');if(first)first.focus();}};
    const close=()=>setOpen(false);
    menu.addEventListener('click',()=>setOpen(menu.getAttribute('aria-expanded')!=='true'));
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){close();menu.focus();}});
    document.addEventListener('click',e=>{if(!menu.contains(e.target)&&!nav.contains(e.target))close()});
  }
  const tabs=[...document.querySelectorAll('[role="tab"]')];if(!tabs.length)return;
  function activate(i,focus=false){tabs.forEach((tab,j)=>{let selected=i===j;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;tab.classList.toggle('active',selected);const panel=document.getElementById(tab.getAttribute('aria-controls'));if(panel)panel.hidden=!selected;});if(focus)tabs[i].focus();}
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>activate(i));tab.addEventListener('keydown',e=>{let n=e.key==='ArrowRight'||e.key==='ArrowDown'?i+1:e.key==='ArrowLeft'||e.key==='ArrowUp'?i-1:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(n===null)return;e.preventDefault();activate((n+tabs.length)%tabs.length,true)});});
})();
