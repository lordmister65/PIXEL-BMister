/* PIXEL-BMister Game Lab 1.6 — deterministic platformer physics and level definitions. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const levels={
 studio:{name:'Estúdio',width:1800,height:360,spawn:{x:90,y:300},platforms:[{x:0,y:300,w:1800,h:60},{x:230,y:244,w:125,h:16},{x:430,y:195,w:140,h:16},{x:665,y:252,w:170,h:16},{x:910,y:200,w:150,h:16},{x:1170,y:155,w:140,h:16},{x:1460,y:235,w:170,h:16}]},
 forest:{name:'Floresta',width:2100,height:360,spawn:{x:90,y:300},platforms:[{x:0,y:300,w:400,h:60},{x:485,y:300,w:470,h:60},{x:1035,y:300,w:470,h:60},{x:1590,y:300,w:510,h:60},{x:185,y:238,w:130,h:16},{x:535,y:224,w:165,h:16},{x:780,y:182,w:130,h:16},{x:1110,y:220,w:170,h:16},{x:1400,y:175,w:130,h:16},{x:1690,y:225,w:140,h:16}]},
 night:{name:'Noturno',width:2400,height:360,spawn:{x:90,y:300},platforms:[{x:0,y:300,w:325,h:60},{x:395,y:300,w:390,h:60},{x:865,y:300,w:450,h:60},{x:1395,y:300,w:480,h:60},{x:1950,y:300,w:450,h:60},{x:170,y:224,w:130,h:16},{x:470,y:207,w:120,h:16},{x:700,y:163,w:125,h:16},{x:1040,y:215,w:145,h:16},{x:1350,y:160,w:120,h:16},{x:1640,y:210,w:120,h:16},{x:1920,y:168,w:145,h:16}]}
};
function createPlayer(x,y){return{x,y,vx:0,vy:0,halfWidth:12,height:34,grounded:false,facing:1};}
function overlaps(a,b){return a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;}
function tick(player,level,input,dt,settings={}){
 const step=clamp(Number(dt)||0,0,0.05),speed=clamp(Number(settings.speed)||150,30,400),gravity=clamp(Number(settings.gravity)||1050,100,2400),jump=clamp(Number(settings.jump)||390,100,1000),direction=Number(!!input.right)-Number(!!input.left),foot=player.y;
 player.vx=direction*speed;if(direction)player.facing=direction;
 let dx=player.vx*step,previousX=player.x;
 player.x=clamp(player.x+dx,player.halfWidth,level.width-player.halfWidth);
 for(const platform of level.platforms){
  if(overlaps({x:player.x-player.halfWidth,y:player.y-player.height,w:player.halfWidth*2,h:player.height},platform)){
   const previousRight=previousX+player.halfWidth,previousLeft=previousX-player.halfWidth;
   if(dx>0&&previousRight<=platform.x+1)player.x=platform.x-player.halfWidth;
   else if(dx<0&&previousLeft>=platform.x+platform.w-1)player.x=platform.x+platform.w+player.halfWidth;
  }
 }
 if(input.jump&&player.grounded){player.vy=-jump;player.grounded=false;}
 const previousY=player.y;
 player.vy+=gravity*step;player.y+=player.vy*step;
 player.grounded=false;
 for(const platform of level.platforms){
  const hor=player.x+player.halfWidth>platform.x&&player.x-player.halfWidth<platform.x+platform.w;
  if(!hor)continue;
  // Falling onto a platform from above.
  if(player.vy>=0&&previousY<=platform.y+0.1&&player.y>=platform.y){
   player.y=platform.y;player.vy=0;player.grounded=true;
  }else if(player.vy<0&&previousY-player.height>=platform.y+platform.h-0.1&&player.y-player.height<=platform.y+platform.h){
   player.y=platform.y+platform.h+player.height;player.vy=0;
  }
 }
 if(player.y>level.height+120){player.x=level.spawn.x;player.y=level.spawn.y;player.vy=0;player.grounded=false;return {respawned:true};}
 return {respawned:false,foot};
}
function cameraX(player,level,viewportWidth){return clamp(player.x-viewportWidth*.45,0,Math.max(0,level.width-viewportWidth));}
root.PixelGamePhysics={levels,createPlayer,tick,cameraX,overlaps};
})(window);
