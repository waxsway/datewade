'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {preset,obstacles,pickups,flags,checkpoints,hazards} from '../lib/party.js';

const themeMap={
 NEON:['#151a33','#d5ff4b','#73caff'],
 SKYLINE:['#162b35','#ffb86c','#52e7ff'],
 CANDY:['#34223e','#ff7fbb','#bb9cff'],
 VOLCANIC:['#322126','#ff975c','#ff526d'],
 COSMIC:['#192041','#bca2ff','#63dcff']
};
const mat=(color,emissive=color,glow=.16)=>new THREE.MeshStandardMaterial({
 color,roughness:.48,metalness:.13,emissive,emissiveIntensity:glow});
const cube=(parent,w,h,d,m,x=0,y=0,z=0)=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);
 mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
};
const ball=(parent,r,m,x=0,y=0,z=0)=>{
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);
 mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
};
const column=(parent,r,h,m,x=0,y=0,z=0)=>{
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),m);
 mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
};
const ring=(parent,r,m,y=.12)=>{
 const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,.085,8,100),m);
 mesh.rotation.x=Math.PI/2;mesh.position.y=y;parent.add(mesh);return mesh;
};
function nameplate(name,color){
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=96;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#101224de';ctx.fillRect(12,13,360,66);
 ctx.strokeStyle=color;ctx.lineWidth=5;ctx.strokeRect(12,13,360,66);
 ctx.font='bold 34px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';
 ctx.fillText(name.slice(0,14).toUpperCase(),192,46,330);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
 sprite.scale.set(2.9,.72,1);sprite.position.y=3.0;sprite.renderOrder=10;
 return sprite;
}
function character(p){
 const group=new THREE.Group();
 const body=mat(p.color,p.color,.24),dark=mat('#25213a','#110f21',.2),ivory=mat('#fef4e9','#ffffff',.1);
 const visor=mat('#172237','#65e6fb',.55);
 const shoes=mat('#171c2c','#171c2c',.1);
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.72,32),new THREE.MeshBasicMaterial({color:'#090b14',transparent:true,opacity:.4,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=.08;group.add(shadow);
 const legs=[cube(group,.48,.67,.5,shoes,-.35,.43,0),cube(group,.48,.67,.5,shoes,.35,.43,0)];
 const torso=column(group,.72,1.12,body,0,1.27,0);
 const belt=column(group,.75,.17,dark,0,.86,0);
 const arms=[ball(group,.29,body,-.89,1.45,0),ball(group,.29,body,.89,1.45,0)];
 const head=ball(group,.72,ivory,0,2.16,0);
 const hair=column(group,.72,.28,dark,0,2.74,0);
 const eyes=ball(group,.23,visor,0,2.25,-.62);eyes.scale.set(2.5,.78,.4);
 cube(group,.32,.19,.2,dark,0,1.94,-.67);
 const backpack=cube(group,.87,.78,.27,dark,0,1.28,.77);
 const label=nameplate(p.name,p.color);group.add(label);
 const bombRing=new THREE.Group();ring(bombRing,1.08,mat('#ff78a2','#ff3a76',2),.22);group.add(bombRing);
 return {group,legs,arms,bombRing,label,torso};
}
export default function Arena3D({game,meId}){
 const mount=useRef(null),current=useRef(game),playerId=useRef(meId),[error,setError]=useState('');
 current.current=game;playerId.current=meId;
 useEffect(()=>{
  if(!mount.current)return;
  const root=mount.current;
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){
   setError('3D needs WebGL 2. Try an updated Chrome, Safari, or Edge browser.');return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.42;
  root.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','3D party game arena viewed from behind your character');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#11182d');
  scene.fog=new THREE.Fog('#11182d',27,65);
  const camera=new THREE.PerspectiveCamera(58,1,.1,110);
  camera.position.set(0,10,16);camera.lookAt(0,1,0);
  const ambient=new THREE.HemisphereLight('#c6f4ff','#35304b',2.0);scene.add(ambient);
  const sun=new THREE.DirectionalLight('#fffcf4',3.3);
  sun.position.set(-9,16,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;
  scene.add(sun);
  const spot1=new THREE.PointLight('#ff6da0',90,19,2);spot1.position.set(-10,6,-10);scene.add(spot1);
  const spot2=new THREE.PointLight('#5bd6ff',80,17,2);spot2.position.set(11,6,11);scene.add(spot2);
  const arena=new THREE.Group();scene.add(arena);
  const characterLayer=new THREE.Group();scene.add(characterLayer);
  const pool=new Map();
  let stage=-1,objects={hazards:[],coins:[],flags:[],gates:[],tiles:[]},raf=0,disposed=false;
  let last=performance.now(),view={x:0,z:0};
  const sized=()=>{const w=Math.max(1,root.clientWidth),h=Math.max(1,root.clientHeight);
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  const resize=new ResizeObserver(sized);resize.observe(root);sized();
  function cleanupLayer(layer){
   while(layer.children.length){
    const item=layer.children[0];layer.remove(item);
    item.traverse(child=>{
     if(child.geometry)child.geometry.dispose();
     if(child.material){const materials=Array.isArray(child.material)?child.material:[child.material];
      materials.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}
    });
   }
  }
  function buildArena(challenge){
   cleanupLayer(arena);stage=challenge;
   const p=preset(challenge),[bg,primary,secondary]=themeMap[p.theme];
   scene.background=new THREE.Color(bg);scene.fog.color.set(bg);
   const flooring=mat(bg,bg,.07),edge=mat(primary,primary,1.9),trim=mat(secondary,secondary,1.5);
   const wall=mat('#202638','#0c1223',.13),tile=mat('#20243a','#080b16',.17);
   const ground=cube(arena,25,.8,25,flooring,0,-.5,0);ground.receiveShadow=true;
   for(let i=-12;i<=12;i+=2){
    cube(arena,24.7,.014,.038,tile,0,-.085,i);
    cube(arena,.038,.014,24.7,tile,i,-.085,0);
   }
   for(const sign of [-1,1]){
    cube(arena,26,1.55,.65,wall,0,.68,sign*12.7);
    cube(arena,.65,1.55,26,wall,sign*12.7,.68,0);
    cube(arena,26,.11,.15,edge,0,1.5,sign*12.75);
    cube(arena,.15,.11,26,trim,sign*12.75,1.5,0);
   }
   for(const x of [-12.55,12.55])for(const z of [-12.55,12.55]){
    column(arena,.46,5.6,wall,x,2.7,z);
    ball(arena,.62,edge,x,5.65,z);
   }
   for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2;
    const r=18.4;
    const post=column(arena,.47,1.7,mat(i%2?primary:secondary,i%2?primary:secondary,.25),Math.sin(a)*r,.9,Math.cos(a)*r);
    post.castShadow=false;
   }
   for(const o of obstacles(challenge)){
    cube(arena,o.half*2,o.h,o.half*2,wall,o.x,o.h/2,o.z);
    cube(arena,o.half*2+.12,.14,o.half*2+.12,iChoose(o.x+o.z)?trim:edge,o.x,o.h+.05,o.z);
   }
   objects={hazards:[],coins:[],flags:[],gates:[],tiles:[]};
   if(p.mode===2){const m=mat(primary,primary,1.6);ring(arena,3.42,m,.08);ring(arena,3.03,trim,.08);}
   if(p.mode===1){
    for(let i=0;i<9;i++){
     const g=new THREE.Group();const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.52),mat('#ffe58c','#ffbd49',1.2));
     g.add(gem);arena.add(g);objects.coins.push(g);
    }
   }
   if(p.mode===9){
    for(const point of flags(challenge)){
     const group=new THREE.Group();column(group,.15,3.6,trim,0,1.7,0);
     const banner=cube(group,1.3,.85,.11,edge,.67,3.12,0);
     banner.castShadow=false;group.position.set(point.x,0,point.z);arena.add(group);objects.flags.push(group);
    }
   }
   if(p.mode===8){
    for(const point of checkpoints(challenge)){
     const group=new THREE.Group();
     const m=mat(primary,primary,2.2);
     const goal=new THREE.Mesh(new THREE.TorusGeometry(1.3,.2,12,36),m);
     goal.position.set(0,1.7,0);group.add(goal);group.position.set(point.x,0,point.z);
     arena.add(group);objects.gates.push(group);
    }
   }
   if([3,4,5,11].includes(p.mode)){
    const n=p.mode===11?25:p.mode===3?6:1;
    for(let i=0;i<n;i++){
     const mesh=p.mode===4?cube(arena,1.3,2.2,25,mat('#ff5986','#ff184b',2.1),0,1,0):
      p.mode===11?cube(arena,4.17,.035,4.17,mat('#ff6a63','#ff231d',2.1),0,.09,0):
      new THREE.Mesh(new THREE.CylinderGeometry(1,1,.085,48),new THREE.MeshStandardMaterial({color:'#ff5772',transparent:true,opacity:.65,emissive:'#ff183c',emissiveIntensity:1.2}));
     if(p.mode!==4&&p.mode!==11){mesh.position.y=.13;arena.add(mesh);}
     objects.hazards.push(mesh);
    }
   }
   const decoration=ring(arena,11.7,mat(secondary,secondary,1.1),.03);
   decoration.name='boundary';
  }
  function iChoose(n){return Math.floor(Math.abs(n)*17)%2;}
  function syncCharacters(players){
   const seen=new Set();
   for(const p of players){
    seen.add(p.id);
    if(!pool.has(p.id)){const entry=character(p);characterLayer.add(entry.group);pool.set(p.id,entry);}
    const entry=pool.get(p.id);
    entry.group.visible=p.alive;
    entry.group.position.x=THREE.MathUtils.lerp(entry.group.position.x,p.x,.26);
    entry.group.position.z=THREE.MathUtils.lerp(entry.group.position.z,p.z,.26);
    const angular=p.yaw||0,dir=(angular-entry.group.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;
    entry.group.rotation.y+=dir*.21;
    entry.bombRing.visible=p.id===current.current?.bomb&&preset(current.current?.challenge||0).mode===0&&current.current?.phase==='playing';
    if(entry.bombRing.visible)entry.bombRing.scale.setScalar(1+Math.sin(performance.now()*.012)*.08);
    entry.torso.material.emissiveIntensity=p.flash>.05?1.75:.24;
    const wobble=Math.sin(performance.now()*.012+p.id.length)*.08;
    entry.legs[0].rotation.x=wobble;entry.legs[1].rotation.x=-wobble;
    entry.arms[0].rotation.x=-wobble;entry.arms[1].rotation.x=wobble;
   }
   for(const [id,obj] of pool)if(!seen.has(id)){characterLayer.remove(obj.group);
    obj.group.traverse(node=>{node.geometry?.dispose();if(node.material){node.material.map?.dispose();node.material.dispose();}});
    pool.delete(id);}
  }
  const animate=(now)=>{
   if(disposed)return;
   raf=requestAnimationFrame(animate);
   const g=current.current;
   if(g){
    if(g.challenge!==stage)buildArena(g.challenge);
    syncCharacters(g.players||[]);
    const elapsed=g.elapsed||0,mode=preset(g.challenge||0).mode;
    if(mode===1){
     const coins=pickups(g.challenge,elapsed),taken=new Set(g.taken||[]);
     objects.coins.forEach((mesh,i)=>{
      mesh.visible=!!coins[i]&&!taken.has(coins[i].id);
      if(coins[i]){mesh.position.set(coins[i].x,1.3+Math.sin(now*.003+i)*.22,coins[i].z);mesh.rotation.y=now*.002;}
     });
    }
    if(mode===8)objects.gates.forEach((mesh,i)=>{
     const target=g.players?.find(x=>x.id===playerId.current)?.target||0;
     mesh.visible=i===target%6;mesh.rotation.y=Math.sin(now*.002)*.16;
    });
    if([3,4,5,11].includes(mode)){
     const hs=hazards(g.challenge,elapsed);
     objects.hazards.forEach((obj,i)=>{
      const hazard=hs[i];obj.visible=!!hazard&&g.phase==='playing';
      if(!hazard)return;
      if(hazard.type==='circle'){obj.position.set(hazard.x,.14,hazard.z);obj.scale.set(hazard.r,1,hazard.r);}
      else if(hazard.type==='laser'){obj.position.x=hazard.x;obj.scale.x=hazard.r/1.3*2;}
      else if(hazard.type==='island'){obj.position.y=.13;obj.scale.set(hazard.r,1,hazard.r);obj.material.opacity=.24;}
      else if(hazard.type==='tile'){obj.position.set(hazard.x,.085,hazard.z);obj.visible=hazard.active;}
     });
    }
    const me=(g.players||[]).find(x=>x.id===playerId.current)||(g.players||[])[0];
    if(me){
     view.x=THREE.MathUtils.lerp(view.x,me.x,.07);
     view.z=THREE.MathUtils.lerp(view.z,me.z,.07);
     const ideal=new THREE.Vector3(view.x+0,9.0,view.z+13.2);
     camera.position.lerp(ideal,.055);
     camera.lookAt(view.x,1.1,view.z-2);
    }
   }
   renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(animate);
  return ()=>{
   disposed=true;cancelAnimationFrame(raf);resize.disconnect();
   cleanupLayer(characterLayer);cleanupLayer(arena);
   renderer.dispose();renderer.domElement.remove();
  };
 },[]);
 return <div ref={mount} className="webgl-window">
  {error&&<div className="webgl-error">{error}</div>}
  <div className="world-label">THIRD-PERSON PARTY ARENA <span>● LIVE 3D</span></div>
 </div>;
}
