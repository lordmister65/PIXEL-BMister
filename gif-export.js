/* PIXEL-BMister GIF89a encoder. No dependencies; palette 3/3/2 RGB. */
(function(global){
"use strict";
function gifBytes(frames,width,height,fps,loop){
if(!Array.isArray(frames)||!frames.length||width<1||height<1)throw Error('Frames inválidos');
const bytes=[];const push=(...n)=>bytes.push(...n.map(v=>v&255));const word=n=>push(n&255,(n>>>8)&255);
const ascii=s=>{for(let i=0;i<s.length;i++)push(s.charCodeAt(i));};
ascii('GIF89a');word(width);word(height);push(0xf7,0,0);
for(let i=0;i<256;i++){const v=i===0?0:i===255?255:i-1;push(Math.round(((v>>5)&7)*255/7),Math.round(((v>>2)&7)*255/7),Math.round((v&3)*255/3));}
if(loop){push(0x21,0xff,11);ascii('NETSCAPE2.0');push(3,1,0,0,0);}
const delay=Math.max(2,Math.round(100/Math.max(1,Math.min(24,fps||8))));
function indexed(rgba){if(!rgba||rgba.length!==width*height*4)throw Error('Dimensões inválidas');const idx=new Uint8Array(width*height);for(let i=0;i<idx.length;i++){const o=i*4;if(rgba[o+3]<128){idx[i]=0;continue;}const red=rgba[o]>>5,green=rgba[o+1]>>5,blue=rgba[o+2]>>6;idx[i]=1+Math.min(254,(red<<5)|(green<<2)|blue);}return idx;}
function compress(indices){const minCodeSize=8,clear=256,end=257,maxCode=4096;let next=258,codeSize=9,dict=new Map(),bitBucket=0,bitCount=0,out=[];const emit=(code)=>{bitBucket|=code<<bitCount;bitCount+=codeSize;while(bitCount>=8){out.push(bitBucket&255);bitBucket>>>=8;bitCount-=8;}};const reset=()=>{dict=new Map();next=258;codeSize=9;};emit(clear);reset();let prefix=indices[0];for(let i=1;i<indices.length;i++){const k=indices[i],key=prefix*256+k;if(dict.has(key)){prefix=dict.get(key);continue;}emit(prefix);if(next<maxCode){dict.set(key,next++);if(next>(1<<codeSize)&&codeSize<12)codeSize++;}else{emit(clear);reset();}prefix=k;}emit(prefix);emit(end);if(bitCount)out.push(bitBucket&255);return out;}
for(const frame of frames){const idx=indexed(frame);push(0x21,0xf9,4,0x09);word(delay);push(0,0);push(0x2c);word(0);word(0);word(width);word(height);push(0);push(8);let compressed=compress(idx);for(let i=0;i<compressed.length;i+=255){const block=compressed.slice(i,i+255);push(block.length);bytes.push(...block);}push(0);}
push(0x3b);return new Blob([new Uint8Array(bytes)],{type:'image/gif'});
}
global.PixelForgeGif={encode:gifBytes};
})(window);