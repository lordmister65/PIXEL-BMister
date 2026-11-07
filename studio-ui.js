/* PIXEL-BMister — Studio UX V1.7, no framework. */
'use strict';
(()=>{
 const $=id=>document.getElementById(id);
 const nav=document.querySelector('.inspector-tabs');
 const aside=document.querySelector('.inspector');
 const viewport=$('canvasViewport');
 const studio=window.PixelStudioCanvas;
 const layout=document.querySelector('.workspace');
 const root=document.querySelector('.app');
 if(!nav||!aside||!viewport||!studio||!layout||!root)return;
 const links=[...nav.querySelectorAll('a[href^="#"]')];
 const activate=link=>{
   links.forEach(a=>{
     const selected=a===link;
     a.classList.toggle('active',selected);
     if(selected)a.setAttribute('aria-current','true');
     else a.removeAttribute('aria-current');
   });
 };
 links.forEach(link=>link.addEventListener('click',event=>{
   const id=link.getAttribute('href').slice(1),section=document.getElementById(id);
   if(!section)return;
   event.preventDefault();activate(link);
   const destination=section.getBoundingClientRect().top-aside.getBoundingClientRect().top+aside.scrollTop-67;
   aside.scrollTo({top:Math.max(0,destination),behavior:'smooth'});
 }));
 if(links.length)activate(links[0]);

 const setPress=(button,value)=>button?.setAttribute('aria-pressed',String(value));
 const toolsButton=$('toggleToolsBtn'),inspectorButton=$('toggleInspectorBtn'),focusButton=$('focusModeBtn');
 const resizer=$('inspectorResizer'),centerButton=$('centerCanvasBtn'),restoreInspectorButton=$('showInspectorBtn');
 let toolsCollapsed=false,inspectorCollapsed=false,focus=false;
 const applyPanels=()=>{
   layout.classList.toggle('studio-tools-collapsed',toolsCollapsed);
   layout.classList.toggle('studio-inspector-collapsed',inspectorCollapsed);
   root.classList.toggle('studio-focus-mode',focus);
   setPress(toolsButton,!toolsCollapsed);
   setPress(inspectorButton,!inspectorCollapsed);
   setPress(restoreInspectorButton,!inspectorCollapsed);
   setPress(focusButton,focus);
   inspectorButton.title=inspectorCollapsed?'Mostrar painel direito':'Recolher painel direito';
   inspectorButton.textContent=inspectorCollapsed?'‹':'›';
 };
 toolsButton?.addEventListener('click',()=>{toolsCollapsed=!toolsCollapsed;applyPanels();});
 inspectorButton?.addEventListener('click',()=>{inspectorCollapsed=!inspectorCollapsed;applyPanels();});
 restoreInspectorButton?.addEventListener('click',()=>{inspectorCollapsed=!inspectorCollapsed;applyPanels();});
 focusButton?.addEventListener('click',()=>{focus=!focus;applyPanels();});
 applyPanels();

 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 let inspectorWidth=284;
 function resizeInspector(width){
   inspectorWidth=clamp(Math.round(width),220,480);
   layout.style.setProperty('--studio-inspector-width',inspectorWidth+'px');
   resizer?.setAttribute('aria-valuenow',String(inspectorWidth));
 }
 resizeInspector(inspectorWidth);
 if(resizer){
   let drag=null;
   resizer.addEventListener('pointerdown',event=>{
     if(event.button!==0||window.matchMedia('(max-width:720px)').matches)return;
     event.preventDefault();
     drag={start:event.clientX,width:inspectorWidth};
     resizer.setPointerCapture(event.pointerId);
     resizer.classList.add('dragging');
   });
   resizer.addEventListener('pointermove',event=>{
     if(!drag)return;
     resizeInspector(drag.width+drag.start-event.clientX);
   });
   const stopResize=()=>{drag=null;resizer.classList.remove('dragging');};
   resizer.addEventListener('pointerup',stopResize);
   resizer.addEventListener('pointercancel',stopResize);
   resizer.addEventListener('lostpointercapture',stopResize);
   resizer.addEventListener('keydown',event=>{
     if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
     event.preventDefault();
     resizeInspector(inspectorWidth+(event.key==='ArrowLeft'?12:-12));
   });
 }
 centerButton?.addEventListener('click',()=>studio.center());
 const canvasFit=$('fitBtn');
 if(canvasFit)canvasFit.addEventListener('click',()=>requestAnimationFrame(()=>studio.center()));

 // Menus are native <details>, accessible by keyboard and touch.
 const menus=[...document.querySelectorAll('.studio-menu')];
 menus.forEach(menu=>{
   menu.addEventListener('toggle',()=>{
     if(!menu.open)return;
     menus.forEach(other=>{if(other!==menu)other.open=false;});
   });
   menu.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{menu.open=false;}));
 });
 document.addEventListener('pointerdown',event=>{
   menus.forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
 });

 let spaceHeld=false,pan=null;
 const targetIsText=el=>el&&(['INPUT','TEXTAREA','SELECT','BUTTON','SUMMARY','A'].includes(el.tagName)||el.isContentEditable||!!el.closest?.('button,a,summary,[role="button"]'));
 document.addEventListener('keydown',event=>{
   if(document.querySelector('dialog[open]')||targetIsText(event.target))return;
   if(event.code==='Space'&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
     spaceHeld=true;
     viewport.classList.add('studio-pan-ready');
     event.preventDefault();event.stopImmediatePropagation();
   }else if(event.key==='Tab'&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
     // Tab remains available for keyboard accessibility. Use Shift+D for focus mode.
   }else if(event.key.toLowerCase()==='d'&&event.shiftKey&&!event.ctrlKey&&!event.altKey&&!event.metaKey){
     event.preventDefault();focus=!focus;applyPanels();
   }else if(event.key==='Escape'&&focus){
     focus=false;applyPanels();
   }
 },true);
 document.addEventListener('keyup',event=>{
   if(event.code!=='Space')return;
   spaceHeld=false;
   if(!pan)viewport.classList.remove('studio-pan-ready');
 },true);
 window.addEventListener('blur',()=>{spaceHeld=false;pan=null;viewport.classList.remove('studio-panning','studio-pan-ready');});
 viewport.addEventListener('pointerdown',event=>{
   if(!(spaceHeld&&event.button===0)&&event.button!==1)return;
   if(document.querySelector('dialog[open]'))return;
   // Capture before overlayCanvas's editor drawing handler.
   event.preventDefault();event.stopImmediatePropagation();
   pan={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
   viewport.setPointerCapture(event.pointerId);
   viewport.classList.add('studio-panning');
 },true);
 viewport.addEventListener('pointermove',event=>{
   if(!pan)return;
   event.preventDefault();event.stopImmediatePropagation();
   viewport.scrollLeft=pan.left+pan.x-event.clientX;
   viewport.scrollTop=pan.top+pan.y-event.clientY;
 },true);
 const finishPan=event=>{
   if(!pan)return;
   event.stopImmediatePropagation();
   pan=null;viewport.classList.remove('studio-panning');
   if(!spaceHeld)viewport.classList.remove('studio-pan-ready');
 };
 viewport.addEventListener('pointerup',finishPan,true);
 viewport.addEventListener('pointercancel',finishPan,true);
 viewport.addEventListener('lostpointercapture',()=>{pan=null;viewport.classList.remove('studio-panning');});
 viewport.addEventListener('wheel',event=>{
   if(document.querySelector('dialog[open]'))return;
   event.preventDefault();
   // Keep the pixel under the cursor anchored when zoom changes.
   const rect=viewport.getBoundingClientRect();
   const mouseX=event.clientX-rect.left,mouseY=event.clientY-rect.top;
   const oldWidth=viewport.scrollWidth,oldHeight=viewport.scrollHeight;
   const oldScrollX=viewport.scrollLeft,oldScrollY=viewport.scrollTop;
   const oldZoom=studio.getZoom();
   const next=studio.setZoom(oldZoom+(event.deltaY<0?1:-1));
   if(next===oldZoom)return;
   const scale=next/oldZoom;
   const newWidth=viewport.scrollWidth,newHeight=viewport.scrollHeight;
   const oldPadX=Math.max(0,(viewport.clientWidth-oldWidth)/2);
   const oldPadY=Math.max(0,(viewport.clientHeight-oldHeight)/2);
   const newPadX=Math.max(0,(viewport.clientWidth-newWidth)/2);
   const newPadY=Math.max(0,(viewport.clientHeight-newHeight)/2);
   viewport.scrollLeft=Math.max(0,(mouseX+oldScrollX-oldPadX)*scale+newPadX-mouseX);
   viewport.scrollTop=Math.max(0,(mouseY+oldScrollY-oldPadY)*scale+newPadY-mouseY);
 },{passive:false});
})();
