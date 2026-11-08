/* PIXEL-BMister — Studio Graphite collapsible dock panels.
 * Drag header DOWN to minimize, UP to restore. Header handle can be clicked.
 * No changes to drawing or animation data. */
'use strict';
(()=>{
 const root=document.querySelector('.app');
 if(!root)return;
 const docks=[...document.querySelectorAll('.inspector .panel'),document.querySelector('.editor .timeline')].filter(Boolean);
 const threshold=28;
 const isInteractive=target=>Boolean(target.closest('button,input,select,textarea,a,[role="button"]'));
 for(const panel of docks){
  const timeline=panel.classList.contains('timeline'),header=panel.querySelector(timeline?'.section-head':'.panel-head');
  if(!header)return;
  const title=header.querySelector('strong')?.textContent?.trim()||'Painel';
  const handle=document.createElement('button');
  handle.type='button';handle.className='studio-dock-toggle';
  handle.setAttribute('aria-label','Recolher ou expandir '+title);
  handle.setAttribute('aria-expanded','true');
  handle.title='Arraste para baixo para minimizar; para cima para expandir, ou clique';
  handle.textContent='⌄';
  header.append(handle);
  let drag=null;
  const minimizedClass=timeline?'studio-timeline-minimized':'studio-panel-minimized';
  const setCollapsed=value=>{
   panel.classList.toggle(minimizedClass,Boolean(value));
   handle.setAttribute('aria-expanded',String(!value));
   handle.title=(value?'Expandir ':'Recolher ')+title+' — arraste o cabeçalho ou clique';
   handle.textContent=value?'⌃':'⌄';
   if(timeline){panel.style.height=value?'42px':'';}
  };
  handle.addEventListener('click',()=>setCollapsed(!panel.classList.contains(minimizedClass)));
  header.addEventListener('pointerdown',event=>{
   if(event.button!==0||isInteractive(event.target))return;
   drag={y:event.clientY,moved:false};
   try{header.setPointerCapture(event.pointerId);}catch(_e){}
  });
  header.addEventListener('pointermove',event=>{
   if(!drag)return;
   const dy=event.clientY-drag.y;
   if(Math.abs(dy)<threshold)return;
   drag.moved=true;
   if(dy>0)setCollapsed(true);
   else setCollapsed(false);
   drag.y=event.clientY;
  });
  const release=()=>{drag=null;};
  header.addEventListener('pointerup',release);
  header.addEventListener('pointercancel',release);
  header.addEventListener('lostpointercapture',release);
  // Double-clicking the title also toggles panels for trackpad / keyboard users.
  header.addEventListener('dblclick',event=>{
   if(isInteractive(event.target))return;
   setCollapsed(!panel.classList.contains(minimizedClass));
  });
 }
})();
