'use strict';
(()=>{
const $=id=>document.getElementById(id),c=$('artCanvas'),ctx=c.getContext('2d'),gc=$('gridCanvas'),gx=gc.getContext('2d'),oc=$('overlayCanvas'),ox=oc.getContext('2d'),nc=$('onionCanvas'),nx=nc.getContext('2d');
let w=32,h=32,z=10,fi=0,li=1,tool='pencil',ink='#ff4aaa',size=1,showGrid=true,down=false,start=null,last=null,preview=null,selection=null,playing=false,timer=null,undoStack=[],redoStack=[];
const pico=['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8','#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa','#ffffff','#2b2b36','#4b5065','#777d99','#afb7c9','#cbd7f1','#7156cb','#a36df6','#ff4aaa','#54c7ea','#71dfb3','#e27655','#ffd575','#614d44','#ed9a8e','#8c91a6'];
const blank=()=>new Uint8ClampedArray(w*h*4);
const mkLayer=name=>({name,visible:true,opacity:1,locked:false,pixels:blank()});
const mkFrame=()=>({layers:[mkLayer('Fundo'),mkLayer('Arte')]});
let frames=Array.from({length:8},mkFrame);
let animationTags=[],activeTag='all',onionEnabled=false,tagSerial=0,editingTag=null;
let clipboard=null,moving=false,moveStart=null,moveDelta={x:0,y:0},autosaveTimer=null,savingBlocked=false,hue=330,saturation=0.71,brightness=1;
const pro=window.PixelProfessionalTools;
if(!pro)throw Error('professional-tools.js não foi carregado');
let lassoPath=[],strokePath=[],strokeBase=null,strokeColor=null,resizeCorner=null,resizeTarget=null;
const frame=()=>frames[fi],layer=()=>frame().layers[li],index=(x,y)=>(y*w+x)*4,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const hex=(r,g,b)=>'#'+[r,g,b].map(n=>clamp(Math.round(n||0),0,255).toString(16).padStart(2,'0')).join('');
function copyFrames(fs){return fs.map(f=>({layers:f.layers.map(l=>({...l,pixels:new Uint8ClampedArray(l.pixels)}))}));}
const snap=()=>({w,h,fi,li,frames:copyFrames(frames),animationTags:animationTags.map(t=>({...t})),activeTag});
function checkpoint(label='Edição'){undoStack.push({...snap(),historyLabel:label});if(undoStack.length>40)undoStack.shift();redoStack.length=0;renderHistory();}
function restore(s){stop();w=s.w;h=s.h;fi=s.fi;li=clamp(s.li,0,s.frames[s.fi].layers.length-1);frames=copyFrames(s.frames);animationTags=(s.animationTags||[]).map(t=>({...t}));activeTag=s.activeTag||'all';refreshAnimationList();selection=null;resize();render();}
function undo(){if(!undoStack.length)return;const previous=undoStack.pop();redoStack.push({...snap(),historyLabel:previous.historyLabel||'Edição'});restore(previous);renderHistory();}
function redo(){if(!redoStack.length)return;const next=redoStack.pop();undoStack.push({...snap(),historyLabel:next.historyLabel||'Edição'});restore(next);renderHistory();}
let toastId;function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastId);toastId=setTimeout(()=>t.classList.remove('show'),2300);}
function composite(f){let out=new Uint8ClampedArray(w*h*4);for(const l of f.layers){if(!l.visible)continue;for(let i=0;i<out.length;i+=4){const sa=l.pixels[i+3]/255*l.opacity,da=out[i+3]/255,a=sa+da*(1-sa);if(a===0)continue;for(let j=0;j<3;j++)out[i+j]=(l.pixels[i+j]*sa+out[i+j]*da*(1-sa))/a;out[i+3]=a*255;}}return out;}
function put(context,data){const image=context.createImageData(w,h);image.data.set(data);context.putImageData(image,0,0);}
function grid(){gx.clearRect(0,0,w,h);if(!showGrid||z<7)return;gx.strokeStyle='#30394d33';gx.lineWidth=.055;gx.beginPath();for(let x=0;x<=w;x++){gx.moveTo(x,0);gx.lineTo(x,h);}for(let y=0;y<=h;y++){gx.moveTo(0,y);gx.lineTo(w,y);}gx.stroke();}
function outline(a,b,fill){let x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),ww=Math.abs(a.x-b.x)+1,hh=Math.abs(a.y-b.y)+1;ox.strokeStyle='#566af3';ox.lineWidth=.15;ox.setLineDash([.4,.2]);ox.strokeRect(x+.08,y+.08,ww-.16,hh-.16);ox.setLineDash([]);if(fill){ox.fillStyle='#6673d733';ox.fillRect(x,y,ww,hh);}}
function line(a,b,fn){let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx-dy;for(;;){fn(x,y);if(x===b.x&&y===b.y)break;let twice=err*2;if(twice>-dy){err-=dy;x+=sx;}if(twice<dx){err+=dx;y+=sy;}}}
function rect(a,b,fn){let x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),y0=Math.min(a.y,b.y),y1=Math.max(a.y,b.y);for(let x=x0;x<=x1;x++){fn(x,y0);fn(x,y1);}for(let y=y0;y<=y1;y++){fn(x0,y);fn(x1,y);}}
function ellipse(a,b,fn,filled=false){let minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y),rx=(maxX-minX+1)/2,ry=(maxY-minY+1)/2,cx=(minX+maxX)/2,cy=(minY+maxY)/2;for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){let d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<=1&&(filled||((x===minX||((x-1-cx)/rx)**2+((y-cy)/ry)**2>1)||((x+1-cx)/rx)**2+((y-cy)/ry)**2>1||((x-cx)/rx)**2+((y-1-cy)/ry)**2>1||((x-cx)/rx)**2+((y+1-cy)/ry)**2>1)))fn(x,y);}}
function rectangle(a,b,fn,filled=false){if(!filled)return rect(a,b,fn);for(let y=Math.min(a.y,b.y);y<=Math.max(a.y,b.y);y++)for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)fn(x,y);}
function shape(a,b,fn){if(tool==='line')line(a,b,fn);else if(tool==='rect')rectangle(a,b,fn,$('filledShapes').checked);else if(tool==='ellipse')ellipse(a,b,fn,$('filledShapes').checked);}
function region(){if(!selection)return null;return{x:Math.min(selection.a.x,selection.b.x),y:Math.min(selection.a.y,selection.b.y),width:Math.abs(selection.a.x-selection.b.x)+1,height:Math.abs(selection.a.y-selection.b.y)+1};}
function insideSelection(p){const b=region();return !!(b&&p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height&&(!selection.mask||selection.mask[p.y*w+p.x]));}
function selectionInfo(){const b=region();const count=selection?.mask?selection.mask.reduce((n,v)=>n+!!v,0):b?b.width*b.height:0;$('selectionStatus').textContent=b?'Seleção: '+count+' px ('+b.width+' × '+b.height+')':'Sem seleção';}
function setMaskedSelection(mask){const b=pro.maskBounds(mask,w,h);selection=b?{a:{x:b.x,y:b.y},b:{x:b.x+b.width-1,y:b.y+b.height-1},mask}:null;overlay();}
function hasEditableLayer(){if(!layer().locked)return true;toast('Camada bloqueada: desbloqueie para editar');return false;}
function handleAt(p){const r=region();if(!r||r.width<3||r.height<3)return null;const corners=[{id:'nw',x:r.x,y:r.y},{id:'ne',x:r.x+r.width-1,y:r.y},{id:'sw',x:r.x,y:r.y+r.height-1},{id:'se',x:r.x+r.width-1,y:r.y+r.height-1}];return corners.find(c=>c.x===p.x&&c.y===p.y)?.id||null;}
function overlay(){ox.clearRect(0,0,w,h);if(selection){let a=selection.a,b=selection.b;if(moving){a={x:a.x+moveDelta.x,y:a.y+moveDelta.y};b={x:b.x+moveDelta.x,y:b.y+moveDelta.y};}if(selection.mask&&!moving){ox.fillStyle='#aaa5bf44';for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(selection.mask[y*w+x])ox.fillRect(x,y,1,1);outline(a,b,false);}else outline(a,b,true);if(tool==='select'||tool==='lasso'||tool==='magic'){const r=region();if(r){ox.fillStyle='#e6e1ee';for(const c of [{x:r.x,y:r.y},{x:r.x+r.width-1,y:r.y},{x:r.x,y:r.y+r.height-1},{x:r.x+r.width-1,y:r.y+r.height-1}])ox.fillRect(c.x+.2,c.y+.2,.6,.6);}}}
 if(down&&start&&preview&&!moving){if(tool==='select')outline(start,preview,true);if(tool==='lasso'&&lassoPath.length){ox.strokeStyle='#b7aecb';ox.lineWidth=.17;ox.beginPath();lassoPath.forEach((p,i)=>i?ox.lineTo(p.x+.5,p.y+.5):ox.moveTo(p.x+.5,p.y+.5));ox.stroke();}if(resizeCorner&&resizeTarget){outline({x:resizeTarget.x,y:resizeTarget.y},{x:resizeTarget.x+resizeTarget.width-1,y:resizeTarget.y+resizeTarget.height-1},false);}if(['line','rect','ellipse'].includes(tool)){ox.fillStyle=ink;ox.globalAlpha=.55;shape(start,preview,(x,y)=>ox.fillRect(x,y,1,1));ox.globalAlpha=1;}}selectionInfo();}
function redraw(){put(ctx,composite(frame()));drawOnion();grid();overlay();}
function zoom(){let s=document.querySelector('.canvas-stack');s.style.width=w*z+'px';s.style.height=h*z+'px';$('zoomLabel').textContent=z*100+'%';$('zoomMini').textContent=z*100+'%';grid();}
function resize(){[c,gc,oc,nc].forEach(el=>{el.width=w;el.height=h;});$('dimensions').textContent=w+' × '+h;$('sizeInfo').textContent=w+' × '+h+' px';$('newWidth').value=w;$('newHeight').value=h;zoom();}
function point(e){let r=oc.getBoundingClientRect();return{x:clamp(Math.floor((e.clientX-r.left)*w/r.width),0,w-1),y:clamp(Math.floor((e.clientY-r.top)*h/r.height),0,h-1)};}
function pixel(x,y,paint){if(x<0||x>=w||y<0||y>=h)return;let i=index(x,y),p=layer().pixels;for(let j=0;j<4;j++)p[i+j]=paint[j];}
function stamp(x,y,paint){for(const p of pro.brushPoints(x,y,size,$('brushShape').value)){pixel(p.x,p.y,paint);if($('mirrorDraw').checked)pixel(w-1-p.x,p.y,paint);}}
const paint=()=>[...rgb(ink),255],erase=()=>[0,0,0,0];
function fill(x,y){let p=layer().pixels,i=index(x,y),before=Array.from(p.slice(i,i+4)),after=paint();if(before.every((v,j)=>v===after[j]))return;let todo=[y*w+x],seen=new Uint8Array(w*h);while(todo.length){let q=todo.pop();if(seen[q])continue;seen[q]=1;let i=q*4;if(!before.every((v,j)=>v===p[i+j]))continue;for(let j=0;j<4;j++)p[i+j]=after[j];let x=q%w,y=Math.floor(q/w);if(x>0)todo.push(q-1);if(x<w-1)todo.push(q+1);if(y>0)todo.push(q-w);if(y<h-1)todo.push(q+w);}}
function setColor(value){if(!/^#[0-9a-f]{6}$/i.test(value))return;ink=value.toLowerCase();updateWheelFromColor(ink);$('colorInput').value=ink;$('hexInput').value=ink.slice(1).toUpperCase();let [r,g,b]=rgb(ink);$('redInput').value=r;$('greenInput').value=g;$('blueInput').value=b;$('colorPreview').style.background=ink;document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('active',b.dataset.color===ink));}
function eyedrop(x,y){let p=composite(frame()),i=index(x,y);if(p[i+3])setColor(hex(p[i],p[i+1],p[i+2]));}
oc.addEventListener('contextmenu',e=>e.preventDefault());
function finishPerfectStroke(){
 if(!strokeBase||!strokePath.length)return;
 layer().pixels.set(strokeBase);
 for(const p of pro.pixelPerfectPath(strokePath))stamp(p.x,p.y,strokeColor);
}
function resizeSelected(target){
 const r=region();if(!r||!target||!hasEditableLayer())return;
 const original=selectedPixels();if(!original)return;
 const tw=target.width,th=target.height;
 if(tw===r.width&&th===r.height&&target.x===r.x&&target.y===r.y)return;
 checkpoint('Redimensionar seleção');clearArea(r);
 const pixels=new Uint8ClampedArray(tw*th*4),mask=new Uint8Array(tw*th);
 for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
  const sx=Math.min(original.width-1,Math.floor(x*original.width/tw)),sy=Math.min(original.height-1,Math.floor(y*original.height/th));
  const si=(sy*original.width+sx)*4,di=(y*tw+x)*4;
  pixels.set(original.pixels.subarray(si,si+4),di);
  mask[y*tw+x]=original.mask?original.mask[sy*original.width+sx]:1;
 }
 placePixels({width:tw,height:th,pixels,mask},target.x,target.y);
 setSelectionFromChunk({width:tw,height:th,mask},target.x,target.y);render();
}
function setSelectionFromChunk(chunk,x,y){
 const mask=new Uint8Array(w*h);
 for(let yy=0;yy<chunk.height;yy++)for(let xx=0;xx<chunk.width;xx++){
  const tx=x+xx,ty=y+yy;
  if(tx>=0&&ty>=0&&tx<w&&ty<h&&(!chunk.mask||chunk.mask[yy*chunk.width+xx]))mask[ty*w+tx]=1;
 }
 setMaskedSelection(mask);
}
function targetForResize(corner,p){
 const r=region();if(!r)return null;
 let left=r.x,right=r.x+r.width-1,top=r.y,bottom=r.y+r.height-1;
 if(corner.includes('w'))left=Math.min(p.x,right);else right=Math.max(p.x,left);
 if(corner.includes('n'))top=Math.min(p.y,bottom);else bottom=Math.max(p.y,top);
 return {x:left,y:top,width:right-left+1,height:bottom-top+1};
}
oc.addEventListener('contextmenu',e=>e.preventDefault());
oc.addEventListener('pointerdown',e=>{
 if(e.button!==0&&e.button!==2)return;
 e.preventDefault();stop();
 const p=point(e),edit=e.button===2||['pencil','eraser','fill','line','rect','ellipse'].includes(tool);
 if(edit&&!hasEditableLayer())return;
 down=true;start=last=preview=p;moveDelta={x:0,y:0};
 resizeCorner=(['select','lasso','magic'].includes(tool)&&e.button===0&&selection)?handleAt(p):null;
 moving=!resizeCorner&&(tool==='select'||tool==='lasso'||tool==='magic')&&e.button===0&&insideSelection(p);
 moveStart=moving?p:null;resizeTarget=null;
 oc.dataset.erase=e.button===2?'yes':'no';
 oc.setPointerCapture(e.pointerId);
 if(tool==='lasso'&&e.button===0&&!moving)lassoPath=[p];
 if(tool==='magic'&&e.button===0&&!moving){
  const mask=pro.colorMask(layer().pixels,w,h,p.x,p.y,+$('colorTolerance').value,$('colorSelectMode').value==='global');
  setMaskedSelection(mask);down=false;try{oc.releasePointerCapture(e.pointerId);}catch(_error){}return;
 }
 if(e.button===2||['pencil','eraser','fill'].includes(tool)){
  checkpoint(e.button===2||tool==='eraser'?'Borracha':tool==='fill'?'Preenchimento':'Lápis');
  strokeColor=e.button===2||tool==='eraser'?[0,0,0,0]:paint();
  strokePath=[p];
  strokeBase=$('pixelPerfect').checked&&size===1&&$('brushShape').value==='square'&&tool!=='fill'?new Uint8ClampedArray(layer().pixels):null;
  if(tool==='fill'&&e.button!==2)fill(p.x,p.y);else stamp(p.x,p.y,strokeColor);
  redraw();
 }else if(tool==='eyedropper'){eyedrop(p.x,p.y);down=false;}
 else overlay();
});
oc.addEventListener('pointermove',e=>{
 const p=point(e);$('cursorInfo').textContent='X: '+p.x+'   Y: '+p.y;
 if(!down)return;preview=p;
 if(moving){moveDelta={x:p.x-moveStart.x,y:p.y-moveStart.y};overlay();return;}
 if(resizeCorner){resizeTarget=targetForResize(resizeCorner,p);overlay();return;}
 if(tool==='lasso'){if(!lassoPath.length||lassoPath.at(-1).x!==p.x||lassoPath.at(-1).y!==p.y)lassoPath.push(p);overlay();return;}
 if(oc.dataset.erase==='yes'||tool==='pencil'||tool==='eraser'){
  line(last,p,(x,y)=>{
   if(strokePath.length&&strokePath.at(-1).x===x&&strokePath.at(-1).y===y)return;
   strokePath.push({x,y});
   if(!strokeBase)stamp(x,y,strokeColor);
  });
  if(strokeBase)finishPerfectStroke();
  last=p;redraw();
 }else overlay();
});
oc.addEventListener('pointerup',e=>{
 if(!down)return;
 const p=point(e);
 if(moving){const {x:dx,y:dy}=moveDelta;if(dx||dy)moveSelected(dx,dy);}
 else if(resizeCorner)resizeSelected(resizeTarget);
 else if(oc.dataset.erase==='yes'||tool==='pencil'||tool==='eraser'){
  line(last,p,(x,y)=>{if(strokePath.length&&strokePath.at(-1).x===x&&strokePath.at(-1).y===y)return;strokePath.push({x,y});if(!strokeBase)stamp(x,y,strokeColor);});
  if(strokeBase)finishPerfectStroke();
 }
 else if(['line','rect','ellipse'].includes(tool)){checkpoint(tool==='line'?'Linha':tool==='rect'?'Retângulo':'Elipse');shape(start,p,(x,y)=>stamp(x,y,paint()));}
 else if(tool==='select')selection={a:start,b:p};
 else if(tool==='lasso'){if(!lassoPath.length||lassoPath.at(-1).x!==p.x||lassoPath.at(-1).y!==p.y)lassoPath.push(p);if(lassoPath.length>=3)setMaskedSelection(pro.polygonMask(lassoPath,w,h));else selection=null;}
 down=false;moving=false;resizeCorner=null;resizeTarget=null;start=preview=null;strokePath=[];strokeBase=null;lassoPath=[];
 redraw();renderFrames();scheduleSave();
});
oc.addEventListener('pointercancel',()=>{
 if(!down)return;
 down=false;moving=false;resizeCorner=null;resizeTarget=null;start=preview=null;strokePath=[];strokeBase=null;lassoPath=[];
 redraw();renderFrames();scheduleSave();
});
const tools={pencil:['Lápis','Desenhe pixels com precisão.','✎'],eraser:['Borracha','Apague pixels da camada.','⌫'],fill:['Balde de tinta','Preencha áreas conectadas.','◈'],select:['Seleção','Selecione e redimensione uma área.','▧'],lasso:['Laço','Selecione uma região à mão livre.','⌁'],magic:['Seleção por cor','Selecione regiões de cores semelhantes.','✦'],eyedropper:['Conta-gotas','Capture uma cor do desenho.','♢'],line:['Linha','Desenhe uma linha reta.','╱'],rect:['Retângulo','Crie um retângulo.','□'],ellipse:['Elipse','Desenhe círculos e elipses.','◯']};
function setTool(t){tool=t;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('toolName').textContent=tools[t][0];$('toolDescription').textContent=tools[t][1];$('toolIcon').textContent=tools[t][2];if(!['select','lasso','magic'].includes(t))selection=null;overlay();}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
function swatch(col){let b=document.createElement('button');b.className='swatch';b.style.background=col;b.dataset.color=col.toLowerCase();b.title=col;b.setAttribute('aria-label','Cor '+col);b.onclick=()=>setColor(col);$('palette').append(b);}
$('colorTolerance').oninput=e=>$('colorToleranceValue').textContent=e.target.value;
pico.forEach(swatch);$('addSwatch').onclick=()=>swatch(ink);$('colorInput').oninput=e=>setColor(e.target.value);
$('hexInput').onchange=e=>{let v=e.target.value.replace('#','');setColor(/^[\da-f]{6}$/i.test(v)?'#'+v:ink);};
['redInput','greenInput','blueInput'].forEach(id=>$(id).onchange=()=>setColor(hex(+$('redInput').value,+$('greenInput').value,+$('blueInput').value)));
function renderLayers(){let holder=$('layerList');holder.replaceChildren();frame().layers.forEach((l,i)=>{let row=document.createElement('div');row.className='layer-item'+(i===li?' active':'');row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label','Selecionar camada '+l.name);row.setAttribute('aria-pressed',String(i===li));row.onclick=()=>{li=i;renderLayers();};row.onkeydown=e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();li=i;renderLayers();}};let eye=document.createElement('button');eye.className='eye-btn'+(l.visible?'':' off');eye.textContent=l.visible?'◉':'◌';eye.title=l.visible?'Ocultar':'Mostrar';eye.onclick=e=>{e.stopPropagation();checkpoint('Visibilidade da camada');l.visible=!l.visible;render();};let chip=document.createElement('span');chip.className='layer-chip';chip.textContent=i+1;let lock=document.createElement('button');lock.className='layer-lock'+(l.locked?' locked':'');lock.textContent=l.locked?'▣':'◇';lock.title=l.locked?'Desbloquear camada':'Bloquear camada';lock.setAttribute('aria-label',lock.title);lock.onclick=e=>{e.stopPropagation();checkpoint('Bloqueio de camada');l.locked=!l.locked;render();};let name=document.createElement('span');name.className='layer-name';name.textContent=l.name;name.title='Clique duas vezes para renomear';name.ondblclick=e=>{e.stopPropagation();let n=prompt('Nome da camada',l.name);if(n?.trim()){checkpoint('Renomear camada');l.name=n.trim();renderLayers();renderHistory();scheduleSave();}};row.append(eye,chip,name,lock);holder.prepend(row);});$('opacityInput').value=Math.round(layer().opacity*100);$('opacityInput').disabled=!!layer().locked;$('opacityValue').textContent=Math.round(layer().opacity*100)+'%';}
$('addLayer').onclick=()=>{if(frame().layers.length>=100)return toast('Limite de 100 camadas por frame');checkpoint('Adicionar camada');frame().layers.push(mkLayer('Camada '+(frame().layers.length+1)));li=frame().layers.length-1;render();};
$('deleteLayer').onclick=()=>{if(frame().layers.length===1)return toast('É necessária pelo menos uma camada');if(layer().locked)return toast('Desbloqueie a camada antes de excluir');checkpoint('Excluir camada');frame().layers.splice(li,1);li=clamp(li,0,frame().layers.length-1);render();};
let opacityEditing=false;$('opacityInput').addEventListener('pointerdown',()=>{if(layer().locked)return;checkpoint('Opacidade da camada');opacityEditing=true;});
$('opacityInput').oninput=e=>{if(layer().locked){toast('Camada bloqueada');return;}if(!opacityEditing){checkpoint('Opacidade da camada');opacityEditing=true;}layer().opacity=+e.target.value/100;$('opacityValue').textContent=e.target.value+'%';redraw();renderFrames();};$('opacityInput').onchange=()=>{opacityEditing=false;scheduleSave();};
function renderFrames(){let holder=$('frameStrip');holder.replaceChildren();const tag=currentTag();frames.forEach((f,i)=>{let b=document.createElement('button');b.className='frame-card'+(i===fi?' selected':'')+(tag?(i>=tag.start&&i<=tag.end?' tagged':' outside-tag'):'');b.setAttribute('aria-label','Frame '+(i+1));b.setAttribute('aria-pressed',String(i===fi));let n=document.createElement('span');n.className='frame-number';n.textContent=String(i+1).padStart(2,'0');let thumb=document.createElement('canvas');thumb.width=w;thumb.height=h;put(thumb.getContext('2d'),composite(f));b.append(n,thumb);b.onclick=()=>setFrame(i);holder.append(b);});let plus=document.createElement('button');plus.className='add-frame';plus.textContent='+';plus.title='Adicionar frame';plus.onclick=()=>{checkpoint();frames.splice(fi+1,0,mkFrame());fi++;li=0;render();};holder.append(plus);$('frameIndicator').textContent=String(fi+1).padStart(2,'0')+' / '+String(frames.length).padStart(2,'0');$('frameCount').textContent=frames.length+' frames';}
function render(save=true){redraw();renderLayers();renderFrames();renderHistory();if(save)scheduleSave();}
function setFrame(i){const old=fi;fi=(i+frames.length)%frames.length;li=clamp(li,0,frame().layers.length-1);selection=null;redraw();renderLayers();const cards=$('frameStrip').querySelectorAll('.frame-card');if(cards[old]){cards[old].classList.remove('selected');cards[old].setAttribute('aria-pressed','false');}if(cards[fi]){cards[fi].classList.add('selected');cards[fi].setAttribute('aria-pressed','true');}$('frameIndicator').textContent=String(fi+1).padStart(2,'0')+' / '+String(frames.length).padStart(2,'0');}
$('duplicateFrame').onclick=()=>{checkpoint('Duplicar frame');frames.splice(fi+1,0,copyFrames([frame()])[0]);fi++;render();toast('Frame duplicado');};
$('deleteFrame').onclick=()=>{if(frames.length<=1)return toast('É necessário pelo menos um frame');checkpoint();frames.splice(fi,1);fi=clamp(fi,0,frames.length-1);li=clamp(li,0,frame().layers.length-1);render();};
$('prevFrame').onclick=()=>setFrame(fi-1);$('nextFrame').onclick=()=>setFrame(fi+1);
function stop(){playing=false;clearInterval(timer);$('playBtn').textContent='▶';}
function play(){if(playing){stop();return;}const range=playRange();if(fi<range.start||fi>range.end)setFrame(range.start);playing=true;$('playBtn').textContent='■';timer=setInterval(()=>{const r=playRange();if(fi>=r.end){if(!$('loopToggle').checked){stop();return;}setFrame(r.start);}else setFrame(fi+1);},1000/clamp(+$('fpsInput').value||8,1,24));}
$('playBtn').onclick=play;$('fpsInput').onchange=()=>{if(playing){stop();play();}};
$('gridBtn').onclick=()=>{showGrid=!showGrid;$('gridBtn').classList.toggle('active',showGrid);grid();};$('checkerBtn').onclick=()=>{const el=document.querySelector('.canvas-stack');const visible=el.classList.toggle('no-checker');$('checkerBtn').classList.toggle('active',!visible);};
$('brushInput').oninput=e=>{size=+e.target.value;$('brushValue').textContent=size+' px';};
$('zoomIn').onclick=()=>{z=clamp(z+2,2,40);zoom();};$('zoomOut').onclick=()=>{z=clamp(z-2,2,40);zoom();};
$('fitBtn').onclick=()=>{let v=$('canvasViewport');z=clamp(Math.floor(Math.min((v.clientWidth-80)/w,(v.clientHeight-80)/h)),2,40);zoom();};
$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;
function filename(){return($('projectName').value.trim()||'PIXEL-BMister').replace(/[^\p{L}\p{N}_-]+/gu,'_');}
function download(blob,name){let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
$('exportBtn').onclick=()=>{let out=document.createElement('canvas');out.width=w;out.height=h;put(out.getContext('2d'),composite(frame()));out.toBlob(b=>{if(b)download(b,filename()+'_frame'+(fi+1)+'.png');toast('Imagem PNG exportada');},'image/png');};
$('saveBtn').onclick=()=>{let data={format:'PIXEL-BMister',version:1,name:$('projectName').value,width:w,height:h,fps:+$('fpsInput').value||8,frames:frames.map(f=>({layers:f.layers.map(l=>({name:l.name,visible:l.visible,opacity:l.opacity,pixels:Array.from(l.pixels)}))}))};download(new Blob([JSON.stringify(data)],{type:'application/json'}),filename()+'.json');toast('Projeto salvo em JSON');};
$('loadBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async e=>{let file=e.target.files[0];if(!file)return;try{let d=JSON.parse(await file.text());if(d.format!=='PIXEL-BMister'||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<8||d.width>128||d.height<8||d.height>128||!Array.isArray(d.frames)||!d.frames.length||d.frames.length>250)throw Error('Formato ou dimensões inválidos');for(let f of d.frames){if(!Array.isArray(f.layers)||!f.layers.length||f.layers.length>100)throw Error('Camadas inválidas');for(let l of f.layers){if(!Array.isArray(l.pixels)||l.pixels.length!==d.width*d.height*4)throw Error('Pixels inválidos');}}checkpoint();stop();w=d.width;h=d.height;frames=d.frames.map(f=>({layers:f.layers.map(l=>({name:String(l.name||'Camada'),visible:l.visible!==false,opacity:clamp(Number(l.opacity??1),0,1),locked:l.locked===true,pixels:new Uint8ClampedArray(l.pixels)}))}));fi=0;li=0;$('projectName').value=d.name||'Meu projeto';$('fpsInput').value=clamp(d.fps||8,1,24);resize();render();toast('Projeto carregado');}catch(err){toast('Erro ao abrir: '+err.message);}e.target.value='';};
$('settingsBtn').onclick=()=>$('settingsDialog').showModal();$('helpBtn').onclick=()=>$('helpDialog').showModal();
$('newProjectBtn').onclick=()=>{let nw=+$('newWidth').value,nh=+$('newHeight').value;if(!Number.isInteger(nw)||!Number.isInteger(nh)||nw<8||nw>10000||nh<8||nh>10000)return toast('Dimensões de 8 a 10.000 pixels');if(nw>128||nh>128){void window.PixelBigCanvas.open(nw,nh,'Arte em tela grande').catch(e=>toast(e.message));return;}if(!confirm('Criar uma tela nova? O desenho atual será salvo na biblioteca antes da troca, se estiver disponível.'))return;if(window.PixelProjectManager){void window.PixelProjectManager.newBlank('Novo projeto',nw,nh);return;}checkpoint();stop();w=nw;h=nh;frames=Array.from({length:8},mkFrame);fi=0;li=1;animationTags=[];activeTag='all';refreshAnimationList();selection=null;resize();render();toast('Nova tela criada');};
document.addEventListener('keydown',e=>{if(document.querySelector('.app.studio-large-active')||['INPUT','TEXTAREA'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}if(e.ctrlKey||e.metaKey||e.altKey)return;let key=e.key.toLowerCase(),shortcuts={b:'pencil',e:'eraser',g:'fill',m:'select',q:'lasso',w:'magic',i:'eyedropper',l:'line',r:'rect',o:'ellipse'};if(shortcuts[key])setTool(shortcuts[key]);if(e.key==='Escape'){selection=null;overlay();}if(e.key==='Delete'||e.key==='Backspace'){if(selection){e.preventDefault();clearSelected();}}if(key==='p'){e.preventDefault();play();}});

/* V1.1–V1.2: autosave, PNG import, editable selection, transforms and HSV color picker */
const AUTOSAVE_KEY='pixel-bmister-project-v1';
let saveStatus='ready';
function projectData(){return{format:'PIXEL-BMister',version:3,name:$('projectName').value,width:w,height:h,fps:+$('fpsInput').value||8,selectedFrame:fi,selectedLayer:li,animationTags:animationTags.map(t=>({...t})),activeTag,frames:frames.map(f=>({layers:f.layers.map(l=>({name:l.name,visible:l.visible,opacity:l.opacity,locked:!!l.locked,pixels:Array.from(l.pixels)}))}))};}
function scheduleSave(){
 if(savingBlocked)return;
 window.PixelProjectManager?.onChanged();
 clearTimeout(autosaveTimer);
 saveStatus='dirty';
 $('statusText').textContent='Alterações pendentes…';
 autosaveTimer=setTimeout(()=>{
  try{
   const doc={...projectData(),libraryId:window.PixelProjectManager?.activeId||null};
   localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(doc));
   saveStatus='saved';
   $('statusText').textContent='Rascunho salvo neste navegador';
  }catch(error){
   saveStatus='error';
   $('statusText').textContent='Falha no autosave — exporte JSON';
   toast('Armazenamento cheio ou bloqueado. Salve o arquivo JSON.');
  }
 },1100);
}
function recoverProject(){try{const raw=localStorage.getItem(AUTOSAVE_KEY);if(!raw)return false;const d=JSON.parse(raw);if(!validateProject(d))return false;applyProject(d);$('statusText').textContent='Projeto recuperado';saveStatus='saved';return true;}catch(e){return false;}}
function validateProject(d){
 if(!d||d.format!=='PIXEL-BMister'||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<8||d.width>128||d.height<8||d.height>128||!Array.isArray(d.frames)||d.frames.length<1||d.frames.length>250)return false;
 if(d.animationTags!==undefined&&!Array.isArray(d.animationTags))return false;
 if(d.animationTags?.length>40)return false;
 for(const f of d.frames){
  if(!f||!Array.isArray(f.layers)||f.layers.length<1||f.layers.length>100)return false;
  for(const l of f.layers){
   if(!l||!Array.isArray(l.pixels)||l.pixels.length!==d.width*d.height*4)return false;
   if(l.opacity!==undefined&&(!Number.isFinite(l.opacity)||l.opacity<0||l.opacity>1))return false;
   for(let j=0;j<l.pixels.length;j++)if(!Number.isInteger(l.pixels[j])||l.pixels[j]<0||l.pixels[j]>255)return false;
  }
 }
 return true;
}
function applyProject(d){stop();w=d.width;h=d.height;frames=d.frames.map(f=>({layers:f.layers.map(l=>({name:String(l.name||'Camada'),visible:l.visible!==false,opacity:clamp(Number(l.opacity??1),0,1),locked:l.locked===true,pixels:new Uint8ClampedArray(l.pixels)}))}));fi=clamp(d.selectedFrame||0,0,frames.length-1);li=clamp(d.selectedLayer||0,0,frame().layers.length-1);animationTags=normalizedTags(d.animationTags);activeTag=animationTags.some(t=>t.id===d.activeTag)?d.activeTag:'all';refreshAnimationList();selection=null;$('projectName').value=d.name||'Meu projeto';$('fpsInput').value=clamp(d.fps||8,1,24);resize();render();}
function selectedPixels(){
 const r=region();if(!r)return null;
 const arr=new Uint8ClampedArray(r.width*r.height*4),mask=new Uint8Array(r.width*r.height),src=layer().pixels;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
  const gx=r.x+x,gy=r.y+y,di=(y*r.width+x)*4;
  if(selection.mask&&!selection.mask[gy*w+gx])continue;
  mask[y*r.width+x]=1;
  arr.set(src.subarray(index(gx,gy),index(gx,gy)+4),di);
 }
 return {...r,pixels:arr,mask};
}
function clearArea(r){
 const src=layer().pixels;
 for(let y=0;y<r.height;y++)for(let x=0;x<r.width;x++){
  const gx=r.x+x,gy=r.y+y;
  if(gx<0||gy<0||gx>=w||gy>=h)continue;
  if(selection&&selection.mask&&!selection.mask[gy*w+gx])continue;
  src.fill(0,index(gx,gy),index(gx,gy)+4);
 }
}
function placePixels(chunk,x,y){
 for(let yy=0;yy<chunk.height;yy++)for(let xx=0;xx<chunk.width;xx++){
  const si=(yy*chunk.width+xx)*4,px=x+xx,py=y+yy;
  if(chunk.mask&&!chunk.mask[yy*chunk.width+xx])continue;
  if(px<0||py<0||px>=w||py>=h)continue;
  layer().pixels.set(chunk.pixels.subarray(si,si+4),index(px,py));
 }
}
function copySelected(){
 const r=selectedPixels();if(!r)return toast('Selecione uma área primeiro');
 clipboard={width:r.width,height:r.height,pixels:new Uint8ClampedArray(r.pixels),mask:new Uint8Array(r.mask)};
 toast('Pixels copiados');
}
function clearSelected(){
 const r=region();if(!r||!hasEditableLayer())return;
 checkpoint('Apagar seleção');clearArea(r);redraw();renderFrames();scheduleSave();
}
function cutSelected(){if(!region()||!hasEditableLayer())return;copySelected();clearSelected();}
function pasteSelected(){
 if(!clipboard)return toast('Nenhum pixel copiado');
 if(!hasEditableLayer())return;
 checkpoint('Colar seleção');
 const width=Math.min(clipboard.width,w),height=Math.min(clipboard.height,h);
 const x=selection?clamp(region().x+1,0,w-width):Math.floor((w-width)/2);
 const y=selection?clamp(region().y+1,0,h-height):Math.floor((h-height)/2);
 placePixels(clipboard,x,y);
 setSelectionFromChunk(clipboard,x,y);render();
}
function moveSelected(dx,dy){
 if(!hasEditableLayer())return;
 const r=selectedPixels();if(!r)return;
 const nx=clamp(r.x+dx,0,w-r.width),ny=clamp(r.y+dy,0,h-r.height);
 if(nx===r.x&&ny===r.y)return;
 checkpoint('Mover seleção');clearArea(r);placePixels(r,nx,ny);setSelectionFromChunk(r,nx,ny);render();
}
function flip(axis){
 if(!hasEditableLayer())return;
 const r=region()||{x:0,y:0,width:w,height:h};
 const original=selectedPixels()||{...r,pixels:new Uint8ClampedArray(layer().pixels),mask:new Uint8Array(w*h).fill(1)};
 const pixels=new Uint8ClampedArray(r.width*r.height*4),mask=new Uint8Array(r.width*r.height);
 for(let yy=0;yy<r.height;yy++)for(let xx=0;xx<r.width;xx++){
  const sx=axis==='h'?r.width-1-xx:xx,sy=axis==='v'?r.height-1-yy:yy;
  const si=(sy*r.width+sx)*4,di=(yy*r.width+xx)*4;
  pixels.set(original.pixels.subarray(si,si+4),di);
  mask[yy*r.width+xx]=original.mask[sy*r.width+sx];
 }
 checkpoint(axis==='h'?'Espelhar horizontal':'Espelhar vertical');
 if(selection)clearArea(r);
 placePixels({width:r.width,height:r.height,pixels,mask},r.x,r.y);
 if(selection)setSelectionFromChunk({width:r.width,height:r.height,mask},r.x,r.y);
 render();
}
$('copySelection').onclick=copySelected;$('cutSelection').onclick=cutSelected;$('pasteSelection').onclick=pasteSelected;$('clearSelection').onclick=clearSelected;$('deselect').onclick=()=>{selection=null;overlay();};$('flipHorizontal').onclick=()=>flip('h');$('flipVertical').onclick=()=>flip('v');
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&['c','x','v'].includes(e.key.toLowerCase())){if(e.key.toLowerCase()==='c'&&selection){e.preventDefault();copySelected();}if(e.key.toLowerCase()==='x'&&selection){e.preventDefault();cutSelected();}if(e.key.toLowerCase()==='v'&&clipboard){e.preventDefault();pasteSelected();}}});
$('projectName').addEventListener('input',scheduleSave);
$('pngInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.type!=='image/png')throw Error('Escolha um arquivo PNG');const img=await createImageBitmap(file);try{if(img.width>4096||img.height>4096)throw Error('Imagem acima de 4096 px');let canvas=document.createElement('canvas');canvas.width=Math.min(img.width,w);canvas.height=Math.min(img.height,h);let g=canvas.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=false;g.drawImage(img,0,0,canvas.width,canvas.height,0,0,canvas.width,canvas.height);const pixels=g.getImageData(0,0,canvas.width,canvas.height).data;if(frame().layers.length>=100)throw Error('Limite de 100 camadas por frame');checkpoint('Importar PNG');frame().layers.push(mkLayer(file.name.replace(/\.png$/i,'').slice(0,40)||'PNG importado'));li=frame().layers.length-1;placePixels({width:canvas.width,height:canvas.height,pixels},0,0);render();toast('PNG importado em nova camada');}finally{img.close();}}catch(error){toast('Erro na importação: '+error.message);}e.target.value='';};
$('importPngBtn').onclick=()=>$('pngInput').click();
function hsvFromRgb(c){let [r,g,b]=rgb(c).map(x=>x/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,H=0;if(d){if(mx===r)H=((g-b)/d)%6;else if(mx===g)H=(b-r)/d+2;else H=(r-g)/d+4;H=(H*60+360)%360;}return{h:H,s:mx===0?0:d/mx,v:mx};}
function hsvToHex(H,S,V){let f=n=>{let k=(n+H/60)%6;return V-V*S*Math.max(Math.min(k,4-k,1),0);};return hex(f(5)*255,f(3)*255,f(1)*255);}
function updateWheelFromColor(value){let hsv=hsvFromRgb(value);if(hsv.s>0.00001)hue=hsv.h;saturation=hsv.s;brightness=hsv.v;drawWheel();}
function drawWheel(){const rad=hue*Math.PI/180-Math.PI/2;let wheel=$('hueWheel'),dot=$('hueDot'),square=$('svSquare');dot.style.left=(85+79*Math.cos(rad)-6)+'px';dot.style.top=(85+79*Math.sin(rad)-6)+'px';square.style.background='linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent),hsl('+hue+' 100% 50%)';$('svDot').style.left='calc('+(saturation*100)+'% - 5px)';$('svDot').style.top='calc('+((1-brightness)*100)+'% - 5px)';wheel.setAttribute('aria-valuenow',String(Math.round(hue)));}
function adjustHue(e){const box=$('hueWheel').getBoundingClientRect(),x=e.clientX-box.left-box.width/2,y=e.clientY-box.top-box.height/2;hue=(Math.atan2(y,x)*180/Math.PI+90+360)%360;setColor(hsvToHex(hue,saturation,brightness));}
function adjustSV(e){const rect=$('svSquare').getBoundingClientRect();saturation=clamp((e.clientX-rect.left)/rect.width,0,1);brightness=1-clamp((e.clientY-rect.top)/rect.height,0,1);setColor(hsvToHex(hue,saturation,brightness));}
function dragColor(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);fn(e);});el.addEventListener('pointermove',e=>{if(el.hasPointerCapture(e.pointerId)){e.stopPropagation();fn(e);}});}
dragColor($('hueWheel'),e=>{if(e.target===$('svSquare')||e.target===$('svDot'))return;adjustHue(e);});
dragColor($('svSquare'),adjustSV);
$('hueWheel').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();hue=(hue+(e.key==='ArrowRight'?1:359))%360;setColor(hsvToHex(hue,saturation,brightness));}});
$('saveBtn').onclick=()=>{download(new Blob([JSON.stringify(projectData())],{type:'application/json'}),filename()+'.json');toast('Projeto e animações salvos em JSON');scheduleSave();};
$('fileInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>25*1024*1024)throw Error('Arquivo muito grande (máximo 25 MB)');const data=JSON.parse(await file.text());if(!validateProject(data))throw Error('Projeto JSON inválido');if(window.PixelProjectManager){await window.PixelProjectManager.importDocument(data);}else{checkpoint('Abrir projeto');applyProject(data);toast('Projeto carregado');}}catch(error){toast('Erro ao abrir: '+error.message);}e.target.value='';};
window.addEventListener('beforeunload',()=>{
 if(saveStatus==='saved')return;
 clearTimeout(autosaveTimer);
 try{localStorage.setItem(AUTOSAVE_KEY,JSON.stringify({...projectData(),libraryId:window.PixelProjectManager?.activeId||null}));}catch(_error){}
});


/* V1.3 — animation management, onion skin, spritesheets and GIF */
function normalizedTags(value){if(!Array.isArray(value))return[];let used=new Set();return value.slice(0,40).filter(t=>t&&typeof t.name==='string'&&Number.isInteger(t.start)&&Number.isInteger(t.end)&&t.start>=0&&t.end>=t.start&&t.end<frames.length).map(t=>{let id=typeof t.id==='string'&&t.id&&!used.has(t.id)?t.id:'animation-'+(++tagSerial);used.add(id);return{id,name:t.name.slice(0,40)||'Animação',start:t.start,end:t.end};});}
function currentTag(){return animationTags.find(t=>t.id===activeTag)||null;}
function playRange(){const t=currentTag();return t?{start:t.start,end:t.end}:{start:0,end:frames.length-1};}
function frameIndices(){let r=playRange(),arr=[];for(let i=r.start;i<=r.end;i++)arr.push(i);return arr;}
function refreshAnimationList(){const el=$('animationSelect');el.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent='Todos os frames';el.append(all);for(let t of animationTags){const op=document.createElement('option');op.value=t.id;op.textContent=t.name+' ('+(t.start+1)+'–'+(t.end+1)+')';el.append(op);}if(!animationTags.some(t=>t.id===activeTag))activeTag='all';el.value=activeTag;}
function shiftTagsOnInsert(i){for(let t of animationTags){if(i<=t.start){t.start++;t.end++;}else if(i<=t.end)t.end++;}}
function shiftTagsOnDelete(i){const remaining=[];for(let t of animationTags){if(i<t.start){t.start--;t.end--;}else if(i<=t.end){if(t.start===t.end)continue;t.end--;if(i===t.start&&t.start>t.end)t.start=t.end;}remaining.push(t);}animationTags=remaining;if(!animationTags.some(t=>t.id===activeTag))activeTag='all';refreshAnimationList();}
function drawOnion(){nx.clearRect(0,0,w,h);if(!onionEnabled||playing)return;const prev=clamp(+$('onionPrev').value||0,0,4),next=clamp(+$('onionNext').value||0,0,4),alpha=clamp(+$('onionOpacity').value||30,10,60)/100;const temp=document.createElement('canvas');temp.width=w;temp.height=h;const tc=temp.getContext('2d');for(let direction of [-1,1]){let count=direction<0?prev:next;for(let j=count;j>=1;j--){let i=fi+direction*j;if(i<0||i>=frames.length)continue;let image=tc.createImageData(w,h),data=composite(frames[i]);for(let k=0;k<data.length;k+=4){const a=data[k+3];image.data[k]=direction<0?60:255;image.data[k+1]=direction<0?140:88;image.data[k+2]=direction<0?255:140;image.data[k+3]=a;}tc.putImageData(image,0,0);nx.globalAlpha=alpha/(j**.55);nx.drawImage(temp,0,0);}}nx.globalAlpha=1;}
for(let id of ['onionPrev','onionNext','onionOpacity'])$(id).addEventListener('input',()=>{drawOnion();scheduleSave();});
$('onionToggle').onchange=e=>{onionEnabled=e.target.checked;drawOnion();scheduleSave();};
$('animationSelect').onchange=e=>{stop();activeTag=e.target.value;const tag=currentTag();if(tag&&(fi<tag.start||fi>tag.end))setFrame(tag.start);refreshAnimationList();renderFrames();scheduleSave();};
$('loopToggle').onchange=scheduleSave;
function openAnimationDialog(edit){const t=edit?currentTag():null;if(edit&&!t)return toast('Escolha uma animação');editingTag=t?t.id:null;$('animationDialogTitle').textContent=t?'Editar animação':'Nova animação';$('animationName').value=t?t.name:'Idle';$('animationStart').value=t?t.start+1:1;$('animationEnd').value=t?t.end+1:frames.length;$('animationStart').max=frames.length;$('animationEnd').max=frames.length;$('animationDialog').showModal();}
$('addAnimation').onclick=()=>openAnimationDialog(false);$('editAnimation').onclick=()=>openAnimationDialog(true);
$('deleteAnimation').onclick=()=>{const t=currentTag();if(!t)return toast('Selecione uma animação');checkpoint();animationTags=animationTags.filter(x=>x.id!==t.id);activeTag='all';refreshAnimationList();renderFrames();scheduleSave();toast('Animação removida (frames preservados)');};
$('confirmAnimation').onclick=e=>{const start=+$('animationStart').value-1,end=+$('animationEnd').value-1,name=$('animationName').value.trim();if(!name||!Number.isInteger(start)||!Number.isInteger(end)||start<0||start>=frames.length||end<start||end>=frames.length){e.preventDefault();return toast('Preencha um nome e intervalo válido');}checkpoint();let tag=editingTag?animationTags.find(t=>t.id===editingTag):null;if(tag){tag.name=name;tag.start=start;tag.end=end;}else{tag={id:'animation-'+Date.now()+'-'+(++tagSerial),name,start,end};animationTags.push(tag);}activeTag=tag.id;refreshAnimationList();renderFrames();scheduleSave();};
const oldRenderFrames=renderFrames;renderFrames=function(){oldRenderFrames();const add=$('frameStrip').querySelector('.add-frame');if(add){add.onclick=()=>{checkpoint('Adicionar frame');const at=fi+1;shiftTagsOnInsert(at);frames.splice(at,0,mkFrame());fi=at;li=0;refreshAnimationList();render();};}};
$('duplicateFrame').onclick=()=>{checkpoint('Duplicar frame');const at=fi+1;shiftTagsOnInsert(at);frames.splice(at,0,copyFrames([frame()])[0]);fi=at;refreshAnimationList();render();toast('Frame duplicado');};
$('deleteFrame').onclick=()=>{if(frames.length<=1)return toast('É necessário pelo menos um frame');checkpoint('Excluir frame');shiftTagsOnDelete(fi);frames.splice(fi,1);fi=clamp(fi,0,frames.length-1);li=clamp(li,0,frame().layers.length-1);render();};
function exportLabel(){const t=currentTag();return filename()+(t?'_'+t.name.replace(/[^\p{L}\p{N}_-]+/gu,'_'):'');}
function sheetImage(){const ids=frameIndices(),width=w*ids.length,height=h;if(width>16384)throw Error('Spritesheet excede o limite de 16384 px');const out=document.createElement('canvas');out.width=width;out.height=height;const g=out.getContext('2d');ids.forEach((i,pos)=>{const im=g.createImageData(w,h);im.data.set(composite(frames[i]));g.putImageData(im,pos*w,0);});return{out,ids};}
$('exportSheetBtn').onclick=()=>{try{const {out,ids}=sheetImage();out.toBlob(blob=>{if(!blob)return toast('Erro ao exportar spritesheet');download(blob,exportLabel()+'_spritesheet.png');const t=currentTag();const meta={application:'PIXEL-BMister',version:1,frameWidth:w,frameHeight:h,frames:ids.map((source,index)=>({index,sourceFrame:source+1,x:index*w,y:0,width:w,height:h})),fps:clamp(+$('fpsInput').value||8,1,24),animation:t?t.name:null};download(new Blob([JSON.stringify(meta,null,2)],{type:'application/json'}),exportLabel()+'_spritesheet.json');toast('Spritesheet PNG + JSON exportados');},'image/png');}catch(e){toast(e.message);}};
$('exportGifBtn').onclick=()=>{try{if(!window.PixelForgeGif)throw Error('Codificador GIF indisponível');const ids=frameIndices(),data=ids.map(i=>composite(frames[i]));const fps=clamp(+$('fpsInput').value||8,1,24);const result=window.PixelForgeGif.encode(data,w,h,fps,$('loopToggle').checked);download(result,exportLabel()+'.gif');toast('GIF animado exportado');}catch(e){toast('Falha no GIF: '+e.message);}};
const prevProjectData=projectData;projectData=function(){return{...prevProjectData(),onionSettings:{enabled:onionEnabled,previous:+$('onionPrev').value,next:+$('onionNext').value,opacity:+$('onionOpacity').value},loop:$('loopToggle').checked};};
const prevApplyProject=applyProject;applyProject=function(d){prevApplyProject(d);const a=d.onionSettings||{};onionEnabled=!!a.enabled;$('onionToggle').checked=onionEnabled;$('onionPrev').value=clamp(a.previous??1,0,4);$('onionNext').value=clamp(a.next??1,0,4);$('onionOpacity').value=clamp(a.opacity??30,10,60);$('loopToggle').checked=d.loop!==false;redraw();};


/* V1.4 — layer operations, snapshot history navigation and safe compositing */
function reorderLayer(direction){const items=frame().layers,target=li+direction;if(target<0||target>=items.length)return;checkpoint(direction>0?'Subir camada':'Descer camada');[items[li],items[target]]=[items[target],items[li]];li=target;render();}
$('layerUp').onclick=()=>reorderLayer(1);
$('layerDown').onclick=()=>reorderLayer(-1);
$('duplicateLayer').onclick=()=>{if(frame().layers.length>=100)return toast('Limite de 100 camadas por frame');checkpoint('Duplicar camada');const current=layer(),duplicate={name:current.name+' (cópia)',visible:current.visible,opacity:current.opacity,locked:false,pixels:new Uint8ClampedArray(current.pixels)};frame().layers.splice(li+1,0,duplicate);li++;render();toast('Camada duplicada');};
function mergeDown(){if(li<1)return toast('A camada já está na base');const items=frame().layers,top=items[li],bottom=items[li-1];if(!top.visible||!bottom.visible)return toast('Exiba as duas camadas antes de mesclar');if(top.locked||bottom.locked)return toast('Desbloqueie as camadas antes de mesclar');checkpoint('Mesclar camadas');const result=new Uint8ClampedArray(w*h*4);for(let i=0;i<result.length;i+=4){const a=bottom.visible?bottom.pixels[i+3]/255*bottom.opacity:0,b=top.visible?top.pixels[i+3]/255*top.opacity:0,total=b+a*(1-b);if(total===0)continue;for(let n=0;n<3;n++)result[i+n]=(top.pixels[i+n]*b+bottom.pixels[i+n]*a*(1-b))/total;result[i+3]=total*255;}bottom.pixels=result;bottom.opacity=1;bottom.visible=true;bottom.name=bottom.name+' + '+top.name;items.splice(li,1);li--;render();toast('Camadas mescladas');}
$('mergeLayer').onclick=mergeDown;
function renderHistory(){const holder=$('historyList');if(!holder)return;holder.replaceChildren();$('historyCount').textContent=(undoStack.length+redoStack.length)+' ações';$('historyUndo').disabled=!undoStack.length;$('historyRedo').disabled=!redoStack.length;const records=[...undoStack.map((x,i)=>({label:x.historyLabel||'Edição',position:i})),{label:'Estado atual',position:undoStack.length},...redoStack.slice().reverse().map((x,i)=>({label:x.historyLabel||'Edição',position:undoStack.length+1+i}))];const visible=records.slice(Math.max(0,records.length-25));for(const item of visible){const b=document.createElement('button');b.className='history-step'+(item.position===undoStack.length?' active':'');const count=document.createElement('span');count.className='history-index';count.textContent=String(item.position).padStart(2,'0');const title=document.createElement('span');title.className='history-name';title.textContent=item.label;b.append(count,title);b.onclick=()=>{const delta=item.position-undoStack.length;if(delta<0){for(let i=0;i<-delta;i++)undo();}else{for(let i=0;i<delta;i++)redo();}};holder.append(b);}}
$('historyUndo').onclick=undo;
$('historyRedo').onclick=redo;
$('historyClear').onclick=()=>{undoStack.length=0;redoStack.length=0;renderHistory();toast('Histórico limpo; projeto mantido');};

savingBlocked=true;recoverProject();savingBlocked=false;refreshAnimationList();resize();setColor(ink);render();
/* V1.7 Studio UX: controlled canvas navigation for the outer workspace module.
   Does not change pixel storage, drawing, frames, exports or autosave. */
/* Unified tools API: the 10K tiled renderer reads the same tool, color and brush settings. */
window.PixelStudioEditor={
 getColor:()=>ink,
 getTool:()=>tool,
 getBrushSize:()=>size,
 getBrushShape:()=>$('brushShape').value,
 getMirror:()=>$('mirrorDraw').checked,
 getFilledShapes:()=>$('filledShapes').checked,
 getColorTolerance:()=>+$('colorTolerance').value||0,
 getColorSelectionMode:()=>$('colorSelectMode').value,
 getProject:()=>projectData(),
 loadProject:data=>{if(!validateProject(data))throw Error('Projeto inválido');savingBlocked=true;try{undoStack.length=0;redoStack.length=0;applyProject(data);renderHistory();}finally{savingBlocked=false;}},
 getZoom:()=>z,
 refresh:()=>{redraw();renderLayers();renderFrames();renderHistory();$('dimensions').textContent=w+' × '+h;$('sizeInfo').textContent=w+' × '+h+' px';$('zoomMini').textContent=Math.round(z*100)+'%';$('zoomLabel').textContent=Math.round(z*100)+'%';$('projectName').value=$('projectName').value||'Meu projeto';}
};
window.PixelStudioCanvas={
  getZoom:()=>z,
  setZoom(value){z=clamp(Math.round(value),2,40);zoom();return z;},
  getSize:()=>({width:w,height:h}),
  fit(){
    const viewport=$('canvasViewport');
    z=clamp(Math.floor(Math.min((viewport.clientWidth-70)/w,(viewport.clientHeight-70)/h)),2,40);
    zoom();this.center();return z;
  },
  center(){
    const viewport=$('canvasViewport');
    viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);
    viewport.scrollTop=Math.max(0,(viewport.scrollHeight-viewport.clientHeight)/2);
  }
};

/* V1.9: project library uses the editor's own JSON validator and renderer.
   The original localStorage recovery remains available as an independent backup. */
if(window.PixelProjectLibrary){
 const manager=window.PixelProjectLibrary.createManager({
  getProject:()=>projectData(),
  loadProject:data=>{undoStack.length=0;redoStack.length=0;applyProject(data);renderHistory();},
  valid:data=>!!validateProject(data),
  notice:message=>toast(message)
 });
 window.PixelProjectManager=manager;
 void manager.init().catch(error=>toast('Falha ao iniciar biblioteca: '+error.message));
}

/* V1.5: expose a read-only snapshot of rendered frames to Game Lab. */
if(window.PixelGameLab){
 window.PixelGameLab.createGameLab(()=>({
  name:$('projectName').value.trim()||'PIXEL-BMister',
  width:w,height:h,fps:clamp(+$('fpsInput').value||8,1,24),
  tags:animationTags.map(t=>({...t})),
  frames:frames.map(f=>new Uint8ClampedArray(composite(f)))
 }));
}

})();