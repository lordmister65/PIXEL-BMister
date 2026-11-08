'use strict';
// Browser homologation for Pixel-BMister. Run: node --test tests/browser.test.cjs
// Requires Playwright only in CI/dev, never in the deployed static site.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};

function serve(){
 const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  const name=decodeURIComponent(url.pathname)==='/'?'/index.html':decodeURIComponent(url.pathname);
  const file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{
   if(error){response.writeHead(404).end();return;}
   response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
   response.end(bytes);
  });
 });
 return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server)));
}
async function drawAt(page,x,y){
 const rect=await page.locator('#overlayCanvas').boundingBox();
 const width=await page.locator('#overlayCanvas').evaluate(e=>e.width);
 const height=await page.locator('#overlayCanvas').evaluate(e=>e.height);
 assert.ok(rect,'Canvas missing');
 const px=rect.x+(x+0.5)*rect.width/width,py=rect.y+(y+0.5)*rect.height/height;
 await page.mouse.move(px,py);await page.mouse.down();await page.mouse.up();
}
const alphaAt=(page,x,y)=>page.locator('#artCanvas').evaluate((canvas,pos)=>{
 const ctx=canvas.getContext('2d');return ctx.getImageData(pos[0],pos[1],1,1).data[3];
},[x,y]);

test('V2.0 homepage, drawing, layers, autosave, export and Game Lab', {timeout:120000},async()=>{
 const server=await serve();
 let browser;
 try{
  const address=server.address(),errors=[];
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:'+address.port+'/');
  await page.locator('#projectHome[open]').waitFor({timeout:12000});
  assert.match(await page.title(),/PIXEL-BMister/);

  // Start from a real template and verify the original editor remains functional.
  await page.locator('[data-template="sprite16"]').click();
  await page.locator('#projectHome').waitFor({state:'hidden'});
  assert.equal(await page.locator('#artCanvas').evaluate(el=>el.width),16);
  await page.locator('[data-tool="pencil"]').click();
  await page.locator('#colorInput').evaluate(el=>{el.value='#00ff00';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await drawAt(page,2,2);
  assert.ok((await alphaAt(page,2,2))>0,'Pencil must draw to canvas');
  await page.locator('#undoBtn').click();
  assert.equal(await alphaAt(page,2,2),0,'Undo must revert the stroke');
  await page.locator('#redoBtn').click();
  assert.ok((await alphaAt(page,2,2))>0,'Redo must restore the stroke');
  // Precise color selection and masked copy/paste must affect the intended pixels.
  await page.locator('[data-tool="magic"]').click();
  await drawAt(page,2,2);
  assert.match(await page.locator('#selectionStatus').textContent(),/Seleção: 1 px/);
  await page.locator('#copySelection').click();
  await page.locator('#pasteSelection').click();
  assert.ok((await alphaAt(page,3,3))>0,'Pasted selection must preserve copied pixel');


  // Locking prevents painting but doesn't discard the existing pixels.
  await page.locator('#layerList .layer-lock').first().click();
  const before=await alphaAt(page,3,2);
  await drawAt(page,3,2);
  assert.equal(await alphaAt(page,3,2),before,'Locked layer must reject drawing');
  await page.locator('#layerList .layer-lock').first().click();

  // Export should produce actual PNG bytes.
  await page.locator('#exportMenu summary').click();
  const pngEvent=page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const png=await pngEvent;
  assert.ok(png.suggestedFilename().endsWith('.png'));

  // Save to IndexedDB, then reload and recover the project.
  await page.locator('#fileMenu summary').click();
  await page.locator('#saveLibraryBtn').click();
  await page.reload();
  await page.locator('#projectHome[open]').waitFor({timeout:12000});
  assert.ok(await page.locator('.recent-project-card').count()>=1,'Recent project entry expected');
  await page.locator('.recent-project-card .recent-project-actions button').first().click();
  await page.locator('#projectHome').waitFor({state:'hidden'});
  assert.equal(await page.locator('#artCanvas').evaluate(el=>el.width),16);
  assert.ok((await alphaAt(page,2,2))>0,'Stored project must recover drawn pixels');

  // Build an animation and verify the Game Lab opens on the real project data.
  await page.locator('#homeBtn').click();
  await page.locator('#projectHome[open]').waitFor();
  await page.locator('[data-template="animation32"]').click();
  await page.locator('#projectHome').waitFor({state:'hidden'});
  assert.equal(await page.locator('#artCanvas').evaluate(el=>el.width),32);
  assert.equal(await page.locator('.frame-card').count(),8);
  await page.locator('#gameModeBtn').click();
  await page.locator('#gameModeDialog[open]').waitFor();
  assert.ok(await page.locator('#gameScene').evaluate(el=>el.width===640));
  await page.keyboard.press('d');
  await page.waitForTimeout(100);
  // Game Lab package is a real ZIP asset bundle produced in the browser.
  const gameZipDownload=page.waitForEvent('download');
  await page.locator('#gameExportGodot').click();
  const zip=await gameZipDownload;
  assert.ok(zip.suggestedFilename().endsWith('.zip'));
  const zipBytes=fs.readFileSync(await zip.path());
  assert.equal(zipBytes.toString('latin1',0,2),'PK');
  await page.locator('#gameClose').click();
  await page.locator('#gameModeDialog').waitFor({state:'hidden'});
  await page.locator('#exportMenu summary').click();
  const gifDownload=page.waitForEvent('download');
  await page.locator('#exportGifBtn').click();
  const gif=await gifDownload;
  const gifBytes=fs.readFileSync(await gif.path());
  assert.equal(gifBytes.toString('ascii',0,6),'GIF89a');
  assert.ok(gif.suggestedFilename().endsWith('.gif'));



  // Studio panels collapse with mouse drag downward and expand when dragged upward.
  const panel=page.locator('#colorPanel'),head=panel.locator('.panel-head strong');
  const headerRect=await head.boundingBox();
  assert.ok(headerRect,'Color panel header missing');
  const hx=headerRect.x+Math.min(30,headerRect.width/2),hy=headerRect.y+headerRect.height/2;
  await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(hx,hy+48,{steps:5});await page.mouse.up();
  assert.ok(await panel.evaluate(el=>el.classList.contains('studio-panel-minimized')),'Dragging header down should collapse panel');
  const restoreRect=await head.boundingBox();
  const rx=restoreRect.x+Math.min(30,restoreRect.width/2),ry=restoreRect.y+restoreRect.height/2;
  await page.mouse.move(rx,ry);await page.mouse.down();await page.mouse.move(rx,ry-48,{steps:5});await page.mouse.up();
  assert.ok(!await panel.evaluate(el=>el.classList.contains('studio-panel-minimized')),'Dragging header up should expand panel');

  // Checkerboard colors are editable, persisted, and reflected in both workspaces.
  await page.locator('#checkerLightColor').fill('#aabbcc');
  await page.locator('#checkerDarkColor').fill('#334455');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--checker-light').trim()),'#aabbcc');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--checker-dark').trim()),'#334455');

  // Restore pencil before drawing; the selected tool is shared between document tabs.
  await page.locator('[data-tool="pencil"]').click();
  // Large art must live inside the existing editor, not a floating dialog.
  await page.locator('#largeCanvasBtn').click();
  await page.locator('.app.studio-large-active').waitFor();
  const dimensions=await page.evaluate(()=>{
    const p=window.PixelBigCanvas.getProject(),stage=document.querySelector('.large-stage');
    return {w:p.width,h:p.height,layers:p.layers.length,tiles:p.layers[0].tiles.size,
      viewportHost:stage.parentElement.id==='canvasViewport',
      modalOpen:document.getElementById('largeCanvasDialog').open};
  });
  assert.deepEqual(dimensions,{w:10000,h:10000,layers:1,tiles:0,viewportHost:true,modalOpen:false});
  assert.ok(await page.locator('#checkerLightColor').isVisible(),'Checkerboard pickers must remain available in the integrated 10k mode');
  assert.ok(await page.locator('#toolPropertiesPanel').isVisible(),'Original properties inspector must remain visible');
  assert.ok(await page.locator('.tools .tool-group').isVisible(),'Original tools must remain visible');
  assert.ok(!await page.locator('.large-settings').isVisible(),'Duplicate properties panel must be hidden');
  assert.ok(!await page.locator('.large-toolbar').isVisible(),'Duplicate tool rail must be hidden');
  assert.ok(await page.locator('#documentTabs [role="tab"]').count()>=3,'Previously opened classic projects and the 10k project must have separate tabs');
  assert.ok(await page.locator('#documentTabs .document-tab-symbol').filter({hasText:'▤'}).count()>=1,'Large project tab expected');
  const largeCanvas=page.locator('#largeDrawCanvas'),largeRect=await largeCanvas.boundingBox();
  assert.ok(largeRect&&largeRect.width>250&&largeRect.height>100,'Large drawing canvas must be visible inside Studio');
  await page.mouse.click(largeRect.x+largeRect.width/2,largeRect.y+largeRect.height/2);
  assert.ok(await page.evaluate(()=>window.PixelBigCanvas.getProject().layers[0].tiles.size)>0,'Painting should allocate only necessary tiles');
  assert.equal(await page.locator('#layerList .layer-item').count(),1,'Large document uses original layer list');
  await page.locator('#largeImportPngFile').setInputFiles(await png.path());
  await page.waitForFunction(()=>window.PixelBigCanvas.getProject().layers.length===2);
  assert.equal(await page.locator('#layerList .layer-item').count(),2,'Imported PNG appears in the original layer panel');
  const firstLargeId=await page.evaluate(()=>window.PixelBigCanvas.getProject().id);
  await page.screenshot({path:path.join(root,'tests','studio-big-canvas.png'),fullPage:true});
  // Opening a second 10K project creates another in-app tab, without replacing the first.
  await page.locator('#largeCanvasBtn').click();
  await page.waitForFunction(id=>window.PixelBigCanvas.getProject()?.id!==id,firstLargeId);
  const secondLargeId=await page.evaluate(()=>window.PixelBigCanvas.getProject().id);
  assert.equal(await page.evaluate(()=>window.PixelBigCanvas.getProject().layers[0].tiles.size),0,'Second project starts blank');
  const openTabs=await page.evaluate(()=>window.PixelDocumentTabs.getTabs());
  assert.ok(openTabs.some(t=>t.id==='large-'+firstLargeId));
  assert.ok(openTabs.some(t=>t.id==='large-'+secondLargeId));
  const firstTabIndex=openTabs.findIndex(t=>t.id==='large-'+firstLargeId);
  await page.locator('#documentTabs [role="tab"]').nth(firstTabIndex).click();
  await page.waitForFunction(id=>window.PixelBigCanvas.getProject()?.id===id,firstLargeId);
  assert.ok(await page.evaluate(()=>window.PixelBigCanvas.getProject().layers[0].tiles.size)>0,'First canvas retains its pixels after switching tabs');
  await page.locator('#documentTabs [role="tab"]').first().click();
  await page.locator('.app:not(.studio-large-active)').waitFor();
  assert.ok(await page.locator('#artCanvas').isVisible(),'Normal drawing canvas must be restored');
  await page.reload();
  await page.locator('#projectHome[open]').waitFor();
  assert.equal(await page.locator('#checkerLightColor').inputValue(),'#aabbcc');
  assert.equal(await page.locator('#checkerDarkColor').inputValue(),'#334455');

  await page.screenshot({path:path.join(root,'tests','studio-v2-homologation.png'),fullPage:true});
  // Basic mobile smoke: same integrated large workspace, no second application/dialog.
  const mobile=await context.newPage();
  await mobile.setViewportSize({width:390,height:844});
  mobile.on('pageerror',e=>errors.push('mobile: '+e.message));
  await mobile.goto('http://127.0.0.1:'+address.port+'/');
  await mobile.locator('#projectHome[open]').waitFor({timeout:12000});
  await mobile.locator('#projectHomeClose').click();
  await mobile.locator('#largeCanvasBtn').click();
  await mobile.locator('.app.studio-large-active').waitFor();
  assert.ok(await mobile.locator('#largeDrawCanvas').isVisible(),'Big Canvas remains integrated on mobile');
  assert.ok(await mobile.locator('.tools .tool-group').isVisible(),'Same tools remain available on mobile');
  assert.ok(await mobile.locator('#toolPropertiesPanel').isVisible(),'Same properties panel remains available on mobile');
  await mobile.screenshot({path:path.join(root,'tests','studio-big-canvas-mobile.png'),fullPage:true});
  await mobile.close();

  // Layout homologation: no primary regions may paint over one another.
  for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[800,600],[390,844]]){
   const tab=await context.newPage();
   tab.on('pageerror',e=>errors.push('layout '+width+': '+e.message));
   await tab.setViewportSize({width,height});
   await tab.goto('http://127.0.0.1:'+address.port+'/');
   await tab.locator('#projectHome[open]').waitFor({timeout:12000});
   await tab.locator('#projectHomeClose').click();
   const check=await tab.evaluate(()=>{
    const rect=sel=>{const el=document.querySelector(sel);if(!el)return null;
     const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return null;
     const r=el.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
    };
    const overlap=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>3;
    const header=rect('.topbar'),tabs=rect('.document-tabs'),workspace=rect('.workspace'),editor=rect('.editor'),
          toolbar=rect('.canvas-header'),viewport=rect('#canvasViewport'),timeline=rect('.timeline');
    return {pageWidth:document.documentElement.scrollWidth,windowWidth:innerWidth,
      headerTabs:overlap(header,tabs),tabsWorkspace:overlap(tabs,workspace),
      toolbarViewport:overlap(toolbar,viewport),viewportTimeline:overlap(viewport,timeline),
      editorWidth:editor?.width||0,viewportHeight:viewport?.height||0};
   });
   assert.ok(check.pageWidth<=check.windowWidth+2,'Horizontal overflow at '+width+': '+JSON.stringify(check));
   for(const key of ['headerTabs','tabsWorkspace','toolbarViewport','viewportTimeline'])
    assert.equal(check[key],false,'Layout collision '+key+' at '+width+': '+JSON.stringify(check));
   assert.ok(check.editorWidth>200&&check.viewportHeight>40,'Unusable editor at '+width+': '+JSON.stringify(check));
   await tab.locator('#largeCanvasBtn').click();
   await tab.locator('.app.studio-large-active').waitFor();
   const bigCheck=await tab.evaluate(()=>{
    const stage=document.querySelector('#canvasViewport>.large-stage')?.getBoundingClientRect(),
          main=document.querySelector('#canvasViewport')?.getBoundingClientRect(),
          selection=document.querySelector('.editor>.selection-bar')?.getBoundingClientRect(),
          footer=document.querySelector('.editor>.canvas-footer')?.getBoundingClientRect(),
          timeline=document.querySelector('.editor>.timeline')?.getBoundingClientRect();
    const overlap=(a,b)=>!!(a&&b&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>3);
    return {stage:stage?.height,viewport:main?.height,
      stageInsideViewport:!!(stage&&main&&stage.top>=main.top-2&&stage.bottom<=main.bottom+2),
      selectionVisible:!!(selection&&selection.height>15),
      footerVisible:!!(footer&&footer.height>15),
      timelineVisible:!!(timeline&&timeline.height>35),
      overlap:overlap(main,timeline)||overlap(footer,timeline)||overlap(selection,timeline),
      pageWidth:document.documentElement.scrollWidth,windowWidth:innerWidth};
   });
   assert.ok(bigCheck.stage>40,'10k stage has no usable height at '+width+': '+JSON.stringify(bigCheck));
   assert.ok(bigCheck.stageInsideViewport&&bigCheck.selectionVisible&&bigCheck.footerVisible&&bigCheck.timelineVisible,'10k lost native editor controls at '+width+': '+JSON.stringify(bigCheck));
   assert.equal(bigCheck.overlap,false,'10k canvas covers timeline at '+width);
   assert.ok(bigCheck.pageWidth<=bigCheck.windowWidth+2,'10k horizontal overflow at '+width+': '+JSON.stringify(bigCheck));
   await tab.close();
  }
  assert.deepEqual(errors,[],'No unexpected browser console/page errors');
  await context.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});


test('500×500 document retains the SAME editor viewport, selection controls and timeline', {timeout:90000},async()=>{
 const server=await serve();let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('#projectHome[open]').waitFor();
  await page.locator('#projectHomeClose').click();
  await page.locator('#newDocumentTab').click();
  await page.locator('#blankProjectDialog[open]').waitFor();
  await page.locator('#blankProjectName').fill('Teste 500');
  await page.locator('#blankProjectWidth').fill('500');
  await page.locator('#blankProjectHeight').fill('500');
  await page.locator('#confirmBlankProject').click();
  await page.locator('.app.studio-large-active').waitFor();
  const layout=await page.evaluate(()=>{
   const visible=id=>{const e=document.getElementById(id);if(!e)return false;const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).display!=='none';};
   const view=document.getElementById('canvasViewport').getBoundingClientRect();
   const stage=document.querySelector('#canvasViewport>.large-stage')?.getBoundingClientRect();
   return {width:window.PixelBigCanvas.getProject()?.width,height:window.PixelBigCanvas.getProject()?.height,
    sameViewport:!!stage&&stage.top>=view.top-2&&stage.bottom<=view.bottom+2,
    visible:Object.fromEntries(['canvasViewport','largeDrawCanvas','selectionStatus','copySelection','pasteSelection','cursorInfo','sizeInfo','frameStrip','layerList'].map(id=>[id,visible(id)])),
    timeline:document.querySelector('.timeline').getBoundingClientRect().height,
    frameButtons:document.querySelectorAll('#frameStrip .frame-card').length};
  });
  assert.equal(layout.width,500);assert.equal(layout.height,500);
  assert.ok(layout.sameViewport,'500px project must use the normal canvas viewport: '+JSON.stringify(layout));
  for(const [id,on] of Object.entries(layout.visible))assert.ok(on,id+' hidden in 500px document: '+JSON.stringify(layout));
  assert.ok(layout.timeline>65&&layout.frameButtons===1,'Static timeline missing: '+JSON.stringify(layout));
  await page.locator('#documentTabs [role="tab"]').first().click();
  await page.locator('.app:not(.studio-large-active)').waitFor();
  assert.ok(await page.locator('#artCanvas').isVisible(),'Small document was not restored');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
