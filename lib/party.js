// Deterministic host-authoritative party game rules. No network or browser dependencies.
export const GAME_MODES = [
  {slug:'bomb-tag',name:'BOMB TAG',icon:'💣',rule:'Pass the bomb by tagging somebody. Explosions cost points.',kind:'chaos'},
  {slug:'coin-dash',name:'COIN DASH',icon:'🪙',rule:'Snatch the glowing coins before your rivals do.',kind:'collect'},
  {slug:'king-hill',name:'KING OF THE HILL',icon:'👑',rule:'Hold the middle circle to rack up points.',kind:'control'},
  {slug:'meteor-mayhem',name:'METEOR MAYHEM',icon:'☄️',rule:'Avoid falling meteor danger zones and stay alive.',kind:'survival'},
  {slug:'laser-leap',name:'LASER LEAP',icon:'⚡',rule:'Dodge the sweeping laser wall.',kind:'survival'},
  {slug:'shrinking-island',name:'SHRINKING ISLAND',icon:'🌋',rule:'Stay inside the shrinking safe circle.',kind:'survival'},
  {slug:'red-light',name:'RED LIGHT',icon:'🚦',rule:'Move on green, freeze on red. Keep moving to score.',kind:'reaction'},
  {slug:'freeze-dance',name:'FREEZE DANCE',icon:'🪩',rule:'Dance for points. Stop dead when the music stops.',kind:'reaction'},
  {slug:'checkpoint-rush',name:'CHECKPOINT RUSH',icon:'🏁',rule:'Run through the checkpoint gates in order.',kind:'race'},
  {slug:'flag-frenzy',name:'FLAG FRENZY',icon:'🚩',rule:'Stand near glowing flags to capture points.',kind:'control'},
  {slug:'tag-frenzy',name:'TAG FRENZY',icon:'👟',rule:'Tag other players to score, then escape.',kind:'chaos'},
  {slug:'hot-tiles',name:'HOT TILES',icon:'🔥',rule:'Keep off the flashing red floor panels.',kind:'survival'}
];
const SETS=['NEON','SKYLINE','CANDY','VOLCANIC','COSMIC'];
const COURSES=['CIRCUIT','CROSSROADS','PINBALL','TANGLE','LABYRINTH'];
export const TOTAL_CHALLENGES=300;
export const COLORS=['#d5ff4b','#fa79aa','#7acbff','#bd95ff','#ffbd62','#77edd0','#ff8793','#ddf2a2'];
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function preset(index){
  const id=((Math.floor(Number(index)||0)%300)+300)%300;
  const variant=Math.floor(id/12),mode=id%12;
  return {id,variant,mode,family:GAME_MODES[mode],theme:SETS[variant%5],
    course:COURSES[Math.floor(variant/5)],number:id+1,
    name:GAME_MODES[mode].name+' · '+COURSES[Math.floor(variant/5)]+' '+(variant%5+1),
    tempo:1+Math.floor(variant/5)*.07+(variant%5)*.025,
    seed:id*109+17,duration:55+(variant%5)*8};
}
export const catalog=Array.from({length:TOTAL_CHALLENGES},(_,i)=>preset(i));
export const prng=seed=>{let s=seed>>>0;return ()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;}};
export function obstacles(index){
  const p=preset(index),rand=prng(p.seed+123),items=[];
  const count=2+Math.floor(p.variant/5);
  for(let i=0;i<count*9 && items.length<count;i++){
    const x=(rand()-.5)*16,z=(rand()-.5)*16,half=.8+rand()*.55;
    if(Math.hypot(x,z)<3.8||Math.hypot(x,z)>10||items.some(o=>Math.hypot(o.x-x,o.z-z)<3.8))continue;
    items.push({x,z,half,h:1.1+rand()*.8});
  }
  return items;
}
export function pickups(index,elapsed){
  const p=preset(index),period=Math.floor(elapsed/5),rand=prng(p.seed+period*613+38);
  return Array.from({length:9},(_,i)=>{
    const ang=(i/9)*Math.PI*2+rand()*.75;
    const r=3.3+rand()*6.5;
    return {id:period+'-'+i,x:Math.sin(ang)*r,z:Math.cos(ang)*r};
  });
}
export function checkpoints(index){
  const p=preset(index),shift=p.seed%5;
  return Array.from({length:6},(_,i)=>{
    const a=(i/6)*Math.PI*2+shift*.17;
    return {x:Math.sin(a)*7,z:Math.cos(a)*7};
  });
}
export function flags(index){
  const shift=preset(index).variant*.21;
  return Array.from({length:3},(_,i)=>{
    const a=i*Math.PI*2/3+shift;
    return {x:Math.sin(a)*6.5,z:Math.cos(a)*6.5};
  });
}
export function hazards(index,elapsed){
  const p=preset(index),v=elapsed*p.tempo,mode=p.mode;
  if(mode===3)return Array.from({length:4+Math.floor(p.variant/10)},(_,i)=>({
    type:'circle',x:Math.sin(v*.69+i*2.3+p.seed)*8.2,
    z:Math.cos(v*.77+i*1.91+p.seed*.03)*8.2,r:1.3+p.variant*.018
  }));
  if(mode===4)return [{type:'laser',x:Math.sin(v*.8+p.seed)*9.3,
    r:.72+p.variant*.015}];
  if(mode===5)return [{type:'island',r:clamp(10.4-elapsed*(.18+p.variant*.008),3.0,10.4)}];
  if(mode===11)return Array.from({length:25},(_,i)=>{
    const active=(Math.floor(v/2.6)+Math.floor(i/5)*2+i%5+p.variant)%5===0;
    return {type:'tile',x:((i%5)-2)*4.5,z:(Math.floor(i/5)-2)*4.5,r:2.12,active};
  });
  return [];
}
export function collision(a,b,r=1.45){return distance(a,b)<r;}
export function newPlayer(id,name,i){
  const theta=i*Math.PI/4;
  return {id,name:String(name||'PLAYER').slice(0,15),x:Math.sin(theta)*5.2,z:Math.cos(theta)*5.2,
    yaw:0,y:0,vy:0,jumpHeld:false,jumpsLeft:2,color:COLORS[i%COLORS.length],score:0,points:0,lock:0,flash:0,target:0,alive:true};
}
export function freshRoom(id,name){
  return {phase:'lobby',hostId:id,players:[newPlayer(id,name,0)],selection:0,
    round:0,maxRounds:5,elapsed:0,remaining:0,challenge:0,event:'WELCOME TO THE PARTY',bomb:id,taken:[],winner:null,seq:0};
}
export function addPlayer(game,id,name){
  if(game.players.some(p=>p.id===id)||game.players.length>=8)return game;
  const player=newPlayer(id,name,game.players.length);
  if(game.phase!=='lobby') player.alive=false;
  return {...game,players:[...game.players,player],event:player.name+' JOINED',seq:game.seq+1};
}
export function removePlayer(game,id){
  const players=game.players.filter(p=>p.id!==id);
  const bomb=game.bomb===id?players.find(p=>p.alive)?.id:null;
  return {...game,players,bomb,seq:game.seq+1};
}
function setRound(game,round,challenge){
  const p=preset(challenge);
  const players=game.players.map((v,i)=>({...v,x:Math.sin(i*Math.PI*2/game.players.length)*5,
    z:Math.cos(i*Math.PI*2/game.players.length)*5,y:0,vy:0,jumpHeld:false,jumpsLeft:2,score:0,lock:0,flash:0,target:0,alive:true}));
  return {...game,players,round,challenge:p.id,phase:'countdown',remaining:3,
    elapsed:0,taken:[],bomb:players[0]?.id||null,event:'UP NEXT: '+p.family.name,seq:game.seq+1};
}
export function beginParty(game){
  if(game.players.length<2)return game;
  return setRound({...game,round:0},1,game.selection);
}
export function setOptions(game,opts){
  if(game.phase!=='lobby')return game;
  const maxRounds=[5,10,20].includes(Number(opts.maxRounds))?Number(opts.maxRounds):game.maxRounds;
  return {...game,maxRounds,selection:clamp(Math.floor(Number(opts.selection)||0),0,299)};
}
export function finishRound(game){
  const players=game.players.map(p=>({...p}));
  const sorted=players.slice().sort((a,b)=>b.score-a.score);
  sorted.forEach((p,i)=>{const original=players.find(e=>e.id===p.id);if(original)original.points+=(i===0?5:i===1?3:i===2?2:1);});
  return {...game,players,phase:'results',remaining:5,event:(sorted[0]?.name||'NOBODY')+' WON THE ROUND!',winner:sorted[0]?.id||null,seq:game.seq+1};
}
export function aiControl(game,player){
  const p=preset(game.challenge),mode=p.mode,others=game.players.filter(v=>v.alive&&v.id!==player.id);
  const now=game.elapsed,drift=now*.8+(player.name.length*1.31),target={x:Math.sin(drift)*7,z:Math.cos(drift)*7};
  if(mode===0){
    const holder=game.players.find(x=>x.id===game.bomb);
    if(game.bomb===player.id && others.length)Object.assign(target,others.reduce((a,b)=>distance(b,player)<distance(a,player)?b:a,others[0]));
    else if(holder && distance(holder,player)<6)Object.assign(target,{x:player.x+(player.x-holder.x)*3,z:player.z+(player.z-holder.z)*3});
  }
  if(mode===1){const list=pickups(game.challenge,now).filter(v=>!game.taken.includes(v.id));if(list.length)Object.assign(target,list.reduce((a,b)=>distance(b,player)<distance(a,player)?b:a,list[0]));}
  if(mode===2||mode===5)Object.assign(target,{x:0,z:0});
  if(mode===8){const c=checkpoints(game.challenge)[player.target%6];Object.assign(target,c);}
  if(mode===9){const a=flags(game.challenge);Object.assign(target,a[(player.name.length+Math.floor(now/5))%3]);}
  if(mode===10 && others.length)Object.assign(target,others.reduce((a,b)=>distance(b,player)<distance(a,player)?b:a,others[0]));
  if((mode===6||mode===7)&&Math.floor(now/(mode===6?2.9:3.3))%2) return {x:0,z:0,jump:false};
  if(mode===3||mode===4||mode===11){
    const hs=hazards(game.challenge,now);
    for(const h of hs){
      if(h.type==='circle'&&distance(player,h)<h.r+3)Object.assign(target,{x:player.x+(player.x-h.x)*5,z:player.z+(player.z-h.z)*5});
      if(h.type==='laser'&&Math.abs(player.x-h.x)<2)Object.assign(target,{x:player.x+(player.x-h.x)*7,z:player.z+1});
      if(h.type==='tile'&&h.active&&Math.abs(player.x-h.x)<2.6&&Math.abs(player.z-h.z)<2.6)Object.assign(target,{x:player.x+Math.sign(player.x-h.x||1)*4,z:player.z+Math.sign(player.z-h.z||1)*4});
    }
  }
  const dx=target.x-player.x,dz=target.z-player.z,norm=Math.hypot(dx,dz)||1;
  return {x:dx/norm,z:dz/norm,
    jump:(mode===4&&Math.abs(player.x-hazards(game.challenge,now)[0].x)<3.5&&player.y<.1)
      ||(mode===11&&hazards(game.challenge,now).some(h=>h.active&&Math.abs(player.x-h.x)<2.6&&Math.abs(player.z-h.z)<2.6)&&player.y<.1)
  };
}
function movePlayer(p,control,dt,speed,obs){
  const x=clamp(Number(control?.x)||0,-1,1),z=clamp(Number(control?.z)||0,-1,1);
  // Host-authoritative physics: tap SPACE / JUMP to leap; release between double jumps.
  const pressed=control?.jump===true;
  if(pressed&&!p.jumpHeld&&p.jumpsLeft>0){
    p.vy=p.jumpsLeft===2?9.2:8.35;
    p.jumpsLeft--;
  }
  p.jumpHeld=pressed;
  p.y=Math.max(0,(p.y||0)+(p.vy||0)*dt);
  p.vy=(p.vy||0)-24*dt;
  if(p.y<=0){p.y=0;p.vy=0;p.jumpsLeft=2;}

  const mag=Math.hypot(x,z)||1;
  const vx=x/mag*speed*dt,vz=z/mag*speed*dt;
  const test=(x,z)=>!obs.some(o=>p.y<o.h+.04&&Math.abs(x-o.x)<o.half+.62&&Math.abs(z-o.z)<o.half+.62);
  const nx=clamp(p.x+vx,-11.2,11.2),nz=clamp(p.z+vz,-11.2,11.2);
  if(test(nx,p.z))p.x=nx;
  if(test(p.x,nz))p.z=nz;
  if(Math.hypot(vx,vz)>.005)p.yaw=Math.atan2(vx,-vz);
  return Math.hypot(p.x-nx,p.z-nz)<2?Math.hypot(vx,vz):0;
}
export function tick(game,inputs,dt){
  if(!game||game.phase==='lobby'||game.phase==='podium')return game;
  dt=clamp(dt,0,.12);
  if(game.phase==='countdown'){
    const remaining=game.remaining-dt;
    if(remaining>0)return {...game,remaining};
    return {...game,phase:'playing',remaining:preset(game.challenge).duration,
      elapsed:0,event:'GO! GO! GO!',seq:game.seq+1};
  }
  if(game.phase==='results'){
    const remaining=game.remaining-dt;
    if(remaining>0)return {...game,remaining};
    if(game.round>=game.maxRounds){
      const winner=game.players.slice().sort((a,b)=>b.points-a.points)[0];
      return {...game,phase:'podium',winner:winner?.id||null,remaining:0,
        event:(winner?.name||'NOBODY')+' IS THE PARTY CHAMPION!',seq:game.seq+1};
    }
    return setRound(game,game.round+1,(game.selection+game.round*73)%300);
  }
  const mode=preset(game.challenge).mode;
  const p=preset(game.challenge);
  const players=game.players.map(player=>({...player,lock:Math.max(0,player.lock-dt),flash:Math.max(0,player.flash-dt)}));
  const next={...game,players,elapsed:game.elapsed+dt,remaining:game.remaining-dt};
  const obs=obstacles(game.challenge);
  const displacement={};
  players.forEach(player=>{
    if(!player.alive)return;
    const control=player.id.startsWith('bot-')?aiControl(next,player):inputs[player.id]||{x:0,z:0};
    const x=player.x,z=player.z;
    movePlayer(player,control,dt,5.75*p.tempo,obs);
    displacement[player.id]=Math.hypot(player.x-x,player.z-z);
  });
  const hit=(player,loss=2)=>{
    if(player.lock>0)return;
    player.score=Math.max(-10,player.score-loss);player.lock=.9;player.flash=.5;
    next.event=player.name+' GOT HIT!';
  };
  const active=players.filter(player=>player.alive);
  if(mode===0){
    if(!active.some(x=>x.id===next.bomb))next.bomb=active[0]?.id||null;
    const holder=active.find(x=>x.id===next.bomb);
    if(holder&&holder.lock<=0){
      const tag=active.find(x=>x.id!==holder.id&&collision(x,holder,1.35));
      if(tag){holder.score+=1;holder.lock=1.1;tag.lock=1.1;next.bomb=tag.id;next.event=holder.name+' PASSED THE BOMB!';next.seq++;}
    }
    if(Math.floor((next.elapsed-dt)/6)<Math.floor(next.elapsed/6)&&holder){
      const current=players.find(x=>x.id===next.bomb);
      if(current){current.score-=5;current.flash=.8;next.event=current.name+' EXPLODED!';next.seq++;}
      const choices=active.filter(x=>x.id!==next.bomb);
      next.bomb=(choices.length?choices[Math.floor(next.elapsed+game.challenge)%choices.length]:holder).id;
    }
    active.filter(x=>x.id!==next.bomb).forEach(x=>x.score+=dt*.22);
  }
  if(mode===1){
    const taken=new Set(next.taken);
    for(const coin of pickups(game.challenge,next.elapsed)){
      if(taken.has(coin.id))continue;
      const collector=active.find(x=>collision(x,coin,1.12));
      if(collector){collector.score+=2;taken.add(coin.id);next.event=collector.name+' GOT A COIN!';next.seq++;}
    }
    next.taken=[...taken].slice(-120);
  }
  if(mode===2)active.forEach(x=>{if(Math.hypot(x.x,x.z)<3.45)x.score+=dt*2.5;});
  if(mode===9){
    const sites=flags(game.challenge);
    active.forEach(x=>{if(sites.some(s=>collision(x,s,2.15)))x.score+=dt*1.4;});
  }
  if(mode===8){
    const sites=checkpoints(game.challenge);
    active.forEach(x=>{if(collision(x,sites[x.target%6],1.65)){x.score+=3;x.target++;next.event=x.name+' HIT CHECKPOINT '+x.target;next.seq++;}});
  }
  if(mode===10){
    active.forEach(x=>{
      if(x.lock>0)return;
      const other=active.find(y=>y.id!==x.id&&y.lock<=0&&collision(x,y,1.2));
      if(other){x.score+=2;x.lock=1;other.lock=.8;other.flash=.4;next.event=x.name+' TAGGED '+other.name;next.seq++;}
    });
  }
  if(mode===6||mode===7){
    const safe=Math.floor(next.elapsed/(mode===6?2.9:3.3))%2===0;
    active.forEach(x=>{
      const moving=(displacement[x.id]||0)>dt*.4 || x.y>.15;
      if(safe&&moving)x.score+=dt*1.6;
      if(!safe&&moving)hit(x,2.4);
    });
  }
  if([3,4,5,11].includes(mode)){
    const hs=hazards(game.challenge,next.elapsed);
    active.forEach(x=>{
      const danger=hs.some(h=>h.type==='circle'?distance(x,h)<h.r+.1&&x.y<.9:
        h.type==='laser'?Math.abs(x.x-h.x)<h.r&&x.y<1.12:
        h.type==='island'?Math.hypot(x.x,x.z)>h.r&&x.y<.25:
        h.type==='tile'?h.active&&Math.abs(x.x-h.x)<h.r&&Math.abs(x.z-h.z)<h.r&&x.y<.3:false);
      if(danger)hit(x,2.3);else x.score+=dt*.6;
    });
  }
  if(next.remaining<=0)return finishRound(next);
  return next;
}
