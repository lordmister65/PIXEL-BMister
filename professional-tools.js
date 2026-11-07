/* PIXEL-BMister v1.8 — reusable pure pixel editing helpers. No dependencies. */
(function(root){
'use strict';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const idx=(x,y,w)=>(y*w+x)*4;
function brushPoints(x,y,size=1,shape='square'){
 const n=clamp(Math.floor(size)||1,1,64),radius=(n-1)/2,pts=[];
 for(let yy=0;yy<n;yy++)for(let xx=0;xx<n;xx++){
  const dx=xx-radius,dy=yy-radius;
  const keep=shape==='circle'?dx*dx+dy*dy<=(radius+.35)**2:shape==='diamond'?Math.abs(dx)+Math.abs(dy)<=radius+.35:true;
  if(keep)pts.push({x:x+xx-Math.floor(radius),y:y+yy-Math.floor(radius)});
 }
 if(!pts.length)pts.push({x,y});
 return pts;
}
function sameColor(a,b,tolerance=0){
 const threshold=clamp(Number(tolerance)||0,0,100)*255/100;
 return Math.max(...a.map((v,i)=>Math.abs(v-b[i])))<=threshold;
}
function colorMask(pixels,w,h,x,y,tolerance=0,global=false){
 const mask=new Uint8Array(w*h);
 if(!pixels||x<0||x>=w||y<0||y>=h)return mask;
 const at=(px,py)=>{const j=idx(px,py,w);return [pixels[j],pixels[j+1],pixels[j+2],pixels[j+3]];};
 const source=at(x,y);
 if(global){for(let j=0;j<w*h;j++){const i=j*4;if(sameColor([pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]],source,tolerance))mask[j]=1;}return mask;}
 const queue=[y*w+x];let start=0;
 while(start<queue.length){
  const pos=queue[start++];if(mask[pos])continue;
  const xx=pos%w,yy=Math.floor(pos/w);
  if(!sameColor(at(xx,yy),source,tolerance))continue;
  mask[pos]=1;
  if(xx>0&&!mask[pos-1])queue.push(pos-1);
  if(xx<w-1&&!mask[pos+1])queue.push(pos+1);
  if(yy>0&&!mask[pos-w])queue.push(pos-w);
  if(yy<h-1&&!mask[pos+w])queue.push(pos+w);
 }
 return mask;
}
function polygonMask(points,w,h){
 const mask=new Uint8Array(w*h);
 if(!Array.isArray(points)||points.length<3)return mask;
 // Even-odd fill through pixel centers. Boundary-inclusive using distance to segments.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j],cross=(a.y>y)!==(b.y>y);
   if(cross&&(x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  if(inside)mask[y*w+x]=1;
 }
 for(let i=0;i<points.length;i++){
  let a=points[i],b=points[(i+1)%points.length];
  let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx-dy;
  for(;;){if(x>=0&&y>=0&&x<w&&y<h)mask[y*w+x]=1;if(x===b.x&&y===b.y)break;const e=2*err;if(e>-dy){err-=dy;x+=sx;}if(e<dx){err+=dx;y+=sy;}}
 }
 return mask;
}
function maskBounds(mask,w,h){
 let minX=w,minY=h,maxX=-1,maxY=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 return maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
}
function pixelPerfectPath(points){
 if(!Array.isArray(points)||points.length<3)return(points||[]).slice();
 const out=[];
 for(const p of points){
  if(out.length&&out[out.length-1].x===p.x&&out[out.length-1].y===p.y)continue;
  out.push({x:p.x,y:p.y});
  const n=out.length;if(n<3)continue;
  const a=out[n-3],b=out[n-2],c=out[n-1];
  // Three pixels making an L: remove middle to avoid staircase clumps.
  if(Math.abs(a.x-c.x)===1&&Math.abs(a.y-c.y)===1&&Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1&&Math.abs(c.x-b.x)+Math.abs(c.y-b.y)===1)out.splice(n-2,1);
 }
 return out;
}
root.PixelProfessionalTools={brushPoints,sameColor,colorMask,polygonMask,maskBounds,pixelPerfectPath};
})(window);