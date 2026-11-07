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
 let project=null,images=[],frameTimers=0,animIndex=0,last=0,raf=0,active=false,attackUntil=0,jumpPressed=false,player=null,state='idle',camera=0;
 const physics=window.PixelGamePhysics;
 if(!physics)throw Error('Módulo de física do Game Lab não carregado');
 const getLevel=()=>physics.levels[$('gameBackground').value]||physics.levels.studio;
 const mappings={idle:'gameIdle',run:'gameRun',jump:'gameJump',attack:'gameAttack'};
 const hsvBg={
  studio:{sky:'#343c57',ground:'#616c86',line:'#a1a9c2',sun:'#7787bd'},
  forest:{sky:'#516d75',ground:'#4e6f55',line:'#a1d2a1',sun:'#a8dcb3'},
  night:{sky:'#171c37',ground:'#323657',line:'#8f92b4',sun:'#a8adf6'}
 };
 const drawScene=()=>{
  const width=canvas.width,height=canvas.height,level=getLevel();
  const b=hsvBg[$('gameBackground').value]||hsvBg.studio;
  camera=physics.cameraX(player,level,width);
  ctx.clearRect(0,0,width,height);ctx.fillStyle=b.sky;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=b.sun;ctx.beginPath();ctx.arc(530-camera*.04,68,28,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#fff2';for(let j=0;j<25;j++){const x=j*130+20-camera*.2;if(x>-70&&x<width+20)ctx.fillRect(x,90+(j%2)*23,60,4);}
  if($('gameBackground').value==='forest'){ctx.fillStyle='#334e51';for(let i=0;i<28;i++){const xx=i*93-12-camera*.55;if(xx<width+130&&xx>-130){ctx.beginPath();ctx.moveTo(xx,310);ctx.lineTo(xx+42,138+(i%3)*18);ctx.lineTo(xx+90,310);ctx.fill();}}}
  if($('gameBackground').value==='night'){ctx.fillStyle='#ececff';for(let i=0;i<90;i++){const x=i*103+31-camera*.08;if(x>=0&&x<width)ctx.fillRect(x,17+(i*41)%155,2,2);}}
  for(const p of level.platforms){const x=Math.round(p.x-camera);if(x+p.w<0||x>width)continue;ctx.fillStyle=b.ground;ctx.fillRect(x,p.y,p.w,p.h);ctx.fillStyle=b.line;ctx.fillRect(x,p.y,p.w,4);ctx.fillStyle='#0002';for(let j=12;j<p.w;j+=24)ctx.fillRect(x+j,p.y+10,9,3);}
  ctx.fillStyle='#0004';ctx.beginPath();ctx.ellipse(Math.round(player.x-camera),Math.min(335,player.y+3),20,5,0,0,Math.PI*2);ctx.fill();
  const image=currentImage();if(image){const scale=+$('gameScale').value||4,ww=project.width*scale,hh=project.height*scale;ctx.save();ctx.translate(Math.round(player.x-camera),Math.round(player.y));ctx.scale(player.facing,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,-Math.round(ww/2),-hh,ww,hh);ctx.restore();}
  // Visible collision footprint so even empty sprites can be tested.
  ctx.strokeStyle='#c4d5ff88';ctx.strokeRect(Math.round(player.x-camera-player.halfWidth)+.5,Math.round(player.y-player.height)+.5,player.halfWidth*2,player.height);
  ctx.fillStyle='#e2e8ff';ctx.font='12px Segoe UI, Arial, sans-serif';ctx.fillText('STATE  '+state.toUpperCase(),16,24);
  ctx.fillText('A/D mover · ESPAÇO pular · J atacar · câmera seguindo',16,44);
  $('gamePositionLabel').textContent='X '+Math.round(player.x)+' · Y '+Math.round(player.y);
 };
 function currentTag(kind){const id=$(mappings[kind]).value;return project.tags.find(t=>t.id===id)||null;}
 function selectedFrames(kind){const tag=currentTag(kind);if(!tag)return project.frames.map((_,i)=>i);const out=[];for(let i=tag.start;i<=tag.end;i++)out.push(i);return out;}
 function currentImage(){const frames=selectedFrames(state);return images[frames[animIndex%Math.max(1,frames.length)]]||images[0];}
 function updateState(next){if(next===state)return;state=next;animIndex=0;frameTimers=0;$('gameStateLabel').textContent=next[0].toUpperCase()+next.slice(1);}
 function step(ts){
  if(!active)return;
  const dt=Math.min(0.05,Math.max(0,(ts-last)/1000||0));last=ts;
  const left=keys.has('arrowleft')||keys.has('a')||touch.has('left'),right=keys.has('arrowright')||keys.has('d')||touch.has('right');
  const jumping=keys.has(' ')||keys.has('arrowup')||keys.has('w')||jumpPressed;
  const move=Number(right)-Number(left);
  // Edge-trigger jump so holding space does not automatically double jump after landing.
  const jumpNow=jumping&&!jumpHeld;jumpHeld=jumping;
  jumpPressed=false;
  physics.tick(player,getLevel(),{left,right,jump:jumpNow},dt,{speed:+$('gameSpeed').value,gravity:+$('gameGravity').value,jump:+$('gameJumpForce').value});
  const next=ts<attackUntil?'attack':!player.grounded?'jump':move?'run':'idle';updateState(next);
  frameTimers+=dt;const fps=clamp(project.fps||8,1,24);
  if(frameTimers>=1/fps){animIndex=(animIndex+Math.floor(frameTimers*fps))%Math.max(1,selectedFrames(state).length);frameTimers%=1/fps;}
  drawScene();raf=requestAnimationFrame(step);
 }
 let jumpHeld=false;
 function reset(){const level=getLevel();player=physics.createPlayer(level.spawn.x,level.spawn.y);player.grounded=true;jumpHeld=false;jumpPressed=false;attackUntil=0;updateState('idle');drawScene();}
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
   const metadata={format:'PIXEL-BMister Game Lab',version:2,engine,project:project.name,frameWidth:project.width,frameHeight:project.height,totalFrames:project.frames.length,layout:'horizontal',fps:project.fps,animations:project.tags.map(t=>({name:t.name,start:t.start,end:t.end,frameCount:t.end-t.start+1})),mapping:Object.fromEntries(Object.entries(mappings).map(([key,id])=>[key,$(id).value])),scale:+$('gameScale').value,movementSpeed:+$('gameSpeed').value,gravity:+$('gameGravity').value,jumpImpulse:+$('gameJumpForce').value,previewMap:$('gameBackground').value,previewMapPlatforms:getLevel().platforms,note:'Frames de animações são inclusivos e índices começam em 0.'};
   const zip=zipEntries([{name:'spritesheet.png',bytes:png},{name:'metadata.json',bytes:JSON.stringify(metadata,null,2)},{name:'README_'+engine.toUpperCase()+'.txt',bytes:descriptions[engine]}]);
   const url=URL.createObjectURL(zip),a=document.createElement('a');a.href=url;a.download=sanitize(project.name)+'_'+engine+'_game_assets.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }catch(e){alert('Erro ao exportar: '+e.message);}finally{btn.disabled=false;}
 }
 const relevant=e=>['a','d','w','arrowleft','arrowright','arrowup',' ','j'].includes(e.key.toLowerCase());
 const onDown=e=>{if(!active||!relevant(e)||e.target.closest('input,select,textarea'))return;e.preventDefault();const k=e.key.toLowerCase();keys.add(k);if(k==='j'&&!e.repeat)attackUntil=performance.now()+400;};
 const onUp=e=>keys.delete(e.key.toLowerCase());
 document.addEventListener('keydown',onDown);
 document.addEventListener('keyup',onUp);
 window.addEventListener('blur',()=>{keys.clear();touch.clear();jumpHeld=false;});
 $('gameModeBtn').onclick=()=>{load();dialog.showModal();active=true;last=performance.now();raf=requestAnimationFrame(step);canvas.focus();};
 function close(){active=false;cancelAnimationFrame(raf);keys.clear();touch.clear();if(dialog.open)dialog.close();}
 $('gameClose').onclick=close;dialog.addEventListener('close',()=>{active=false;cancelAnimationFrame(raf);keys.clear();touch.clear();});
 $('gameReset').onclick=reset;$('gameRefresh').onclick=load;$('gameBackground').onchange=reset;
 $('gameGravity').oninput=e=>$('gameGravityLabel').textContent=e.target.value;
 $('gameJumpForce').oninput=e=>$('gameJumpForceLabel').textContent=e.target.value;
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