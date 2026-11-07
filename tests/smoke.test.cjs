'use strict';
/* Execute with: node --test tests/smoke.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('main JS parses without syntax errors',()=>{
  assert.doesNotThrow(()=>new vm.Script(read('app.js')));
  assert.doesNotThrow(()=>new vm.Script(read('gif-export.js')));
  assert.doesNotThrow(()=>new vm.Script(read('game-mode.js')));
  assert.doesNotThrow(()=>new vm.Script(read('game-physics.js')));
});

test('every statically referenced DOM ID exists',()=>{
 const html=read('index.html');
 const ids=[...read('app.js').matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]);
 for(const id of new Set(ids))assert.ok(html.includes('id="'+id+'"'),'Missing HTML id: '+id);
});

test('Render remains a static site',()=>{
 const config=read('render.yaml');
 assert.match(config,/runtime:\s*static/);
 assert.match(config,/staticPublishPath:\s*\./);
 assert.match(config,/branch:\s*main/);
});

test('animation controls and tool canvases exist',()=>{
 const html=read('index.html');
 for(const id of ['artCanvas','onionCanvas','gridCanvas','overlayCanvas','frameStrip','animationSelect','onionToggle','exportSheetBtn','exportGifBtn','historyList','layerUp','layerDown','duplicateLayer','mergeLayer']){
   assert.ok(html.includes('id="'+id+'"'),'Required element missing: '+id);
 }
});

test('GIF encoder creates valid GIF89a structure including frame blocks',()=>{
 const window={};
 const BlobShim=class {constructor(parts,opts){this.data=parts[0];this.type=opts.type;}};
 const ctx=vm.createContext({window,Blob:BlobShim,Uint8Array,Uint8ClampedArray,Math,Map,Error});
 vm.runInContext(read('gif-export.js'),ctx);
 const pixels=new Uint8ClampedArray(32*32*4);
 for(let i=0;i<32*32;i++){pixels[4*i]=255;pixels[4*i+3]=255;}
 const blob=window.PixelForgeGif.encode([pixels,pixels],32,32,8,true);
 const data=blob.data;
 assert.equal(String.fromCharCode(...data.slice(0,6)),'GIF89a');
 assert.equal(data[data.length-1],0x3b);
 assert.equal(blob.type,'image/gif');
 // A transparent 32x32 canvas still serializes one image descriptor per animation frame.
 assert.equal([...data].filter(x=>x===0x2c).length>=2,true);
});

test('all code assets are relative local files for static hosting',()=>{
 const html=read('index.html');
 assert.match(html,/src="app\.js"/);
 assert.match(html,/src="gif-export\.js"/);
 assert.match(html,/href="style\.css"/);
});


test('game lab has all required dialog controls',()=>{
 const html=read('index.html');
 for(const id of ['gameModeBtn','gameModeDialog','gameScene','gameIdle','gameRun','gameJump','gameAttack','gameExportUnity','gameExportGodot','gameRefresh','gameScale','gameSpeed']){
   assert.ok(html.includes('id="'+id+'"'),'Missing game mode control: '+id);
 }
 assert.match(html,/src="game-mode\.js"/);
});
test('ZIP exporter produces local ZIP headers and two entries',()=>{
 class BlobShim {constructor(parts,options){this.parts=parts;this.type=options.type;}}
 const window={};
 vm.runInNewContext(read('game-mode.js'),{window,TextEncoder,Uint8Array,Uint32Array,Blob:BlobShim,Math,Set,Error});
 const archive=window.PixelGameLab.zipEntries([{name:'a.txt',bytes:'hello'},{name:'b.txt',bytes:'world'}]);
 assert.equal(archive.type,'application/zip');
 assert.equal(archive.parts[0][0],0x50);
 assert.equal(archive.parts[0][1],0x4b);
 assert.equal(archive.parts.at(-1)[0],0x50);
 assert.equal(archive.parts.at(-1)[1],0x4b);
});


test('game physics handles landing, jump, wall collision and respawn',()=>{
 const win={};vm.runInNewContext(read('game-physics.js'),{window:win,Math,Number,Error});
 const {levels,createPlayer,tick,cameraX}=win.PixelGamePhysics;
 assert.ok(Object.keys(levels).length>=3);
 const lvl=levels.studio,p=createPlayer(90,230);
 for(let i=0;i<40;i++)tick(p,lvl,{left:false,right:false,jump:false},1/60);
 assert.equal(p.y,300,'land on ground');
 assert.equal(p.grounded,true);
 tick(p,lvl,{left:false,right:false,jump:true},1/60);
 assert.ok(p.y<300,'jump rises');
 assert.equal(p.grounded,false);
 for(let i=0;i<90;i++)tick(p,lvl,{left:false,right:false,jump:false},1/60);
 assert.equal(p.y,300,'land after jump');
 assert.equal(p.grounded,true);
 p.x=230-12-1;p.y=294;p.vy=0;
 tick(p,lvl,{left:false,right:true,jump:false},1/60);
 assert.ok(p.x<=230-12,'cannot enter platform side');
 p.x=lvl.width+100;tick(p,lvl,{left:false,right:false,jump:false},1/60);
 assert.ok(p.x<=lvl.width-p.halfWidth);
 p.y=lvl.height+150;tick(p,lvl,{left:false,right:false,jump:false},1/60);
 assert.equal(p.x,lvl.spawn.x,'respawn x');
 assert.equal(p.y,lvl.spawn.y,'respawn y');
 assert.equal(cameraX({x:0},lvl,640),0);
 assert.equal(cameraX({x:lvl.width},lvl,640),lvl.width-640);
});
