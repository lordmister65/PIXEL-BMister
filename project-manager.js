/* PIXEL-BMister V1.9 — local project library (IndexedDB), welcome screen and templates. */
'use strict';
(function(root){
const DB_NAME='pixel-bmister-library-v1',STORE='projects',ACTIVE_KEY='pixel-bmister-active-id-v1';
const $=id=>document.getElementById(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const generateId=()=>root.crypto?.randomUUID?.()||('project-'+Date.now()+'-'+Math.random().toString(36).slice(2));
function openDatabase(indexedDB){
 return new Promise((resolve,reject)=>{
  if(!indexedDB){reject(new Error('IndexedDB indisponível'));return;}
  let request;
  try{request=indexedDB.open(DB_NAME,1);}catch(e){reject(e);return;}
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Não foi possível abrir a biblioteca'));
 });
}
function storage(db){
 function req(mode,action){
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
   let value,done=false;
   tx.oncomplete=()=>{done=true;resolve(value);};
   tx.onerror=()=>{if(!done)reject(tx.error||new Error('Erro no armazenamento'));};
   tx.onabort=()=>{if(!done)reject(tx.error||new Error('Gravação interrompida'));};
   try{const call=action(store);call.onsuccess=()=>{value=call.result;};call.onerror=()=>{if(!done)reject(call.error||new Error('Erro na operação'));};}
   catch(error){try{tx.abort();}catch(_error){}reject(error);}
  });
 }
 return{
  all:()=>req('readonly',s=>s.getAll()),
  get:id=>req('readonly',s=>s.get(id)),
  put:record=>req('readwrite',s=>s.put(record)),
  remove:id=>req('readwrite',s=>s.delete(id))
 };
}
function makeTemplate(type,name,width,height){
 const options={sprite16:[16,16,1,'Sprite básico'],character32:[32,32,1,'Personagem'],tileset64:[64,64,1,'Tileset'],animation32:[32,32,8,'Animação']};
 const spec=options[type]||[width,height,1,'Projeto'];
 const w=width||spec[0],h=height||spec[1],count=spec[2];
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||h<8||w>128||h>128)throw new Error('Dimensões de 8 a 128 pixels');
 const blank=()=>new Array(w*h*4).fill(0);
 const layer=n=>({name:n,visible:true,opacity:1,locked:false,pixels:blank()});
 const frames=Array.from({length:count},()=>({layers:[layer('Fundo'),layer('Arte')]}));
 const colors={dark:[53,52,60,255],mid:[114,108,123,255],light:[184,172,183,255],blue:[115,139,159,255],green:[107,145,124,255]};
 const put=(f,x,y,color)=>{
  if(x<0||y<0||x>=w||y>=h)return;
  const p=frames[f].layers[1].pixels,i=(y*w+x)*4;for(let k=0;k<4;k++)p[i+k]=color[k];
 };
 const rect=(f,x,y,ww,hh,color)=>{for(let yy=y;yy<y+hh;yy++)for(let xx=x;xx<x+ww;xx++)put(f,xx,yy,color);};
 function character(f=0,offset=0){
  const cx=Math.floor(w/2)+offset,cy=Math.floor(h/2);
  rect(f,cx-3,cy-9,7,7,colors.dark);rect(f,cx-2,cy-8,5,5,colors.light);
  put(f,cx-1,cy-6,colors.dark);put(f,cx+2,cy-6,colors.dark);
  rect(f,cx-4,cy-1,9,8,colors.blue);rect(f,cx-3,cy,7,5,colors.mid);
  rect(f,cx-6,cy,2,5,colors.light);rect(f,cx+5,cy,2,5,colors.light);
  rect(f,cx-3,cy+7,3,4,colors.dark);rect(f,cx+2,cy+7,3,4,colors.dark);
 }
 if(type==='sprite16'){
  rect(0,5,3,6,10,colors.dark);rect(0,6,4,4,8,colors.mid);
  rect(0,7,2,2,2,colors.light);put(0,7,6,colors.light);put(0,8,6,colors.light);put(0,7,10,colors.blue);
 }else if(type==='character32')character();
 else if(type==='tileset64'){
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const x=col*16,y=row*16,c=[colors.mid,colors.blue,colors.green,colors.dark][(row+col)%4];
   rect(0,x,y,16,16,colors.dark);rect(0,x+1,y+1,14,14,c);
   rect(0,x+2,y+2,12,2,colors.light);
  }
 }else if(type==='animation32'){
  for(let f=0;f<count;f++)character(f,(f%4)-1);
 }
 const tags=type==='animation32'?[{id:'template-idle',name:'Idle',start:0,end:3},{id:'template-run',name:'Run',start:4,end:7}]:[];
 return{format:'PIXEL-BMister',version:3,name:name||spec[3],width:w,height:h,fps:8,selectedFrame:0,selectedLayer:1,animationTags:tags,activeTag:'all',onionSettings:{enabled:false,previous:1,next:1,opacity:30},loop:true,frames};
}
function createManager(adapter){
 let db=null,store=null,activeId=null,initializing=true,changing=false,pending=null,lastSavedRevision=0,revision=0,writeQueue=Promise.resolve(),pendingId=null;
 const home=$('projectHome'),recent=$('recentProjectsList'),label=$('recentCount');
 const toast=message=>adapter.notice(message);
 function current(){return adapter.getProject();}
 function writeActiveId(id){activeId=id;try{if(id)localStorage.setItem(ACTIVE_KEY,id);else localStorage.removeItem(ACTIVE_KEY);}catch(_e){}}
 function ensureAvailable(){if(!store){toast('Biblioteca indisponível. Salve uma cópia em JSON.');return false;}return true;}
 async function list(){
  if(!store)return[];
  const items=await store.all();
  return items.sort((a,b)=>b.updatedAt-a.updatedAt);
 }
 async function storeSnapshot(id,document){
  if(!store)throw new Error('Biblioteca indisponível');
  const previous=await store.get(id);
  const now=Date.now();
  const record={id,name:String(document.name||'Sem título').slice(0,60),width:document.width,height:document.height,frameCount:document.frames.length,createdAt:previous?.createdAt||now,updatedAt:now,document:clone(document)};
  await store.put(record);
  return record;
 }
 async function saveCurrent(notify=true){
  if(!ensureAvailable())return false;
  const id=activeId||pendingId||(pendingId=generateId());
  const doc=current(),savedAt=revision;
  // Serialize writes: outdated autosaves cannot overwrite newer work.
  const task=writeQueue.catch(()=>{}).then(()=>storeSnapshot(id,doc));
  writeQueue=task;
  try{
   await task;
   if(!activeId){writeActiveId(id);pendingId=null;root.PixelDocumentTabs?.registerClassic(id,doc,{focus:false});}
   if(activeId===id)lastSavedRevision=Math.max(lastSavedRevision,savedAt);
   if(notify)toast('Projeto salvo na biblioteca do navegador');
   return true;
  }catch(e){
   if(pendingId===id)pendingId=null;
   toast('Falha ao salvar projeto. Exporte um JSON: '+e.message);return false;
  }
 }
 async function flush(){
  clearTimeout(pending);pending=null;
  if(!store)return false;
  try{await writeQueue;}catch(e){toast('Falha no último salvamento: '+e.message);return false;}
  if(!activeId){
   const doc=current(),painted=doc.frames.some(f=>f.layers.some(l=>l.pixels.some(v=>v!==0)));
   const customized=doc.name!=='Meu primeiro sprite'||(doc.animationTags?.length||0)>0;
   if(!painted&&!customized)return true;
   try{await storeSnapshot(generateId(),{...doc,name:(doc.name||'Rascunho')+' (recuperado)'});return true;}
   catch(e){toast('Salve o rascunho em JSON antes de continuar: '+e.message);return false;}
  }
  if(revision===lastSavedRevision)return true;
  return saveCurrent(false);
 }
 function onChanged(){
  if(initializing||changing)return;
  revision++;
  clearTimeout(pending);
  pending=setTimeout(()=>{pending=null;saveCurrent(false);},1800);
 }
 async function openRecord(id){
  if(!ensureAvailable())return;
  if(!await flush())return;
  const record=await store.get(id);
  if(!record)return toast('Projeto não encontrado');
  if(!adapter.valid(record.document))return toast('Projeto armazenado inválido');
  changing=true;
  try{
   adapter.loadProject(clone(record.document));
   writeActiveId(id);revision=0;lastSavedRevision=0;
   root.PixelDocumentTabs?.registerClassic(id,record.document);
   home.close();toast('Projeto aberto: '+record.name);
  }finally{changing=false;}
 }
 async function createDocument(doc){
  if(!ensureAvailable())return false;
  if(!adapter.valid(doc))return toast('Modelo inválido');
  if(!await flush())return false;
  const id=generateId();
  try{await storeSnapshot(id,doc);}
  catch(e){toast('Não foi possível criar projeto: '+e.message);return false;}
  changing=true;
  try{
   writeActiveId(id);adapter.loadProject(clone(doc));
   revision=0;lastSavedRevision=0;root.PixelDocumentTabs?.registerClassic(id,doc);
   home.close();toast('Projeto criado: '+doc.name);
  }finally{changing=false;}
  return true;
 }
 async function importDocument(doc){
  if(!adapter.valid(doc))return toast('Arquivo JSON inválido');
  return createDocument({...doc,name:String(doc.name||'Projeto importado').slice(0,60)});
 }
 async function removeProject(id){
  if(!ensureAvailable())return;
  const rec=await store.get(id);if(!rec)return;
  if(!confirm('Excluir "'+rec.name+'" da biblioteca deste navegador? Esta ação não pode ser desfeita.'))return;
  if(id===activeId){
   if(!await flush())return;
   await writeQueue;
   writeActiveId(null);revision=0;lastSavedRevision=0;
  }
  await store.remove(id);
  toast('Projeto excluído');await renderList();
 }
 async function duplicateProject(id){
  if(!ensureAvailable())return;
  const rec=await store.get(id);if(!rec)return;
  const copy=clone(rec.document);copy.name=rec.name+' (cópia)';
  await storeSnapshot(generateId(),copy);
  toast('Cópia criada');await renderList();
 }
 function thumbnail(project){
  const box=document.createElement('canvas');
  box.width=project.width;box.height=project.height;
  const frame=project.frames[Math.min(project.selectedFrame||0,project.frames.length-1)];
  const output=new Uint8ClampedArray(box.width*box.height*4);
  for(const l of frame.layers){
   if(l.visible===false)continue;
   const pixels=l.pixels,opacity=typeof l.opacity==='number'?l.opacity:1;
   for(let i=0;i<output.length;i+=4){
    const sa=pixels[i+3]/255*opacity,da=output[i+3]/255,a=sa+da*(1-sa);
    if(!a)continue;
    for(let k=0;k<3;k++)output[i+k]=(pixels[i+k]*sa+output[i+k]*da*(1-sa))/a;
    output[i+3]=a*255;
   }
  }
  const image=new ImageData(output,box.width,box.height);
  box.getContext('2d').putImageData(image,0,0);
  box.className='recent-project-preview';
  return box;
 }
 async function renderList(){
  recent.replaceChildren();
  if(!store){recent.textContent='Armazenamento local indisponível. Use os arquivos JSON para guardar seus trabalhos.';label.textContent='(0)';return;}
  const items=await list();
  label.textContent='('+items.length+')';
  if(!items.length){
   const empty=document.createElement('div');empty.className='project-empty-state';
   empty.textContent='Nenhum projeto recente ainda. Crie um modelo ou salve sua sessão para começar.';
   recent.append(empty);return;
  }
  for(const record of items.slice(0,40)){
   const card=document.createElement('article');card.className='recent-project-card';
   const preview=document.createElement('div');preview.className='recent-project-image';
   try{preview.append(thumbnail(record.document));}catch(_e){preview.textContent='▦';}
   const content=document.createElement('div');content.className='recent-project-detail';
   const name=document.createElement('strong');name.textContent=record.name;
   const detail=document.createElement('small');detail.textContent=record.width+' × '+record.height+' • '+record.frameCount+' frame(s)';
   const updated=document.createElement('span');updated.textContent='Editado em '+new Date(record.updatedAt).toLocaleString('pt-BR');
   content.append(name,detail,updated);
   const actions=document.createElement('div');actions.className='recent-project-actions';
   const open=document.createElement('button');open.textContent='Abrir';open.className='btn primary';open.onclick=()=>openRecord(record.id);
   const duplicate=document.createElement('button');duplicate.textContent='Duplicar';duplicate.className='btn';duplicate.onclick=()=>duplicateProject(record.id);
   const remove=document.createElement('button');remove.textContent='Excluir';remove.className='btn';remove.onclick=()=>removeProject(record.id);
   actions.append(open,duplicate,remove);
   card.append(preview,content,actions);recent.append(card);
  }
  if(items.length>40){const note=document.createElement('p');note.className='project-home-note';note.textContent='Exibindo os 40 projetos mais recentes.';recent.append(note);}
 }
 async function show(){
  await renderList();
  if(!home.open)home.showModal();
 }
 function hide(){if(home.open)home.close();}
 function bind(){
  $('homeBtn').onclick=show;
  $('projectHomeClose').onclick=hide;
  $('resumeSessionBtn').onclick=hide;
  $('refreshProjectsBtn').onclick=renderList;
  $('saveLibraryBtn').onclick=async()=>{if(await saveCurrent())await renderList();};
  $('newBlankBtn').onclick=()=>{
   $('blankProjectDialog').showModal();
  };
  $('confirmBlankProject').onclick=e=>{
   const name=$('blankProjectName').value.trim()||'Novo projeto',width=Number($('blankProjectWidth').value),height=Number($('blankProjectHeight').value);
   try{
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width>10000||height>10000)throw Error('Dimensões de 8 a 10.000 pixels');
    if(width>128||height>128){
     // Sparse tiled editor prevents allocating 8 complete RGBA frames.
     hide();
     void root.PixelBigCanvas.open(width,height,name).catch(error=>toast(error.message));
    }else{
     const doc=makeTemplate('blank',name,width,height);
     void createDocument(doc);
    }
   }catch(error){e.preventDefault();toast(error.message);}
  };
  $('importProjectHomeBtn').onclick=()=>{
   hide();
   $('fileInput').click();
  };
  document.querySelectorAll('[data-template]').forEach(button=>{
   button.addEventListener('click',()=>{void createDocument(makeTemplate(button.dataset.template));});
  });
 }
 async function init(){
  bind();
  try{db=await openDatabase(root.indexedDB);store=storage(db);}
  catch(e){toast('Biblioteca não disponível; use Salvar JSON');}
  try{
   const previous=localStorage.getItem(ACTIVE_KEY);
   if(previous&&store){const record=await store.get(previous);if(record){activeId=previous;let session=null;try{session=JSON.parse(localStorage.getItem('pixel-bmister-project-v1')||'null');}catch(_e){}if(session?.libraryId===previous&&adapter.valid(session)){revision=1;lastSavedRevision=0;}else if(adapter.valid(record.document)){changing=true;try{adapter.loadProject(clone(record.document));}finally{changing=false;}}}}
  }catch(_e){}
  initializing=false;
  root.PixelDocumentTabs?.registerClassic(activeId||'draft',current(),{focus:false});
  await show();
 }
 return {init,onChanged,saveCurrent,flush,openRecord,importDocument,newBlank:(name,width,height)=>createDocument(makeTemplate('blank',name,width,height)),show,hide,get activeId(){return activeId;}};
}
root.PixelProjectLibrary={createManager,makeTemplate,openDatabase};
})(window);