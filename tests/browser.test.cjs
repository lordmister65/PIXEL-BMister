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
  assert.equal(await page.title(),'PIXEL-BMister — Editor de Pixel Art');

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
      editorHost:stage.parentElement.classList.contains('editor'),
      modalOpen:document.getElementById('largeCanvasDialog').open};
  });
  assert.deepEqual(dimensions,{w:10000,h:10000,layers:1,tiles:0,editorHost:true,modalOpen:false});
  assert.ok(await page.locator('#checkerLightColor').isVisible(),'Checkerboard pickers must remain available in the integrated 10k mode');
  assert.ok(await page.locator('#toolPropertiesPanel').isVisible(),'Original properties inspector must remain visible');
  assert.ok(await page.locator('.tools .tool-group').isVisible(),'Original tools must remain visible');
  assert.ok(!await page.locator('.large-settings').isVisible(),'Duplicate properties panel must be hidden');
  assert.ok(!await page.locator('.large-toolbar').isVisible(),'Duplicate tool rail must be hidden');
  assert.equal(await page.locator('#documentTabs [role="tab"]').count(),2,'Classic and 10k projects must have separate tabs');
  const largeCanvas=page.locator('#largeDrawCanvas'),largeRect=await largeCanvas.boundingBox();
  assert.ok(largeRect&&largeRect.width>250&&largeRect.height>100,'Large drawing canvas must be visible inside Studio');
  await page.mouse.click(largeRect.x+largeRect.width/2,largeRect.y+largeRect.height/2);
  assert.ok(await page.evaluate(()=>window.PixelBigCanvas.getProject().layers[0].tiles.size)>0,'Painting should allocate only necessary tiles');
  await page.screenshot({path:path.join(root,'tests','studio-big-canvas.png'),fullPage:true});
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
  assert.deepEqual(errors,[],'No unexpected browser console/page errors');
  await context.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
