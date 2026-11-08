/* PIXEL-BMister: Aseprite-style document tabs, within the same web page.
   The classic editor and tiled 10k engine share one workspace. */
'use strict';
(function(root){
 const bar=document.getElementById('documentTabs'),newTab=document.getElementById('newDocumentTab');
 if(!bar||!newTab)return;
 const tabs=new Map();
 let current='classic-draft',currentClassic='classic-draft',switching=false;
 const original=document.getElementById('studioDocumentTab');
 const studio=()=>root.PixelStudioEditor;
 const manager=()=>root.PixelProjectManager;
 const big=()=>root.PixelBigCanvas;
 const fmt=n=>Number(n).toLocaleString('pt-BR');
 function add(item){
  tabs.set(item.id,item);
  let node=item.node;
  if(!node){
   node=document.createElement('div');node.className='document-tab-entry';
   const button=document.createElement('button');button.type='button';button.className='document-tab';
   button.setAttribute('role','tab');button.setAttribute('aria-selected','false');
   button.setAttribute('aria-controls','canvasViewport');button.title='Abrir '+item.name;
   const symbol=document.createElement('span');symbol.className='document-tab-symbol';
   symbol.textContent=item.type==='large'?'▤':'▦';
   const name=document.createElement('span');name.className='document-tab-title';
   const size=document.createElement('span');size.className='document-tab-size';
   button.append(symbol,name,size);
   button.onclick=()=>{void activate(item.id);};
   const close=document.createElement('button');close.type='button';close.className='document-tab-close';
   close.title='Fechar documento (mantém arquivos salvos)';close.setAttribute('aria-label','Fechar '+item.name);
   close.textContent='×';close.onclick=()=>{void closeDocument(item.id);};
   node.append(button,close);item.node=node;item.button=button;item.nameNode=name;item.sizeNode=size;item.closeButton=close;
   bar.insertBefore(node,newTab);
  }
  item.nameNode.textContent=item.name||'Sem título';
  item.sizeNode.textContent=fmt(item.width)+' × '+fmt(item.height);
  item.button.title=item.name;
  refresh();
 }
 function refresh(){
  for(const item of tabs.values()){
   const active=item.id===current;
   item.node.classList.toggle('is-active',active);
   item.button.classList.toggle('is-active',active);
   item.button.setAttribute('aria-selected',String(active));
   item.button.tabIndex=active?0:-1;
   item.closeButton.disabled=tabs.size<=1;
  }
  const activeTab=tabs.get(current);
  if(activeTab)document.title=activeTab.name+' — PIXEL-BMister';
 }
 function registerClassic(id,document,{focus=true}={}){
  const token='classic-'+String(id||'draft');
  // Replace the placeholder instead of accidentally creating two copies of the first tab.
  if(!tabs.has(token)&&currentClassic==='classic-draft'&&tabs.has('classic-draft')){
   const prior=tabs.get('classic-draft');
   tabs.delete('classic-draft');
   if(prior.node)prior.node.remove();
   if(current==='classic-draft')current=token;
  }
  const entry=tabs.get(token)||{id:token,type:'classic'};
  entry.name=document?.name||'Meu projeto';entry.width=document?.width||32;entry.height=document?.height||32;
  add(entry);
  if(focus){
   currentClassic=token;
   current=token;
   if(root.document.querySelector('.app.studio-large-active'))big()?.hide();
  }else if(currentClassic==='classic-draft')currentClassic=token;
  refresh();
 }
 function registerLarge(detail){
  if(!detail?.id)return;
  const token='large-'+detail.id;
  const entry=tabs.get(token)||{id:token,type:'large',recordId:detail.id};
  entry.name=detail.name||'Arte em tela grande';entry.width=detail.width;entry.height=detail.height;
  add(entry);current=token;refresh();
 }
 async function activate(id){
  if(switching||current===id||!tabs.has(id))return;
  switching=true;
  const entry=tabs.get(id);
  try{
   if(entry.type==='large'){
    if(document.querySelector('.app.studio-large-active')&&big()?.getProject()){
     // A background save is queued, never discarded when switching documents.
     void big().saveCurrent()?.catch(e=>console.warn('Falha ao salvar aba 10K:',e));
    }
    const ok=big()?.selectDocument(entry.recordId);
    if(!ok)throw Error('Documento grande não está aberto');
    current=id;
   }else{
    const previousClassic=currentClassic;
    if(entry.id!==previousClassic){
     const raw=entry.id.slice(8);
     if(raw==='draft')throw Error('Rascunho não disponível na biblioteca');
     await manager()?.openRecord(raw);
    }else if(document.querySelector('.app.studio-large-active')){
     void big()?.saveCurrent()?.catch(()=>{});
     big()?.hide();
    }
    currentClassic=id;current=id;
   }
   refresh();
  }catch(e){console.error('Erro ao trocar projeto:',e);alert('Não foi possível abrir a aba: '+e.message);}
  finally{switching=false;}
 }
 async function closeDocument(id){
  const entry=tabs.get(id);if(!entry||tabs.size===1)return;
  if(entry.type==='large'){
   const activeBig=big()?.getProject()?.id===entry.recordId&&document.querySelector('.app.studio-large-active');
   if(activeBig){try{await big().saveCurrent();}catch(_e){if(!confirm('Falha ao salvar. Fechar mesmo assim?'))return;}}
   big()?.closeDocument(entry.recordId);
  }
  tabs.delete(id);entry.node?.remove();
  if(currentClassic===id)currentClassic=[...tabs.values()].find(x=>x.type==='classic')?.id||'';
  if(current===id){
   let next=currentClassic&&tabs.has(currentClassic)?currentClassic:[...tabs.keys()][0];
   if(next){current='';await activate(next);}
  }
  refresh();
 }
 const first=studio()?.getProject()||{name:document.getElementById('projectName')?.value||'Meu primeiro sprite',width:32,height:32};
 // Replace the temporary server-side tab with a live one.
 original?.remove();
 registerClassic('draft',first);
 root.addEventListener('pixel-document-activated',e=>registerLarge(e.detail));
 newTab.onclick=()=>document.getElementById('blankProjectDialog')?.showModal();
 document.getElementById('projectName')?.addEventListener('input',()=>{
  if(document.querySelector('.app.studio-large-active'))return;
  const tab=tabs.get(currentClassic);
  if(tab){tab.name=document.getElementById('projectName').value||'Sem título';add(tab);}
 });
 root.PixelDocumentTabs={registerClassic,registerLarge,activate,closeDocument,getActive:()=>current,getTabs:()=>[...tabs.values()].map(t=>({id:t.id,type:t.type,name:t.name,width:t.width,height:t.height}))};
})(window);