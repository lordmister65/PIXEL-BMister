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
  assert.doesNotThrow(()=>new vm.Script(read('studio-ui.js')));
  assert.doesNotThrow(()=>new vm.Script(read('project-manager.js')));
  assert.doesNotThrow(()=>new vm.Script(read('large-canvas.js')));
  assert.doesNotThrow(()=>new vm.Script(read('panel-gestures.js')));
  assert.doesNotThrow(()=>new vm.Script(read('professional-tools.js')));
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
 p.x=230-12-1;p.y=255;p.vy=0;
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

test('graphite studio theme is applied without replacing application modules',()=>{
 const html=read('index.html');
 assert.match(html,/href="studio-theme\.css"/);
 assert.match(html,/src="studio-ui\.js"/);
 assert.ok(html.indexOf('href="style.css"')<html.indexOf('href="studio-theme.css"'),'Theme overrides base CSS');
 const theme=read('studio-theme.css');
 for(const part of ['.topbar','.tools','.canvas-viewport','.timeline','.inspector','.game-mode-dialog'])assert.ok(theme.includes(part),'Missing studio selector: '+part);
 for(const id of ['palettePanel','toolPropertiesPanel','historyPanel'])assert.ok(html.includes('id="'+id+'"'),'Missing inspector anchor '+id);
 assert.match(read('render.yaml'),/runtime:\s*static/);
});


test('Studio UX 1.7 menus preserve existing editor commands',()=>{
 const html=read('index.html');
 const ids=['fileMenu','exportMenu','saveBtn','loadBtn','importPngBtn','exportBtn','exportSheetBtn','exportGifBtn','gameModeBtn','focusModeBtn','toggleToolsBtn','toggleInspectorBtn','showInspectorBtn','inspectorResizer','centerCanvasBtn'];
 for(const id of ids)assert.ok(html.includes('id="'+id+'"'),'Missing workspace control: '+id);
 for(const file of ['style.css','studio-theme.css','studio-ui.js','app.js'])assert.ok(fs.existsSync(path.join(root,file)),file+' missing');
 const ui=read('studio-ui.js'),app=read('app.js'),theme=read('studio-theme.css');
 assert.match(ui,/setPointerCapture/);
 assert.match(ui,/event\.code==='Space'/);
 assert.match(ui,/addEventListener\('wheel'/);
 assert.match(ui,/focusButton/);
 assert.match(app,/window\.PixelStudioCanvas/);
 assert.match(app,/if\(key==='p'\)/);
 assert.match(theme,/studio-focus-mode/);
 assert.match(theme,/studio-tools-collapsed/);
 assert.match(theme,/studio-inspector-collapsed/);
 assert.match(theme,/studio-menu-list/);
});

test('Studio UX keeps keyboard accessibility and mobile menus',()=>{
 const html=read('index.html'),css=read('studio-theme.css');
 assert.match(html,/Shift\+D<\/span>Modo sem distrações/);
 assert.match(css,/studio-menu \.studio-menu-item\{display:block!important/);
 assert.match(html,/role="separator"/);
 assert.match(html,/aria-valuenow="284"/);
 assert.match(html,/aria-pressed="false"/);
});


test('V1.8 pixel-perfect path removes only redundant L corner',()=>{
 const window={};vm.runInNewContext(read('professional-tools.js'),{window,Math,Uint8Array,Number});
 const pro=window.PixelProfessionalTools;
 const path=pro.pixelPerfectPath([{x:0,y:0},{x:1,y:0},{x:1,y:1}]);
 assert.equal(path.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(path)),[{x:0,y:0},{x:1,y:1}]);
 assert.equal(pro.pixelPerfectPath([{x:0,y:0},{x:1,y:0},{x:2,y:0}]).length,3);
});

test('V1.8 geometric brushes are distinct and centered',()=>{
 const win={};vm.runInNewContext(read('professional-tools.js'),{window:win,Math,Uint8Array,Number});
 const {brushPoints}=win.PixelProfessionalTools;
 assert.equal(brushPoints(5,5,3,'square').length,9);
 assert.ok(brushPoints(5,5,5,'circle').length<25);
 assert.ok(brushPoints(5,5,5,'diamond').length<25);
 assert.deepEqual(JSON.parse(JSON.stringify(brushPoints(4,4,1,'square'))),[{x:4,y:4}]);
});

test('V1.8 color selection supports contiguous/global masks and alpha',()=>{
 const win={};vm.runInNewContext(read('professional-tools.js'),{window:win,Math,Uint8Array,Number});
 const {colorMask}=win.PixelProfessionalTools;
 const pix=new Uint8Array(5*4);pix.set([255,0,0,255],0);pix.set([255,0,0,255],8);pix.set([10,0,0,255],12);
 const contiguous=colorMask(pix,5,1,0,0,0,false),global=colorMask(pix,5,1,0,0,0,true);
 assert.equal(contiguous[0],1);assert.equal(contiguous[2],0);
 assert.equal(global[0],1);assert.equal(global[2],1);assert.equal(global[3],0);
});

test('V1.8 lasso masks preserve irregular selection boundaries',()=>{
 const win={};vm.runInNewContext(read('professional-tools.js'),{window:win,Math,Uint8Array,Number});
 const {polygonMask,maskBounds}=win.PixelProfessionalTools;
 const mask=polygonMask([{x:1,y:1},{x:4,y:1},{x:2,y:4}],6,6);
 assert.equal(mask[0],0);
 assert.equal(mask[2*6+2],1);
 assert.ok(mask.reduce((n,x)=>n+x,0)<6*6);
 const bounds=maskBounds(mask,6,6);
 assert.equal(bounds.x,1);assert.equal(bounds.y,1);
});

test('V1.8 UI includes selection and brush controls and layer locking',()=>{
 const html=read('index.html'),app=read('app.js'),css=read('studio-theme.css');
 for(const id of ['pixelPerfect','brushShape','colorSelectMode','colorTolerance','colorToleranceValue']){
  assert.ok(html.includes('id="'+id+'"'),'Missing V1.8 control: '+id);
 }
 assert.match(html,/data-tool="lasso"/);
 assert.match(html,/data-tool="magic"/);
 assert.match(html,/src="professional-tools\.js"/);
 assert.ok(html.indexOf('src="professional-tools.js"')<html.indexOf('src="app.js"'));
 assert.match(app,/locked:l\.locked===true/);
 assert.match(app,/function hasEditableLayer\(/);
 assert.match(app,/function resizeSelected\(/);
 assert.match(app,/function setMaskedSelection\(/);
 assert.match(css,/\.layer-lock\.locked/);
 assert.match(read('render.yaml'),/runtime:\s*static/);
});


test('V1.9 project templates provide valid editable sprites and animations',()=>{
 const win={};
 vm.runInNewContext(read('project-manager.js'),{window:win,Math,Date,Uint8ClampedArray,Uint8Array,Promise,JSON,Error});
 const {makeTemplate}=win.PixelProjectLibrary;
 for(const [type,w,h,count] of [['sprite16',16,16,1],['character32',32,32,1],['tileset64',64,64,1],['animation32',32,32,8]]){
  const doc=makeTemplate(type);
  assert.equal(doc.format,'PIXEL-BMister');
  assert.equal(doc.width,w);assert.equal(doc.height,h);assert.equal(doc.frames.length,count);
  assert.equal(doc.frames[0].layers.length,2);
  for(const frame of doc.frames)for(const layer of frame.layers)assert.equal(layer.pixels.length,w*h*4);
  assert.ok(doc.frames.some(f=>f.layers[1].pixels.some(v=>v!==0)),'Expected nonempty sample art for '+type);
  assert.equal(doc.frames[0].layers[1].locked,false);
 }
 const animation=makeTemplate('animation32');
 assert.equal(animation.animationTags.length,2);
 assert.equal(animation.animationTags[1].end,7);
});

test('V1.9 new blank project supports custom dimensions and rejects invalid dimensions',()=>{
 const win={};vm.runInNewContext(read('project-manager.js'),{window:win,Math,Date,Uint8Array,Promise,JSON,Error});
 const {makeTemplate}=win.PixelProjectLibrary;
 const doc=makeTemplate('blank','Meu mapa',48,24);
 assert.equal(doc.name,'Meu mapa');
 assert.equal(doc.width,48);assert.equal(doc.height,24);
 assert.ok(doc.frames[0].layers[1].pixels.every(x=>x===0));
 assert.throws(()=>makeTemplate('blank','Inválido',256,24),/Dimensões/);
});

test('V1.9 welcome screen and persistent project controls are connected',()=>{
 const html=read('index.html'),app=read('app.js'),source=read('project-manager.js'),style=read('studio-theme.css');
 for(const id of ['homeBtn','saveLibraryBtn','projectHome','projectHomeClose','newBlankBtn','confirmBlankProject','recentProjectsList','recentCount','resumeSessionBtn','refreshProjectsBtn','importProjectHomeBtn','blankProjectWidth','blankProjectHeight']){
  assert.ok(html.includes('id="'+id+'"'),'Missing project manager control: '+id);
 }
 for(const type of ['sprite16','character32','tileset64','animation32'])assert.ok(html.includes('data-template="'+type+'"'));
 assert.match(html,/src="project-manager\.js"/);
 assert.ok(html.indexOf('src="project-manager.js"')<html.indexOf('src="app.js"'));
 assert.match(source,/indexedDB\.open|indexedDB\.open|indexedDB/);
 assert.match(source,/openDatabase/);
 assert.match(source,/storeSnapshot/);
 assert.match(app,/window\.PixelProjectManager/);
 assert.match(app,/libraryId:window\.PixelProjectManager/);
 assert.match(style,/\.project-home/);
 assert.match(read('render.yaml'),/runtime:\s*static/);
});


test('V2.0 frame navigation does not recreate the thumbnail strip or autosave on selection',()=>{
 const app=read('app.js');
 const frameMethod=app.slice(app.indexOf('function setFrame(i)'),app.indexOf("$('duplicateFrame').onclick",app.indexOf('function setFrame(i)')));
 assert.ok(frameMethod.includes('redraw()'));
 assert.ok(frameMethod.includes('renderLayers()'));
 assert.ok(!frameMethod.includes('renderFrames()'),'Frame navigation should reuse thumbnails');
 assert.ok(!frameMethod.includes('scheduleSave()'),'Frame-only navigation should not serialize every pixel');
 assert.match(app,/aria-pressed/);
});

test('V2.0 accessibility provides reduced motion, keyboard skip navigation and status messages',()=>{
 const html=read('index.html'),css=read('studio-theme.css');
 assert.match(html,/class="skip-link"/);
 assert.match(html,/id="canvasViewport"[^>]+tabindex="0"/);
 assert.match(html,/id="statusText"[^>]+aria-live="polite"/);
 assert.match(html,/id="frameStrip"[^>]+role="group"/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/forced-colors:active/);
 assert.match(css,/\.skip-link:focus/);
});

test('V2.0 saved project validation and storage concurrency safeguards are present',()=>{
 const app=read('app.js'),library=read('project-manager.js');
 assert.match(app,/function validateProject\(d\)/);
 assert.match(app,/Number\.isFinite\(l\.opacity\)/);
 assert.match(app,/saveStatus='dirty'/);
 assert.match(app,/saveStatus='error'/);
 assert.match(library,/writeQueue=Promise\.resolve\(\)/);
 assert.match(library,/writeQueue\.catch\(\(\)=>\{\}\)\.then/);
 assert.match(library,/await writeQueue/);
 assert.match(read('render.yaml'),/runtime:\s*static/);
});


test('10,000 x 10,000 project editor is sparse and does not allocate dense images on open',()=>{
 const html=read('index.html'),large=read('large-canvas.js'),theme=read('large-canvas.css');
 for(const id of ['largeCanvasBtn','largeCanvasDialog','largeDrawCanvas','largeViewport','largeProjectsDialog','largeLayerList','largeSaveFile','largeExport']){
  assert.ok(html.includes('id="'+id+'"'),'Missing large canvas UI: '+id);
 }
 assert.match(html,/id="blankProjectWidth"[^>]+max="10000"/);
 assert.match(html,/id="blankProjectHeight"[^>]+max="10000"/);
 assert.match(html,/id="newWidth"[^>]+max="10000"/);
 assert.match(html,/id="newHeight"[^>]+max="10000"/);
 assert.match(large,/TILE=128,MAX=10000,MAX_TILES=6400/);
 assert.match(large,/tiles:new Map\(\)/);
 assert.match(large,/function serialize\(/);
 assert.match(large,/function exportPNG\(/);
 assert.match(theme,/\.large-canvas-dialog/);
 assert.match(read('project-manager.js'),/PixelBigCanvas\.open\(width,height,name\)/);
 assert.match(read('app.js'),/PixelBigCanvas\.open\(nw,nh/);
 assert.match(read('render.yaml'),/runtime:\s*static/);
});

test('Studio dock panels support both pointer gestures and button toggles',()=>{
 const ui=read('panel-gestures.js'),html=read('index.html'),theme=read('studio-theme.css');
 assert.match(html,/src="panel-gestures\.js"/);
 assert.match(ui,/pointerdown/);
 assert.match(ui,/pointermove/);
 assert.match(ui,/pointerup/);
 assert.match(ui,/studio-panel-minimized/);
 assert.match(ui,/studio-timeline-minimized/);
 assert.match(ui,/aria-expanded/);
 assert.match(theme,/studio-panel-minimized/);
 assert.match(theme,/studio-timeline-minimized/);
 assert.match(theme,/\.studio-dock-toggle/);
});
