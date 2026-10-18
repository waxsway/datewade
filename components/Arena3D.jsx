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
 const suit=mat(p.color,p.color,.18);
 const suitShade=mat(new THREE.Color(p.color).multiplyScalar(.72),'#101524',.08);
 const trim=mat('#31374f','#121927',.1);
 const shell=mat('#e4e8f1','#acb7cf',.12);
 const glass=mat('#20354b','#2ac7e9',.46);
 const glassReflect=mat('#b2eeff','#73dfff',.8);
 const rubber=mat('#151b2b','#121522',.06);
 const buckle=mat('#ffc55f','#ffc55f',.32);
 const white=mat('#f7fcff','#dceeff',.18);
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.92,32),
   new THREE.MeshBasicMaterial({color:'#050715',transparent:true,opacity:.32,depthWrite:false}));
 shadow.rotation.x=-Math.PI/2;shadow.position.y=.07;
 const part=(parent,geo,material,x,y,z,scale,cast=false)=>{
   const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);
   if(scale)m.scale.set(...scale);m.castShadow=cast;parent.add(m);return m;
 };
 const box=(parent,x,y,z,w,h,d,m)=>part(parent,new THREE.BoxGeometry(w,h,d),m,x,y,z,null,false);
 const sphere=(parent,x,y,z,r,m,scale)=>part(parent,new THREE.SphereGeometry(r,14,10),m,x,y,z,scale,true);
 const cylinder=(parent,x,y,z,rTop,rBot,h,m)=>part(parent,new THREE.CylinderGeometry(rTop,rBot,h,12),m,x,y,z,null,false);
 // Chunky boots and separately animated legs.
 const legs=[];
 for(const side of [-1,1]){
   const pivot=new THREE.Group();pivot.position.set(side*.38,.82,0);group.add(pivot);legs.push(pivot);
   cylinder(pivot,0,-.31,0,.24,.27,.63,suitShade);
   box(pivot,0,-.68,-.14,.64,.31,.83,rubber);
   box(pivot,0,-.58,-.49,.47,.10,.10,trim);
   box(pivot,0,-.08,-.30,.41,.20,.11,shell);
 }
 const torsoMesh=part(group,new THREE.CylinderGeometry(.62,.72,1.24,12),suit,0,1.39,0,null,true);
 part(group,new THREE.SphereGeometry(.68,14,10),suit,0,1.88,0,[1,.42,.85],false);
 cylinder(group,0,.86,0,.69,.65,.18,trim);
 box(group,0,1.50,-.62,.84,.54,.18,trim);
 box(group,0,1.53,-.74,.62,.34,.10,glass);
 box(group,0,1.53,-.81,.27,.10,.055,glassReflect);
 for(const side of [-1,1])box(group,side*.29,1.48,-.77,.11,.39,.06,buckle);
 // Articulated sleeves and gloves with colored shoulder caps.
 const arms=[];
 for(const side of [-1,1]){
   const pivot=new THREE.Group();pivot.position.set(side*.78,1.9,0);group.add(pivot);arms.push(pivot);
   sphere(pivot,side*.13,-.14,0,.34,suit,[1.0,1.05,.85]);
   cylinder(pivot,side*.19,-.56,0,.24,.22,.61,suitShade);
   cylinder(pivot,side*.19,-.91,0,.29,.29,.23,trim);
   sphere(pivot,side*.19,-1.04,-.04,.25,rubber,[1,.85,1]);
   box(pivot,side*.2,-.26,-.25,.31,.13,.10,buckle);
 }
 // Big expressive helmet with visor, eye highlights, ear-like radios and antenna.
 sphere(group,0,2.32,0,.73,shell,[1,1.03,1.01]);
 sphere(group,0,2.34,-.37,.64,glass,[.88,.65,.63]);
 for(const side of [-1,1]){
   sphere(group,side*.25,2.37,-.92,.10,white,[1,.88,.35]);
   sphere(group,side*.25,2.38,-.98,.042,rubber,[1,1,.3]);
   cylinder(group,side*.72,2.33,0,.18,.18,.40,suitShade);
   sphere(group,side*.72,2.33,0,.20,buckle,[.45,1,1]);
 }
 cylinder(group,0,3.13,0,.085,.085,.37,trim);
 sphere(group,0,3.36,0,.15,buckle);
 // Jetpack, accent piping, and team badge on the back.
 box(group,0,1.40,.82,.86,1.08,.40,trim);
 for(const side of [-1,1]){
   cylinder(group,side*.28,1.41,1.05,.19,.19,.79,shell);
   sphere(group,side*.28,.96,1.06,.21,buckle);
 }
 const label=nameplate(p.name,p.color);
 label.position.y=3.95;group.add(label);
 const bombRing=new THREE.Group();ring(bombRing,1.05,mat('#ff6f9e','#ff2460',1.9),.17);group.add(bombRing);
 return {group,shadow,legs,arms,bombRing,label,torso:torsoMesh};
}
export default function Arena3D({game,meId,liveRef}){
 const mount=useRef(null),current=useRef(game),playerId=useRef(meId),[error,setError]=useState('');
 current.current=game;playerId.current=meId;
 useEffect(()=>{
  if(!mount.current)return;
  const root=mount.current;
  let renderer;
  const lowPower=window.matchMedia('(max-width: 740px)').matches
    ||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
  try{renderer=new THREE.WebGLRenderer({antialias:!lowPower,powerPreference:'high-performance',alpha:false});}catch(e){
   setError('3D needs WebGL 2. Try an updated Chrome, Safari, or Edge browser.');return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lowPower?1:1.4));
  renderer.shadowMap.enabled=!lowPower;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
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
  sun.position.set(-9,16,10);sun.castShadow=!lowPower;sun.shadow.mapSize.set(512,512);
  sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;
  scene.add(sun);
  const spot1=new THREE.PointLight('#ff6da0',90,19,2);spot1.position.set(-10,6,-10);scene.add(spot1);
  const spot2=new THREE.PointLight('#5bd6ff',80,17,2);spot2.position.set(11,6,11);scene.add(spot2);
  const arena=new THREE.Group();scene.add(arena);
  const hoverLights=new THREE.Group();scene.add(hoverLights);
  let spectators=null;
  const characterLayer=new THREE.Group();scene.add(characterLayer);
  const pool=new Map();
  const vector=new THREE.Vector3();
  let lastFrame=0,lastRender=0,slow=0,samples=0,adaptiveLow=lowPower;
  let visible=true;
  const observer=typeof IntersectionObserver!=='undefined'
    ?new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;},{threshold:.01}):null;
  observer?.observe(root);
  const minFrame=1000/(lowPower?30:55);
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
   // Neon playing-field rings, safety stripes, stadium concourse and layered platforms.
   const curb=mat('#2f3650','#0c1424',.18);
   for(let i=0;i<4;i++){
     const sign=i<2?-1:1;
     cube(arena,i%2?28:.8,i%2?.9:1.6,i%2?.8:28,curb,
       i%2?0:sign*13.9,i%2?-.1:.2,i%2?sign*13.9:0);
   }
   for(const r of [4.4,8.5,10.7])ring(arena,r,r===8.5?edge:trim,.02);
   for(let orientation=0;orientation<2;orientation++){
     const stripe=new THREE.InstancedMesh(new THREE.BoxGeometry(.70,.12,1.1),
       orientation?trim:edge,18);
     const dummy=new THREE.Object3D();
     for(let i=0;i<18;i++){
       const side=i<9?-1:1,j=(i%9)-4;
       dummy.position.set(orientation?j*2.7:side*12.14,.18,
         orientation?side*12.14:j*2.7);
       dummy.rotation.set(0,orientation?Math.PI/2:0,0);
       dummy.updateMatrix();stripe.setMatrixAt(i,dummy.matrix);
     }
     stripe.instanceMatrix.needsUpdate=true;arena.add(stripe);
   }

   const grid=new THREE.GridHelper(24,12,secondary,'#444a6c');
   grid.position.y=-.065;arena.add(grid);
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
   // Instanced spectator lights: 36 decorations for just two draw calls.
   for(let parity=0;parity<2;parity++){
     const geo=new THREE.CylinderGeometry(.34,.5,1.8,9);
     const mesh=new THREE.InstancedMesh(geo,parity?trim:edge,18);
     const dummy=new THREE.Object3D();
     for(let i=0;i<18;i++){
       const a=(i*2+parity)/36*Math.PI*2;
       dummy.position.set(Math.sin(a)*17,.85,Math.cos(a)*17);
       dummy.rotation.y=-a;dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
     }
     mesh.instanceMatrix.needsUpdate=true;arena.add(mesh);
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
    if(!pool.has(p.id)){const entry=character(p);characterLayer.add(entry.group);characterLayer.add(entry.shadow);pool.set(p.id,entry);}
    const entry=pool.get(p.id);
    entry.group.visible=p.alive;entry.shadow.visible=p.alive;
    entry.group.position.x=THREE.MathUtils.lerp(entry.group.position.x,p.x,.34);
    entry.group.position.z=THREE.MathUtils.lerp(entry.group.position.z,p.z,.34);
    entry.group.position.y=THREE.MathUtils.lerp(entry.group.position.y,p.y||0,.38);
    entry.shadow.position.x=entry.group.position.x;
    entry.shadow.position.z=entry.group.position.z;
    entry.shadow.scale.setScalar(Math.max(.48,1-(p.y||0)*.17));
    entry.shadow.material.opacity=.32*Math.max(.35,1-(p.y||0)*.20);
    const angular=p.yaw||0,dir=(angular-entry.group.rotation.y+Math.PI*3)%(Math.PI*2)-Math.PI;
    entry.group.rotation.y+=dir*.21;
    entry.bombRing.visible=p.id===current.current?.bomb&&preset(current.current?.challenge||0).mode===0&&current.current?.phase==='playing';
    if(entry.bombRing.visible)entry.bombRing.scale.setScalar(1+Math.sin(performance.now()*.012)*.08);
    entry.torso.material.emissiveIntensity=p.flash>.05?1.75:.24;
    const wobble=Math.sin(performance.now()*.012+p.id.length)*.08;
    const airborne=(p.y||0)>.15;
    entry.legs[0].rotation.x=airborne?.45:wobble;
    entry.legs[1].rotation.x=airborne?-.45:-wobble;
    entry.arms[0].rotation.x=airborne?-.8:-wobble;
    entry.arms[1].rotation.x=airborne?-.8:wobble;
   }
   for(const [id,obj] of pool)if(!seen.has(id)){characterLayer.remove(obj.group);characterLayer.remove(obj.shadow);obj.shadow.geometry.dispose();obj.shadow.material.dispose();
    obj.group.traverse(node=>{node.geometry?.dispose();if(node.material){node.material.map?.dispose();node.material.dispose();}});
    pool.delete(id);}
  }
  const animate=(now)=>{
   if(disposed)return;
   raf=requestAnimationFrame(animate);
   if(document.hidden||now-lastFrame<minFrame)return;
   // Avoid work while scrolled offscreen, e.g. the homepage 3D preview.
   if(!root.isConnected||!visible)return;
   if(!adaptiveLow && lastRender>0){
     slow+=Number(now-lastRender>32);
     if(++samples>=90){
       if(slow>42){adaptiveLow=true;renderer.setPixelRatio(1);sun.castShadow=false;
         renderer.shadowMap.enabled=false;renderer.setSize(root.clientWidth,root.clientHeight,false);}
       samples=0;slow=0;
     }
   }
   lastRender=now;
   lastFrame=now;
   const g=liveRef?.current||current.current;
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
     vector.set(view.x,8.4,view.z+12.1);
     camera.position.lerp(vector,.078);
     camera.lookAt(view.x,1.1,view.z-2);
    }
   }
   renderer.render(scene,camera);
  };
  raf=requestAnimationFrame(animate);
  return ()=>{
   disposed=true;cancelAnimationFrame(raf);resize.disconnect();observer?.disconnect();
   cleanupLayer(characterLayer);cleanupLayer(arena);
   renderer.dispose();renderer.domElement.remove();
  };
 },[]);
 return <div ref={mount} className="webgl-window">
  {error&&<div className="webgl-error">{error}</div>}
  <div className="world-label">THIRD-PERSON PARTY ARENA <span>● LIVE 3D</span></div>
 </div>;
}
