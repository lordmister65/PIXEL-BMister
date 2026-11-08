/* PIXEL-BMister Big Canvas 1.0 — sparse tiles support 10,000 × 10,000.
 * Dedicated static-art workspace; classic sprite animator is unchanged.
 * Tile size 128px, with only painted tiles allocated.
 */
'use strict';
(function(root){
const $=id=>document.getElementById(id),TILE=128,MAX=10000,MAX_TILES=6400,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const studioRoot=document.querySelector('.app'),canvas=$('largeDrawCanvas'),ctx=canvas.getContext('2d'),viewport=$('largeViewport');
const isActive=()=>studioRoot.classList.contains('studio-large-active');
let checkerPattern=null;
const DB='pixel-bmister-big-v1',TABLE='works';
let project=null,selected=0,tool='pencil',color='#9b90ac',brush=1,zoom=1,camX=0,camY=0,gesture=null,pan=null,space=false,saveTimeout=null,revision=0;
let undo=[],redo=[],pendingDraw=false,dbPromise=null,busy=false;
const documents=new Map();let selectionBox=null,selectionDrag=null,largeClipboard=null;
const makeId=()=>root.crypto?.randomUUID?.()||'big-'+Date.now()+'-'+Math.random().toString(36).slice(2);
const tilesCount=()=>project.layers.reduce((n,l)=>n+l.tiles.size,0);
const blankLayer=name=>({id:makeId(),name,visible:true,locked:false,opacity:1,tiles:new Map()});
function create(w,h,name='Arte em tela grande'){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<8||h<8||w>MAX||h>MAX)throw Error('Dimensões permitidas: 8 a 10.000 px');
 return{id:makeId(),name,width:w,height:h,layers:[blankLayer('Arte')],updated:Date.now()};
}
const key=(x,y)=>x+','+y;
function tile(layer,tx,ty,createIt=false){
 let c=layer.tiles.get(key(tx,ty));
 if(!c&&createIt){
  if(tilesCount()>=MAX_TILES)throw Error('Limite de blocos deste documento atingido. Faça backup do trabalho.');
  c=document.createElement('canvas');c.width=TILE;c.height=TILE;layer.tiles.set(key(tx,ty),c);
 }
 return c;
}
function active(){return project.layers[selected];}
function status(text){$('largeStatus').textContent=text; if(isActive())$('statusText').textContent=text;}
function bounds(){return{w:canvas.clientWidth,h:canvas.clientHeight};}
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function pixel(p){return{x:Math.floor(camX+p.x/zoom),y:Math.floor(camY+p.y/zoom)};}
function center(){const b=bounds();camX=(project.width-b.w/zoom)/2;camY=(project.height-b.h/zoom)/2;requestDraw();}
function fit(){const b=bounds();zoom=clamp(Math.min(b.w/project.width,b.h/project.height)*.92,.02,32);center();setZoom();}
function setZoom(){const label=Math.round(zoom*100)+'%';$('largeZoomLabel').textContent=label;if(isActive()){$('zoomMini').textContent=label;$('zoomLabel').textContent=label;}requestDraw();}
function resize(){
 const box=viewport.getBoundingClientRect();if(box.width<20||box.height<20)return;
 const dpr=Math.min(root.devicePixelRatio||1,2);
 canvas.style.width=Math.max(220,box.width)+'px';canvas.style.height=Math.max(220,box.height)+'px';
 canvas.width=Math.floor(Math.max(220,box.width)*dpr);canvas.height=Math.floor(Math.max(220,box.height)*dpr);
 requestDraw();
}
const renderTile=(l,t,x,y)=>{ctx.globalAlpha=l.opacity;ctx.drawImage(t,(x*TILE-camX)*zoom,(y*TILE-camY)*zoom,TILE*zoom,TILE*zoom);};
function requestDraw(){if(pendingDraw)return;pendingDraw=true;requestAnimationFrame(()=>{pendingDraw=false;draw();});}
function draw(){
 if(!project||!isActive())return;
 const b=bounds();if(!b.w||!b.h)return;const dpr=canvas.width/b.w;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#1c1c1f';ctx.fillRect(0,0,b.w,b.h);
 const left=-camX*zoom,top=-camY*zoom;
 ctx.fillStyle='#303035';ctx.fillRect(left-3,top-3,project.width*zoom+6,project.height*zoom+6);
 if(!checkerPattern)refreshCheckerPattern();
 ctx.fillStyle=checkerPattern||'#f0eff1';
 ctx.fillRect(left,top,project.width*zoom,project.height*zoom);
 ctx.save();ctx.beginPath();ctx.rect(left,top,project.width*zoom,project.height*zoom);ctx.clip();
 const minX=Math.max(0,Math.floor(camX/TILE)),maxX=Math.min(Math.ceil(project.width/TILE),Math.ceil((camX+b.w/zoom)/TILE));
 const minY=Math.max(0,Math.floor(camY/TILE)),maxY=Math.min(Math.ceil(project.height/TILE),Math.ceil((camY+b.h/zoom)/TILE));
 for(const l of project.layers){if(!l.visible)continue;
  for(let ty=minY;ty<maxY;ty++)for(let tx=minX;tx<maxX;tx++){const c=tile(l,tx,ty);if(c)renderTile(l,c,tx,ty);}
 }
 ctx.restore();ctx.globalAlpha=1;
 if(zoom>=9){
  const minpx=Math.max(0,Math.floor(camX)),maxpx=Math.min(project.width,Math.ceil(camX+b.w/zoom));
  const minpy=Math.max(0,Math.floor(camY)),maxpy=Math.min(project.height,Math.ceil(camY+b.h/zoom));
  ctx.strokeStyle='#70707836';ctx.lineWidth=.7;ctx.beginPath();
  for(let x=minpx;x<=maxpx;x++){const xx=(x-camX)*zoom;ctx.moveTo(xx,Math.max(0,top));ctx.lineTo(xx,Math.min(b.h,top+project.height*zoom));}
  for(let y=minpy;y<=maxpy;y++){const yy=(y-camY)*zoom;ctx.moveTo(Math.max(0,left),yy);ctx.lineTo(Math.min(b.w,left+project.width*zoom),yy);}
  ctx.stroke();
 }
 if(selectionBox){const x=(selectionBox.x-camX)*zoom,y=(selectionBox.y-camY)*zoom;ctx.save();ctx.strokeStyle='#d6cbeb';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.strokeRect(x+.5,y+.5,selectionBox.w*zoom,selectionBox.h*zoom);ctx.restore();}
 if(gesture&&gesture.preview&&['line','rect','ellipse','select','lasso'].includes(tool)){
  ctx.globalAlpha=.5;ctx.fillStyle=color;
  if(['line','rect','ellipse'].includes(tool))traverse(gesture.start,gesture.end,tool,(x,y)=>ctx.fillRect((x-camX)*zoom,(y-camY)*zoom,Math.max(1,brush*zoom),Math.max(1,brush*zoom)));else{ctx.strokeStyle='#b9b0cb';ctx.lineWidth=1;ctx.strokeRect((Math.min(gesture.start.x,gesture.end.x)-camX)*zoom,(Math.min(gesture.start.y,gesture.end.y)-camY)*zoom,(Math.abs(gesture.end.x-gesture.start.x)+1)*zoom,(Math.abs(gesture.end.y-gesture.start.y)+1)*zoom);}
  ctx.globalAlpha=1;
 }
}
function checkpoint(tx,ty){
 const l=active(),id=key(tx,ty);
 if(gesture.before.has(id))return;
 const c=tile(l,tx,ty);gesture.before.set(id,{layer:l.id,tx,ty,before:c?new Uint8ClampedArray(c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,TILE,TILE).data):null});
}
function restore(record,side){
 const l=project.layers.find(q=>q.id===record.layer);if(!l)return;
 const id=key(record.tx,record.ty),pixels=record[side];
 if(!pixels){l.tiles.delete(id);return;}
 const c=tile(l,record.tx,record.ty,true);
 c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),TILE,TILE),0,0);
}
function changed(){
 revision++;status('Alterações pendentes');clearTimeout(saveTimeout);
 saveTimeout=setTimeout(()=>{void save().catch(e=>status('Falha ao salvar: '+e.message));},1600);
 requestDraw();
}
function stamp(x,y,erase){
 const pro=root.PixelProfessionalTools,shape=$('brushShape')?.value||'square';
 const points=pro?.brushPoints(x,y,brush,shape)||[{x,y}];
 const mirror=$('mirrorDraw')?.checked===true;
 for(const point of points){for(const xx of (mirror?[point.x,project.width-1-point.x]:[point.x])){
  const yy=point.y;
  if(xx<0||yy<0||xx>=project.width||yy>=project.height)continue;
  const tx=Math.floor(xx/TILE),ty=Math.floor(yy/TILE),l=active();
  checkpoint(tx,ty);
  const c=tile(l,tx,ty,true),context=c.getContext('2d');
  if(erase)context.clearRect(xx%TILE,yy%TILE,1,1);
  else{context.fillStyle=color;context.fillRect(xx%TILE,yy%TILE,1,1);}
 }}
}
function line(a,b,fn){
 let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx-dy;
 for(;;){fn(x,y);if(x===b.x&&y===b.y)break;const two=2*err;if(two>-dy){err-=dy;x+=sx;}if(two<dx){err+=dx;y+=sy;}}
}
function traverse(a,b,shape,fn){
 if(shape==='line')return line(a,b,fn);
 if(shape==='ellipse'){
  const rx=Math.max(.5,Math.abs(b.x-a.x)/2),ry=Math.max(.5,Math.abs(b.y-a.y)/2);
  const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
  const n=Math.min(50000,Math.max(12,Math.ceil(Math.PI*(rx+ry)*2)));
  let prev=null;
  for(let i=0;i<=n;i++){
   const theta=i/n*Math.PI*2,p={x:Math.round(cx+rx*Math.cos(theta)),y:Math.round(cy+ry*Math.sin(theta))};
   if(prev)line(prev,p,fn);prev=p;
  }
  return;
 }
 const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);
 line({x:x0,y:y0},{x:x1,y:y0},fn);line({x:x0,y:y1},{x:x1,y:y1},fn);
 line({x:x0,y:y0},{x:x0,y:y1},fn);line({x:x1,y:y0},{x:x1,y:y1},fn);
}
function finish(){
 if(!gesture)return;
 if(gesture.before.size){
  const l=active(),changes=[...gesture.before.values()].map(rec=>{
   const c=tile(l,rec.tx,rec.ty);
   return {...rec,after:c?new Uint8ClampedArray(c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,TILE,TILE).data):null};
  });
  undo.push(changes);if(undo.length>16)undo.shift();redo=[];changed();
 }
 gesture=null;requestDraw();
}
function restoreHistory(stack,other,side){
 const changes=stack.pop();if(!changes)return;
 for(const c of changes)restore(c,side);
 other.push(changes);changed();
}
function setTool(name){
 tool=name;
 document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===name));
 document.querySelectorAll('[data-large-tool]').forEach(b=>b.classList.toggle('active',b.dataset.largeTool===name));
}
function zoomAt(next,p){const before=pixel(p);zoom=clamp(next,.02,32);camX=before.x-p.x/zoom;camY=before.y-p.y/zoom;setZoom();}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(!project||![0,1,2].includes(e.button))return;
 e.preventDefault();const p=point(e),w=pixel(p);
 const common=root.PixelStudioEditor;tool=common?.getTool()||tool;color=common?.getColor()||color;brush=common?.getBrushSize()||brush;
 if(space||e.button===1){pan={x:e.clientX,y:e.clientY,cx:camX,cy:camY};canvas.setPointerCapture(e.pointerId);return;}
 const layer=active();if(layer.locked||!layer.visible){status('Camada bloqueada ou oculta');return;}
 if(tool==='eyedropper'){
  for(let i=project.layers.length-1;i>=0;i--){const l=project.layers[i],c=tile(l,Math.floor(w.x/TILE),Math.floor(w.y/TILE));if(!l.visible||!c)continue;
   const col=c.getContext('2d').getImageData(w.x%TILE,w.y%TILE,1,1).data;
   if(col[3]){color='#'+[col[0],col[1],col[2]].map(v=>v.toString(16).padStart(2,'0')).join('');$('largeColor').value=color;break;}
  }return;
 }
 gesture={before:new Map(),start:w,end:w};canvas.setPointerCapture(e.pointerId);
 if(tool==='pencil'||tool==='eraser')stamp(w.x,w.y,tool==='eraser'||e.button===2);
 requestDraw();
});
canvas.addEventListener('pointermove',e=>{
 if(!project)return;
 const p=point(e),w=pixel(p);$('largePointer').textContent='X: '+clamp(w.x,0,project.width-1)+' · Y: '+clamp(w.y,0,project.height-1);
 if(pan){camX=pan.cx+(pan.x-e.clientX)/zoom;camY=pan.cy+(pan.y-e.clientY)/zoom;requestDraw();return;}
 if(!gesture)return;
 if(tool==='pencil'||tool==='eraser')line(gesture.end,w,(x,y)=>stamp(x,y,tool==='eraser'||e.buttons===2));
 gesture.end=w;requestDraw();
});
canvas.addEventListener('pointerup',e=>{
 if(pan){pan=null;return;}
 if(!gesture)return;const end=pixel(point(e));
 if(['line','rect','ellipse'].includes(tool))traverse(gesture.start,end,tool,(x,y)=>stamp(x,y,false));
 finish();
});
canvas.addEventListener('pointercancel',()=>{pan=null;finish();});
canvas.addEventListener('wheel',e=>{if(!isActive())return;e.preventDefault();zoomAt(zoom*(e.deltaY<0?1.25:.8),point(e));},{passive:false});
document.addEventListener('keydown',e=>{
 if(!isActive()||e.target.closest('input,textarea,select,button')||$('largeProjectsDialog').open)return;
 if(e.code==='Space'){space=true;e.preventDefault();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?restoreHistory(redo,undo,'after'):restoreHistory(undo,redo,'before');return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();restoreHistory(redo,undo,'after');return;}
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const shortcuts={b:'pencil',e:'eraser',l:'line',r:'rect',i:'eyedropper'};
 if(shortcuts[e.key.toLowerCase()])setTool(shortcuts[e.key.toLowerCase()]);
});
document.addEventListener('keyup',e=>{if(e.code==='Space')space=false;});root.addEventListener('blur',()=>{space=false;pan=null;});
function openDB(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{if(!root.indexedDB)return reject(Error('IndexedDB indisponível'));const r=root.indexedDB.open(DB,1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(TABLE))r.result.createObjectStore(TABLE,{keyPath:'id'});};
  r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
 return dbPromise;
}
async function store(mode,action){
 const db=await openDB();
 return new Promise((resolve,reject)=>{const t=db.transaction(TABLE,mode),req=action(t.objectStore(TABLE));t.oncomplete=()=>resolve(req?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
}
function encodeBytes(bytes){let s='';for(let p=0;p<bytes.length;p+=8192)s+=String.fromCharCode(...bytes.subarray(p,p+8192));return btoa(s);}
function decodeBytes(s){const bin=atob(s),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
async function serialize(source=project){
 const record={format:'Pixel-BMister-Tiled',version:1,id:source.id,name:source.name,width:source.width,height:source.height,updated:Date.now(),layers:[]};
 for(const layer of source.layers){
  const cells=[];
  for(const [id,c] of layer.tiles){
   const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
   if(!blob)throw Error('Falha ao codificar bloco');
   cells.push([id,encodeBytes(new Uint8Array(await blob.arrayBuffer()))]);
  }
  record.layers.push({id:layer.id,name:layer.name,visible:layer.visible,locked:layer.locked,opacity:layer.opacity,cells});
 }
 return record;
}
async function load(record){
 if(!record||record.format!=='Pixel-BMister-Tiled'||!Number.isInteger(record.width)||!Number.isInteger(record.height)||record.width<8||record.height<8||record.width>MAX||record.height>MAX||!Array.isArray(record.layers)||record.layers.length<1||record.layers.length>16)throw Error('Arquivo de projeto inválido');
 const result={id:record.id||makeId(),name:record.name||'Tela grande',width:record.width,height:record.height,updated:record.updated||Date.now(),layers:[]};
 let count=0;
 for(const item of record.layers){
  const layer=blankLayer(String(item.name||'Camada').slice(0,60));layer.id=item.id||makeId();layer.visible=item.visible!==false;layer.locked=!!item.locked;layer.opacity=clamp(Number(item.opacity??1),0,1);
  if(!Array.isArray(item.cells))throw Error('Blocos inválidos');
  count+=item.cells.length;if(count>MAX_TILES)throw Error('Projeto excede o limite de blocos');
  for(const [id,encoded] of item.cells){
   if(!/^\d+,\d+$/.test(id)||typeof encoded!=='string'||encoded.length>100000)throw Error('Bloco inválido');
   const [x,y]=id.split(',').map(Number);
   if(x*TILE>=result.width||y*TILE>=result.height)throw Error('Bloco fora da imagem');
   const blob=new Blob([decodeBytes(encoded)],{type:'image/png'}),image=await createImageBitmap(blob);
   if(image.width!==TILE||image.height!==TILE){image.close();throw Error('Tamanho de bloco inválido');}
   const c=document.createElement('canvas');c.width=c.height=TILE;c.getContext('2d').drawImage(image,0,0);image.close();layer.tiles.set(id,c);
  }
  result.layers.push(layer);
 }
 project=result;selected=0;undo=[];redo=[];$('largeName').value=project.name;$('largeDimensions').textContent=project.width.toLocaleString('pt-BR')+' × '+project.height.toLocaleString('pt-BR');
 renderLayers();enterStudio();fit();saveState();emitDocument();status('Projeto carregado');
}
let write=Promise.resolve();
async function save(){
 if(!project)return;
 const rev=revision,source=project;source.name=$('largeName').value.slice(0,60)||'Tela grande';
 const task=write.catch(()=>{}).then(async()=>{const r=await serialize(source);await store('readwrite',s=>s.put(r));return r;});write=task;
 try{await task;if(source===project&&rev===revision)status('Projeto salvo neste navegador');return true;}
 catch(e){status('Falha no salvamento — exporte o arquivo');throw e;}
}
function schedule(){revision++;status('Alterações pendentes');clearTimeout(saveTimeout);saveTimeout=setTimeout(()=>{void save().catch(()=>{});},1200);}
function renderLayers(){
 const list=$('largeLayerList');list.replaceChildren();
 project.layers.forEach((l,i)=>{const row=document.createElement('div');row.className='large-layer'+(selected===i?' active':'');
  const choose=document.createElement('button');choose.textContent=l.name;choose.onclick=()=>{selected=i;renderLayers();};choose.title='Selecionar camada';
  const eye=document.createElement('button');eye.textContent=l.visible?'◉':'○';eye.title='Alternar visibilidade';eye.onclick=()=>{l.visible=!l.visible;renderLayers();schedule();requestDraw();};
  const lock=document.createElement('button');lock.textContent=l.locked?'▣':'◇';lock.title='Bloquear ou desbloquear';lock.onclick=()=>{l.locked=!l.locked;renderLayers();schedule();};
  row.append(choose,eye,lock);list.prepend(row);
 });
 if(isActive()){
  const holder=$('layerList');holder.replaceChildren();
  project.layers.forEach((l,i)=>{
   const row=document.createElement('div');row.className='layer-item'+(i===selected?' active':'');
   row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label','Selecionar camada '+l.name);
   row.setAttribute('aria-pressed',String(i===selected));
   const choose=document.createElement('span');choose.className='layer-name';choose.textContent=l.name;
   const chip=document.createElement('span');chip.className='layer-chip';chip.textContent=i+1;
   const eye=document.createElement('button');eye.className='eye-btn'+(l.visible?'':' off');eye.textContent=l.visible?'◉':'◌';eye.title='Alternar visibilidade';
   eye.onclick=e=>{e.stopPropagation();l.visible=!l.visible;schedule();renderLayers();requestDraw();};
   const lock=document.createElement('button');lock.className='layer-lock'+(l.locked?' locked':'');lock.textContent=l.locked?'▣':'◇';
   lock.title=l.locked?'Desbloquear camada':'Bloquear camada';
   lock.onclick=e=>{e.stopPropagation();l.locked=!l.locked;schedule();renderLayers();};
   row.onclick=()=>{selected=i;renderLayers();};
   row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selected=i;renderLayers();}};
   row.append(eye,chip,choose,lock);holder.prepend(row);
  });
  $('opacityInput').value=Math.round(active().opacity*100);
  $('opacityValue').textContent=Math.round(active().opacity*100)+'%';
 }
}
function activate(p){
 saveState();project=p;selected=0;undo=[];redo=[];revision=0;selectionBox=null;$('largeName').value=p.name;
 $('largeDimensions').textContent=p.width.toLocaleString('pt-BR')+' × '+p.height.toLocaleString('pt-BR');
 renderLayers();enterStudio();fit();saveState();emitDocument();status('Projeto aberto — desenhe para começar');
}
async function start(w,h,name){
 if(project&&revision)await save();
 activate(create(w,h,name));schedule();
}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function safeName(){return(project.name||'pixel-bmister').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,50);}
async function exportPNG(){
 if(busy)return;busy=true;const button=$('largeExport');button.disabled=true;status('Gerando PNG...');
 try{
  // Full-size export is browser-memory intensive; warn rather than freezing silently.
  const pixels=project.width*project.height;
  if(pixels>25000000&&!confirm('A exportação PNG desta imagem usa muita memória ('+Math.round(pixels*4/1048576)+' MB ou mais). Deseja continuar?'))return;
  const out=document.createElement('canvas');out.width=project.width;out.height=project.height;
  if(out.width!==project.width||out.height!==project.height)throw Error('Canvas incompatível com este tamanho');
  const c=out.getContext('2d');if(!c)throw Error('O navegador não suporta um canvas deste tamanho');
  c.imageSmoothingEnabled=false;
  for(const l of project.layers){if(!l.visible)continue;c.globalAlpha=l.opacity;for(const [id,img] of l.tiles){const [tx,ty]=id.split(',').map(Number);c.drawImage(img,tx*TILE,ty*TILE);}}
  const blob=await new Promise(resolve=>out.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG não pôde ser gerado neste navegador');
  download(blob,safeName()+'.png');status('PNG exportado');
 }catch(e){status(e.message);}finally{busy=false;button.disabled=false;}
}
async function saveFile(){try{const data=await serialize();download(new Blob([JSON.stringify(data)],{type:'application/json'}),safeName()+'.pxbig');status('Backup exportado');}catch(e){status(e.message);}}
async function projects(){
 const records=await store('readonly',s=>s.getAll()),list=$('largeProjectList');list.replaceChildren();
 for(const record of records.sort((a,b)=>b.updated-a.updated).slice(0,80)){
  const row=document.createElement('div');row.className='large-project-row';
  const label=document.createElement('span');label.textContent=record.name+' · '+record.width+' × '+record.height;
  const open=document.createElement('button');open.className='btn';open.textContent='Abrir';open.onclick=async()=>{try{if(project&&revision)await save();await load(record);$('largeProjectsDialog').close();}catch(e){status(e.message);}};
  const remove=document.createElement('button');remove.className='btn';remove.textContent='Excluir';remove.onclick=async()=>{if(!confirm('Excluir '+record.name+' deste navegador?'))return;await store('readwrite',s=>s.delete(record.id));await projects();};
  row.append(label,open,remove);list.append(row);
 }
 if(!records.length)list.textContent='Nenhum projeto salvo em tela grande.';
 $('largeProjectsDialog').showModal();
}

/* Integrated Big Canvas: dock its existing controls inside the normal editor,
   instead of displaying a second floating application/dialog. */
function mountStudio(){
 const stage=document.querySelector('.large-stage'),editor=studioRoot.querySelector('.editor');
 editor.querySelector('.canvas-header').after(stage);
 studioRoot.classList.remove('studio-large-active');
}
function enterStudio(){
 studioRoot.classList.add('studio-large-active');
 document.getElementById('largeCanvasBtn')?.setAttribute('aria-pressed','true');
 const toggle=$('largeCanvasBtn');if(toggle)toggle.textContent='Novo projeto';
 syncStudio();
 resize();
 requestDraw();
}
function syncStudio(){
 if(!project)return;
 $('dimensions').textContent=project.width.toLocaleString('pt-BR')+' × '+project.height.toLocaleString('pt-BR');
 $('projectName').value=project.name;
 $('frameIndicator').textContent='01 / 01';
 $('sizeInfo').textContent=project.width.toLocaleString('pt-BR')+' × '+project.height.toLocaleString('pt-BR')+' px';
 renderLayers();
 const disabled=['exportSheetBtn','exportGifBtn','gameModeBtn'];
 disabled.forEach(id=>{const btn=$(id);if(btn){btn.disabled=isActive();btn.title=isActive()?'Animações e Game Lab exigem documento animado':'Ação disponível no Studio';}});
 setZoom();
}
function saveState(){
 if(!project)return;
 documents.set(project.id,{project,selected,undo,redo,zoom,camX,camY,revision,selectionBox});
}
function emitDocument(){
 if(!project)return;
 root.dispatchEvent(new CustomEvent('pixel-document-activated',{detail:{type:'large',id:project.id,name:project.name,width:project.width,height:project.height}}));
}
function selectDocument(id){
 const state=documents.get(id);
 if(!state)return false;
 saveState();
 project=state.project;selected=state.selected;undo=state.undo;redo=state.redo;
 zoom=state.zoom;camX=state.camX;camY=state.camY;revision=state.revision;selectionBox=state.selectionBox;
 $('largeName').value=project.name;
 enterStudio();renderLayers();requestDraw();emitDocument();return true;
}
function closeDocument(id){
 if(!documents.has(id))return false;
 if(project?.id===id){saveState();documents.delete(id);project=null;studioRoot.classList.remove('studio-large-active');}
 else documents.delete(id);
 return true;
}
function refreshCheckerPattern(){
 const colors=root.PixelCheckerSettings?.get?.()||{light:'#39393f',dark:'#2b2b30'};
 const tileSize=16,patternCanvas=document.createElement('canvas');
 patternCanvas.width=patternCanvas.height=tileSize*2;
 const pc=patternCanvas.getContext('2d');
 pc.fillStyle=colors.light;pc.fillRect(0,0,32,32);
 pc.fillStyle=colors.dark;pc.fillRect(0,0,16,16);pc.fillRect(16,16,16,16);
 checkerPattern=ctx.createPattern(patternCanvas,'repeat');
 requestDraw();
}
root.addEventListener('pixel-checker-changed',refreshCheckerPattern);

/* Route existing Studio controls to the active tiled document. */
function duplicateActiveLayer(){
 if(project.layers.length>=16)return status('Limite de 16 camadas');
 const original=active(),copy=blankLayer(original.name+' (cópia)');
 copy.visible=original.visible;copy.opacity=original.opacity;
 for(const [id,source] of original.tiles){
  const c=document.createElement('canvas');c.width=c.height=TILE;
  c.getContext('2d').drawImage(source,0,0);copy.tiles.set(id,c);
 }
 project.layers.splice(selected+1,0,copy);selected++;renderLayers();schedule();requestDraw();
}
function deleteActiveLayer(){
 if(project.layers.length===1)return status('Mantenha pelo menos uma camada');
 if(active().locked)return status('Desbloqueie a camada antes de excluir');
 if(!confirm('Excluir a camada "'+active().name+'"?'))return;
 project.layers.splice(selected,1);selected=Math.min(selected,project.layers.length-1);
 renderLayers();schedule();requestDraw();
}
function moveLayer(delta){
 const target=selected+delta;if(target<0||target>=project.layers.length)return;
 const [layer]=project.layers.splice(selected,1);project.layers.splice(target,0,layer);
 selected=target;renderLayers();schedule();requestDraw();
}
function mergeLayer(){
 if(selected<1)return status('Não há camada abaixo');
 const top=active(),bottom=project.layers[selected-1];
 if(top.locked||bottom.locked)return status('Desbloqueie as camadas antes de mesclar');
 if(!top.visible||!bottom.visible)return status('Torne as camadas visíveis antes de mesclar');
 for(const [id,source] of top.tiles){
  let dest=bottom.tiles.get(id);
  if(!dest){dest=document.createElement('canvas');dest.width=dest.height=TILE;bottom.tiles.set(id,dest);}
  const cx=dest.getContext('2d');cx.globalAlpha=top.opacity;cx.drawImage(source,0,0);cx.globalAlpha=1;
 }
 project.layers.splice(selected,1);selected--;renderLayers();schedule();requestDraw();
}
function syncClassic(){
 root.PixelStudioEditor?.refresh?.();
 const classic=root.PixelStudioEditor?.getProject?.();
 if(classic){
  $('projectName').value=classic.name||'Meu projeto';
  $('dimensions').textContent=classic.width+' × '+classic.height;
  $('sizeInfo').textContent=classic.width+' × '+classic.height+' px';
 }
 ['exportSheetBtn','exportGifBtn','gameModeBtn'].forEach(id=>{const b=$(id);if(b){b.disabled=false;b.title='';}});
}
function catchStudioCommands(event){
 if(!isActive())return;
 const control=event.target.closest('button');
 if(!control)return;
 const commands={
  undoBtn:()=>restoreHistory(undo,redo,'before'),redoBtn:()=>restoreHistory(redo,undo,'after'),
  historyUndo:()=>restoreHistory(undo,redo,'before'),historyRedo:()=>restoreHistory(redo,undo,'after'),
  addLayer:()=>{$('largeAddLayer').click();},
  deleteLayer:deleteActiveLayer,duplicateLayer:duplicateActiveLayer,
  layerUp:()=>moveLayer(1),layerDown:()=>moveLayer(-1),mergeLayer,
  saveBtn:saveFile,saveLibraryBtn:()=>{void save().catch(e=>status(e.message));},
  loadBtn:()=>$('largeImportFile').click(),
  importPngBtn:()=>status('Importação PNG de imagens grandes ainda não disponível'),
  exportBtn:exportPNG,
  zoomIn:()=>zoomAt(zoom*1.25,{x:canvas.clientWidth/2,y:canvas.clientHeight/2}),
  zoomOut:()=>zoomAt(zoom*.8,{x:canvas.clientWidth/2,y:canvas.clientHeight/2}),
  fitBtn:fit,centerCanvasBtn:center,
  copySelection:()=>status('Seleção em tela grande: use a ferramenta retangular'),
  cutSelection:()=>status('Recortar seleção 10K ainda não disponível'),
  pasteSelection:()=>status('Colar seleção 10K ainda não disponível'),
  clearSelection:()=>{selectionBox=null;requestDraw();},
  deselect:()=>{selectionBox=null;requestDraw();},
  flipHorizontal:()=>status('Espelhamento em tela grande ainda não disponível'),
  flipVertical:()=>status('Espelhamento em tela grande ainda não disponível')
 };
 if(Object.hasOwn(commands,control.id)){
  event.preventDefault();event.stopImmediatePropagation();
  commands[control.id]();
 }
}
document.addEventListener('click',catchStudioCommands,true);
$('opacityInput').addEventListener('input',e=>{
 if(!isActive())return;
 e.stopImmediatePropagation();
 if(active().locked)return status('Camada bloqueada');
 active().opacity=clamp(+e.target.value/100,0,1);
 $('opacityValue').textContent=Math.round(active().opacity*100)+'%';
 schedule();requestDraw();
},true);
$('projectName').addEventListener('input',e=>{
 if(!isActive())return;
 e.stopImmediatePropagation();project.name=e.target.value.slice(0,60)||'Sem título';
 $('largeName').value=project.name;schedule();emitDocument();
},true);

function attach(){
 mountStudio();
 $('largeCanvasBtn').onclick=async()=>{
  try{
   if(project&&isActive()){await start(10000,10000,'Nova arte 10K');}
   else if(project){enterStudio();emitDocument();requestDraw();}
   else await start(10000,10000);
  }catch(e){alert(e.message);}
 };
 $('largeClose').onclick=()=>{
  if(project&&revision)void save().catch(()=>{});
  studioRoot.classList.remove('studio-large-active');
  document.getElementById('largeCanvasBtn')?.setAttribute('aria-pressed','false');
  const toggle=$('largeCanvasBtn');if(toggle)toggle.textContent='Tela grande';
  syncClassic();
  document.getElementById('canvasViewport')?.focus({preventScroll:true});
 };
 $('largeAddLayer').onclick=()=>{if(project.layers.length>=16)return status('Máximo de 16 camadas neste modo');project.layers.push(blankLayer('Camada '+(project.layers.length+1)));selected=project.layers.length-1;renderLayers();schedule();};
 $('largeColor').oninput=e=>color=e.target.value;
 $('largeBrush').oninput=e=>{brush=+e.target.value;$('largeBrushValue').textContent=brush+' px';};
 $('largeName').onchange=()=>{project.name=$('largeName').value;schedule();};
 document.querySelectorAll('[data-large-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.largeTool));
 $('largeUndo').onclick=()=>restoreHistory(undo,redo,'before');$('largeRedo').onclick=()=>restoreHistory(redo,undo,'after');
 $('largeZoomIn').onclick=()=>zoomAt(zoom*1.25,{x:canvas.clientWidth/2,y:canvas.clientHeight/2});
 $('largeZoomOut').onclick=()=>zoomAt(zoom*.8,{x:canvas.clientWidth/2,y:canvas.clientHeight/2});
 $('largeZoomFit').onclick=fit;
 $('largeExport').onclick=exportPNG;$('largeSaveFile').onclick=saveFile;
 $('largeProjects').onclick=()=>{void projects().catch(e=>status(e.message));};
 $('largeProjectsClose').onclick=()=>$('largeProjectsDialog').close();
 $('largeImportBtn').onclick=()=>$('largeImportFile').click();
 $('largeImportFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;
  try{if(file.size>80*1024*1024)throw Error('Arquivo muito grande');const data=JSON.parse(await file.text());if(project&&revision)await save();await load(data);$('largeProjectsDialog').close();schedule();}
  catch(err){status(err.message);}e.target.value='';
 };
 root.addEventListener('resize',()=>{if(isActive())resize();});
}
attach();
root.PixelBigCanvas={create,open:(w,h,name)=>start(w,h,name),getProject:()=>project,selectDocument,closeDocument,saveCurrent:save,show:()=>{if(project){enterStudio();emitDocument();}},hide:()=>$('largeClose').click(),getDocumentIds:()=>[...documents.keys()]};
})(window);