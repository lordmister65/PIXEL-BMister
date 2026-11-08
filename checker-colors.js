/* PIXEL-BMister — user-customizable transparency checker colors.
   Shared by normal Studio and the integrated 10k tile canvas. */
'use strict';
(function(root){
 const $=id=>document.getElementById(id);
 const KEY='pixel-bmister-checker-colors-v1';
 const defaults={light:'#39393f',dark:'#2b2b30'};
 const valid=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
 let colors={...defaults};
 try{const saved=JSON.parse(root.localStorage.getItem(KEY)||'null');if(saved&&valid(saved.light)&&valid(saved.dark))colors={light:saved.light,dark:saved.dark};}catch(_e){}
 const get=()=>({...colors});
 const update=(next,save=true)=>{
  if(!valid(next.light)||!valid(next.dark))return;
  colors={light:next.light,dark:next.dark};
  const style=document.documentElement.style;
  style.setProperty('--checker-light',colors.light);
  style.setProperty('--checker-dark',colors.dark);
  if($('checkerLightColor'))$('checkerLightColor').value=colors.light;
  if($('checkerDarkColor'))$('checkerDarkColor').value=colors.dark;
  if(save){try{root.localStorage.setItem(KEY,JSON.stringify(colors));}catch(_e){}}
  root.dispatchEvent(new CustomEvent('pixel-checker-changed',{detail:get()}));
 };
 $('checkerLightColor')?.addEventListener('input',e=>update({...colors,light:e.target.value}));
 $('checkerDarkColor')?.addEventListener('input',e=>update({...colors,dark:e.target.value}));
 $('checkerReset')?.addEventListener('click',()=>update(defaults));
 root.PixelCheckerSettings={get,set:update};
 update(colors,false);
})(window);
