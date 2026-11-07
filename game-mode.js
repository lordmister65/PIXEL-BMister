/* PIXEL-BMister Game Lab V1.5 — pure browser JavaScript, no server. */
'use strict';
(()=>{
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const decoder=new TextEncoder();
const dataBytes=s=>decoder.encode(s);
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zipEntries(files){
  const data=[],central=[];let offset=0;
  const u16=(a,n)=>a.push(n&255,(n>>>8)&255);
  const u32=(a,n)=>{u16(a,n);u16(a,n>>>16);};
  for(const f of files){
    const name=dataBytes(f.name);const bytes=f.bytes instanceof Uint8Array?f.bytes:dataBytes(f.bytes);
    if(name.length>65535||bytes.length>0xffffffff)throw Error('Arquivo excede o limite ZIP');
    const crc=crc32(bytes),start=[];
    u32(start,0x04034b50);u16(start,20);u16(start,0x0800);u16(start,0);u16(start,0);u16(start,0);
    u32(start,crc);u32(start,bytes.length);u32(start,bytes.length);u16(start,name.length);u16(start,0);
    const local=new Uint8Array([...start,...name]);data.push(local,bytes);
    const header=[];u32(header,0x02014b50);u16(header,20);u16(header,20);u16(header,0x0800);u16(header,0);u16(header,0);u16(header,0);
    u32(header,crc);u32(header,bytes.length);u32(header,bytes.length);u16(header,name.length);
    u16(header,0);u16(header,0);u16(header,0);u16(header,0);u32(header,0);u32(header,offset);
    central.push(new Uint8Array([...header,...name]));offset+=local.length+bytes.length;
  }
  const centralOffset=offset;for(const part of central)offset+=part.length;
  const end=[];u32(end,0x06054b50);u16(end,0);u16(end,0);u16(end,files.length);u16(end,files.length);u32(end,offset-centralOffset);u32(end,centralOffset);u16(end,0);
  return new Blob([...data,...central,new Uint8Array(end)],{type:'application/zip'});
}
const sanitize=s=>(String(s||'sprite').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').replace(/_+/g,'_').slice(0,48)||'sprite');
const descriptions={
 unity:'UNITY 2D — Guia de importação\n\n1. Extraia os arquivos e copie spritesheet.png para Assets/Sprites.\n2. Selecione a imagem no Inspector, escolha Texture Type: Sprite (2D and UI), Sprite Mode: Multiple, Filter Mode: Point (no filter), Compression: None.\n3. Abra Sprite Editor > Slice > Grid By Cell Size, utilizando frameWidth e frameHeight do metadata.json.\n4. Apply. Selecione as sprites de cada animação e arraste para a janela Animation para criar clipes Idle/Run/Jump/Attack.\n5. Utilize o FPS e os intervalos descritos em metadata.json para configurar seus clipes e Animator Controller.\n6. Pixels Per Unit pode ser definido conforme a escala desejada. Configure o pivô Bottom Center se necessário.\n\nObs.: O pacote contém arte e metadados, não prefabs ou controladores prontos.\n',
 godot:'GODOT 4 — Guia de importação\n\n1. Extraia os arquivos no diretório do projeto (por exemplo res://Sprites/).\n2. Selecione spritesheet.png e configure Texture > Filter: Nearest, desabilitando filtros de suavização.\n3. Adicione AnimatedSprite2D e um recurso SpriteFrames; abra o painel SpriteFrames.\n4. Use Add Frames from a Sprite Sheet: largura = frameWidth, altura = frameHeight, colunas = totalFrames, linhas = 1.\n5. Separe animações de acordo com os intervalos (start/end, índices zero-based) no metadata.json.\n6. Configure Speed (FPS) e Loop em cada animação.\n7. Para usar Sprite2D em vez de AnimatedSprite2D, configure Hframes = totalFrames e Vframes = 1.\n\nObs.: O pacote contém arte e metadados, não uma cena ou scripts já integrados.\n'
};
function createGameLab(getProject){
 const dialog=$('gameModeDialog'),canvas=$('gameScene'),ctx=canvas.getContext('2d'),keys=new Set(),touch=new Set();
 let project=null,images=[],frameTimers=0,animIndex=0,last=0,raf=0,active=false,attackUntil=0,jumpPressed=false,player={x:320,y:278,vy:0,grounded:true,facing:1},state='idle';
 const mappings={idle:'gameIdle',run:'gameRun',jump:'gameJump',attack:'gameAttack'};
 const hsvBg={
  studio:{sky:'#343c57',ground:'#616c86',line:'#a1a9c2',sun:'#7787bd'},
  forest:{sky:'#516d75',ground:'#4e6f55',line:'#a1d2a1',sun:'#a8dcb3'},
  night:{sky:'#171c37',ground:'#323657',line:'#8f92b4',sun:'#a8adf6'}
 };
 const drawScene=()=>{
  const width=canvas.width,height=canvas.height;
  const b=hsvBg[$('gameBackground').value]||hsvBg.studio;
  ctx.clearRect(0,0,width,height);ctx.fillStyle=b.sky;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=b.sun;ctx.beginPath();ctx.arc(530,68,28,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff2';for(let j=0;j<6;j++){ctx.fillRect(j*130+20,90+(j%2)*23,60,4);}
  if($('gameBackground').value==='forest'){ctx.fillStyle='#334e51';for(let i=0;i<9;i++){const xx=i*93-12;ctx.beginPath();ctx.moveTo(xx,278);ctx.lineTo(xx+42,138+(i%3)*18);ctx.lineTo(xx+90,278);ctx.fill();}}
  if($('gameBackground').value==='night'){ctx.fillStyle='#ececff';for(let i=0;i<24;i++)ctx.fillRect((i*103+31)%width,17+(i*41)%155,2,2);}
  ctx.fillStyle=b.ground;ctx.fillRect(0,302,width,58);ctx.fillStyle=b.line;ctx.fillRect(0,300,width,3);
  ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(player.x,302,25,6,0,0,Math.PI*2);ctx.fill();
  const image=currentImage();if(image){const scale=+$('gameScale').value||4,ww=project.width*scale,hh=project.height*scale;ctx.save();ctx.translate(Math.round(player.x),Math.round(player.y));ctx.scale(player.facing,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,-Math.round(ww/2),-hh,ww,hh);ctx.restore();}
  ctx.fillStyle='#e2e8ff';ctx.font='12px Segoe UI, Arial, sans-serif';ctx.fillText('STATE  '+state.toUpperCase(),16,24);
  ctx.fillText('A / D: mover     ESPAÇO: pular     J: atacar',16,44);
 };
 function currentTag(kind){const id=$(mappings[kind]).value;return project.tags.find(t=>t.id===id)||null;}
 function selectedFrames(kind){const tag=currentTag(kind);if(!tag)return project.frames.map((_,i)=>i);const out=[];for(let i=tag.start;i<=tag.end;i++)out.push(i);return out;}
 function currentImage(){const frames=selectedFrames(state);return images[frames[animIndex%Math.max(1,frames.length)]]||images[0];}
 function updateState(next){if(next===state)return;state=next;animIndex=0;frameTimers=0;$('gameStateLabel').textContent=next[0].toUpperCase()+next.slice(1);}
 function step(ts){
  if(!active)return;
  const dt=Math.min(0.05,Math.max(0,(ts-last)/1000||0));last=ts;
  const left=keys.has('arrowleft')||keys.has('a')||touch.has('left'),right=keys.has('arrowright')||keys.has('d')||touch.has('right');
  const direction=Number(right)-Number(left);
  const speed=+$('gameSpeed').value||150;
  player.x=clamp(player.x+direction*speed*dt,15,canvas.width-15);
  if(direction)player.facing=direction;
  const jumping=keys.has(' ')||keys.has('arrowup')||keys.has('w')||jumpPressed;
  if(jumping&&player.grounded){player.vy=-350;player.grounded=false;}
  jumpPressed=false;
  if(!player.grounded){player.vy+=1050*dt;player.y+=player.vy*dt;if(player.y>=300){player.y=300;player.vy=0;player.grounded=true;}}
  const next=ts<attackUntil?'attack':!player.grounded?'jump':direction?'run':'idle';updateState(next);
  frameTimers+=dt;const fps=clamp(project.fps||8,1,24);if(frameTimers>=1/fps){animIndex=(animIndex+Math.floor(frameTimers*fps))%Math.max(1,selectedFrames(state).length);frameTimers%=1/fps;}
  drawScene();raf=requestAnimationFrame(step);
 }
 function reset(){player={x:canvas.width/2,y:300,vy:0,grounded:true,facing:1};attackUntil=0;updateState('idle');drawScene();}
 function load(){project=getProject();images=project.frames.map(p=>{const el=document.createElement('canvas');el.width=project.width;el.height=project.height;el.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(p),project.width,project.height),0,0);return el;});
  const all=[{id:'all',name:'Todos os frames',start:0,end:project.frames.length-1},...project.tags];
  for(const kind of Object.keys(mappings)){const el=$(mappings[kind]);const old=el.value;el.replaceChildren();for(const tag of all){const op=document.createElement('option');op.value=tag.id;op.textContent=tag.name+' ('+(tag.start+1)+'–'+(tag.end+1)+')';el.append(op);}const match=project.tags.find(t=>new RegExp(kind==='run'?'walk|run':kind,'i').test(t.name));el.value=all.some(x=>x.id===old)?old:match?match.id:'all';}
  reset();
 }
 async function exportPackage(engine){
  const btn=$(engine==='unity'?'gameExportUnity':'gameExportGodot');btn.disabled=true;
  try{
   const sheet=document.createElement('canvas');sheet.width=project.width*project.frames.length;sheet.height=project.height;if(sheet.width>16384)throw Error('Spritesheet muito grande para exportação');
   const g=sheet.getContext('2d');images.forEach((img,i)=>g.drawImage(img,i*project.width,0));
   const blob=await new Promise(resolve=>sheet.toBlob(resolve,'image/png'));if(!blob)throw Error('O navegador não conseguiu gerar PNG');
   const png=new Uint8Array(await blob.arrayBuffer());
   const metadata={format:'PIXEL-BMister Game Lab',version:1,engine,project:project.name,frameWidth:project.width,frameHeight:project.height,totalFrames:project.frames.length,layout:'horizontal',fps:project.fps,animations:project.tags.map(t=>({name:t.name,start:t.start,end:t.end,frameCount:t.end-t.start+1})),mapping:Object.fromEntries(Object.entries(mappings).map(([key,id])=>[key,$(id).value])),scale:+$('gameScale').value,movementSpeed:+$('gameSpeed').value,note:'Frames de animações são inclusivos e índices começam em 0.'};
   const zip=zipEntries([{name:'spritesheet.png',bytes:png},{name:'metadata.json',bytes:JSON.stringify(metadata,null,2)},{name:'README_'+engine.toUpperCase()+'.txt',bytes:descriptions[engine]}]);
   const url=URL.createObjectURL(zip),a=document.createElement('a');a.href=url;a.download=sanitize(project.name)+'_'+engine+'_game_assets.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }catch(e){alert('Erro ao exportar: '+e.message);}finally{btn.disabled=false;}
 }
 const relevant=e=>['a','d','w','arrowleft','arrowright','arrowup',' ','j'].includes(e.key.toLowerCase());
 const onDown=e=>{if(!active||!relevant(e)||e.target.closest('input,select,textarea'))return;e.preventDefault();const k=e.key.toLowerCase();keys.add(k);if(k==='j'&&!e.repeat)attackUntil=performance.now()+400;};
 const onUp=e=>keys.delete(e.key.toLowerCase());
 document.addEventListener('keydown',onDown);
 document.addEventListener('keyup',onUp);
 window.addEventListener('blur',()=>{keys.clear();touch.clear();});
 $('gameModeBtn').onclick=()=>{load();dialog.showModal();active=true;last=performance.now();raf=requestAnimationFrame(step);canvas.focus();};
 function close(){active=false;cancelAnimationFrame(raf);keys.clear();touch.clear();if(dialog.open)dialog.close();}
 $('gameClose').onclick=close;dialog.addEventListener('close',()=>{active=false;cancelAnimationFrame(raf);keys.clear();touch.clear();});
 $('gameReset').onclick=reset;$('gameRefresh').onclick=load;
 $('gameScale').oninput=e=>$('gameScaleLabel').textContent=e.target.value+'×';
 $('gameSpeed').oninput=e=>$('gameSpeedLabel').textContent=e.target.value+' px/s';
 $('gameExportUnity').onclick=()=>exportPackage('unity');$('gameExportGodot').onclick=()=>exportPackage('godot');
 $('gameJumpBtn').onclick=()=>{jumpPressed=true;canvas.focus();};
 $('gameAttackBtn').onclick=()=>{attackUntil=performance.now()+400;canvas.focus();};
 for(const button of document.querySelectorAll('[data-game-key]')){const k=button.dataset.gameKey;button.addEventListener('pointerdown',e=>{e.preventDefault();touch.add(k);button.setPointerCapture(e.pointerId);canvas.focus();});for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>touch.delete(k));}
 for(const id of Object.values(mappings))$(id).addEventListener('change',()=>{updateState('idle');drawScene();});
 return {open:()=>$('gameModeBtn').click(),refresh:load};
}
window.PixelGameLab={createGameLab,zipEntries};
})();