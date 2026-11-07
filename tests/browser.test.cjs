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
  await page.locator('#projectHome:not([open])').waitFor();
  assert.equal(await page.locator('#artCanvas').evaluate(el=>el.width),16);
  await page.locator('[data-tool="pencil"]').click();
  await page.locator('#colorInput').evaluate(el=>{el.value='#00ff00';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await drawAt(page,2,2);
  assert.ok((await alphaAt(page,2,2))>0,'Pencil must draw to canvas');
  await page.locator('#undoBtn').click();
  assert.equal(await alphaAt(page,2,2),0,'Undo must revert the stroke');
  await page.locator('#redoBtn').click();
  assert.ok((await alphaAt(page,2,2))>0,'Redo must restore the stroke');

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
  await page.locator('#projectHome:not([open])').waitFor();
  assert.equal(await page.locator('#artCanvas').evaluate(el=>el.width),16);
  assert.ok((await alphaAt(page,2,2))>0,'Stored project must recover drawn pixels');

  // Build an animation and verify the Game Lab opens on the real project data.
  await page.locator('#homeBtn').click();
  await page.locator('#projectHome[open]').waitFor();
  await page.locator('[data-template="animation32"]').click();
  await page.locator('#projectHome:not([open])').waitFor();
  assert.equal(await page.locator('#artCanvas').evaluate(el=>el.width),32);
  assert.equal(await page.locator('.frame-card').count(),8);
  await page.locator('#gameModeBtn').click();
  await page.locator('#gameModeDialog[open]').waitFor();
  assert.ok(await page.locator('#gameScene').evaluate(el=>el.width===640));
  await page.keyboard.press('d');
  await page.waitForTimeout(100);
  await page.locator('#gameClose').click();
  await page.locator('#gameModeDialog:not([open])').waitFor();

  await page.screenshot({path:path.join(root,'tests','studio-v2-homologation.png'),fullPage:true});
  assert.deepEqual(errors,[],'No unexpected browser console/page errors');
  await context.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
