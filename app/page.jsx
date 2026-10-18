'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Arena3D from '../components/Arena3D.jsx';
import {GAME_MODES,catalog,TOTAL_CHALLENGES,preset,newPlayer,freshRoom,addPlayer,removePlayer,
 beginParty,setOptions,tick,finishRound} from '../lib/party.js';

const APP_ID='com.datewade.party.arena.2026';
const ID_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const clean=(v)=>String(v||'').trim().slice(0,15)||'Party Animal';
const blank=()=>({x:0,z:0,jump:false,jumpId:0});
const safeSend=(action,data,opts)=>{if(action)Promise.resolve(action.send(data,opts)).catch(()=>{});};
function inviteCode(){
 const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);
 return Array.from(bytes,byte=>ID_ALPHABET[byte%ID_ALPHABET.length]).join('');
}
function formatPoints(points){return Math.max(-99,points||0).toFixed(0);}
const demo=(()=>{
 let g=freshRoom('demo','YOU');g=addPlayer(g,'bot-rose','MUSHROOM');g=addPlayer(g,'bot-blue','PICKLE');
 g=addPlayer(g,'bot-violet','KENNY');return {...g,phase:'playing',challenge:39,bomb:'demo',elapsed:7,remaining:18};
})();
export default function Home(){
 const [mode,setMode]=useState('home'),[name,setName]=useState(''),[joinCode,setJoinCode]=useState('');
 const [roomCode,setRoomCode]=useState(''),[game,setGame]=useState(null),[notice,setNotice]=useState('');
 const [connecting,setConnecting]=useState(false),[catalogOpen,setCatalogOpen]=useState(false);
 const [familyFilter,setFamilyFilter]=useState('all'),[showHelp,setShowHelp]=useState(false);
 const [sfx,setSfx]=useState(false);
 const idRef=useRef(''),roomRef=useRef(null),actionsRef=useRef({}),hostRef=useRef(false),hostPeerRef=useRef('');
 const gameRef=useRef(null),heldRef=useRef(blank()),inputRef=useRef({}),tickRef=useRef(null);
 const connectionRef=useRef(false),lastEvent=useRef(-1),audioRef=useRef(null);
 const isHost=hostRef.current;
 const me=game?.players?.find(p=>p.id===idRef.current);
 const challenge=preset(game?.phase==='lobby' ? game?.selection||0 : game?.challenge||0);
 const scoreboard=(game?.players||[]).slice().sort((a,b)=>(game?.phase==='podium'?b.points-a.points:b.score-a.score));
 const filtered=useMemo(()=>familyFilter==='all'?catalog:catalog.filter(c=>String(c.mode)===familyFilter),[familyFilter]);
 useEffect(()=>{
  try{const remembered=localStorage.getItem('datewade-name');if(remembered)setName(remembered);
   const code=new URLSearchParams(window.location.search).get('room');
   if(code&&/^[A-Z2-9]{6}$/i.test(code))setJoinCode(code.toUpperCase());
  }catch{}
 },[]);
 useEffect(()=>{
  if(!sfx||!game||game.seq===lastEvent.current)return;
  lastEvent.current=game.seq;
  if(game.phase==='lobby')return;
  try{
   const audio=audioRef.current||new window.AudioContext();audioRef.current=audio;
   const osc=audio.createOscillator(),gain=audio.createGain();
   osc.type='sine';osc.frequency.setValueAtTime(game.phase==='results'?540:740,audio.currentTime);
   osc.frequency.exponentialRampToValueAtTime(300,audio.currentTime+.12);
   gain.gain.setValueAtTime(.08,audio.currentTime);
   gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);
   osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.18);
  }catch{}
 },[game?.seq,sfx,game?.phase]);
 useEffect(()=>()=>{if(tickRef.current)clearInterval(tickRef.current);
  try{roomRef.current?.leave();}catch{}audioRef.current?.close().catch(()=>{});},[]);
 function publish(next){
  gameRef.current=next;setGame(next);
  if(hostRef.current)safeSend(actionsRef.current.state,next);
 }
 function disconnect(){
  if(tickRef.current)clearInterval(tickRef.current);tickRef.current=null;
  try{roomRef.current?.leave();}catch{}
  roomRef.current=null;actionsRef.current={};hostRef.current=false;hostPeerRef.current='';
  idRef.current='';connectionRef.current=false;inputRef.current={};heldRef.current=blank();
  gameRef.current=null;setGame(null);setRoomCode('');setMode('home');setNotice('');setCatalogOpen(false);
  if(typeof window!=='undefined')history.replaceState({},'',location.pathname);
 }
 async function connect(host){
  if(connecting||connectionRef.current)return;
  const code=host?inviteCode():joinCode.toUpperCase().trim();
  if(!host&&!/^[A-Z2-9]{6}$/.test(code)){setNotice('Enter a valid six-character room code.');return;}
  setNotice('');setConnecting(true);
  let room=null;
  try{
   const {joinRoom,selfId}=await import('trystero');
   const playerName=clean(name);
   localStorage.setItem('datewade-name',playerName);
   room=joinRoom({appId:APP_ID},code);
   roomRef.current=room;hostRef.current=host;idRef.current=selfId;
   const hello=room.makeAction('hello');
   const state=room.makeAction('state');
   const input=room.makeAction('input');
   actionsRef.current={hello,state,input};
   if(host){
    gameRef.current=freshRoom(selfId,playerName);
    setGame(gameRef.current);hostPeerRef.current=selfId;
   }else{gameRef.current=null;setGame(null);}
   hello.onMessage=(data,{peerId})=>{
    if(!data||typeof data.name!=='string')return;
    if(host){
     const before=gameRef.current;
     if(before?.players?.length>=8){
      safeSend(state,{...before,event:'ROOM FULL'}, {target:peerId});return;
     }
     const next=addPlayer(before,peerId,clean(data.name));
     if(next!==before)publish(next);
     safeSend(state,gameRef.current,{target:peerId});
    }else if(data.host){
     hostPeerRef.current=peerId;
     safeSend(hello,{name:playerName,host:false},{target:peerId});
    }
   };
   state.onMessage=(incoming,{peerId})=>{
    if(host||!incoming||!Array.isArray(incoming.players))return;
    if(incoming.hostId!==peerId||incoming.players.length>8)return;
    if(hostPeerRef.current&&hostPeerRef.current!==peerId)return;
    hostPeerRef.current=peerId;gameRef.current=incoming;setGame(incoming);
    if(incoming.event==='ROOM FULL')setNotice('Room is full, sorry!');
    else setNotice('');
   };
   input.onMessage=(data,{peerId})=>{
    if(!host||!gameRef.current?.players.some(p=>p.id===peerId))return;
    inputRef.current[peerId]={x:Math.max(-1,Math.min(1,Number(data?.x)||0)),
      z:Math.max(-1,Math.min(1,Number(data?.z)||0)),jump:data?.jump===true,jumpId:Math.max(0,Math.floor(Number(data?.jumpId)||0))};
   };
   room.onPeerJoin=(peerId)=>{
    safeSend(hello,{name:playerName,host},{target:peerId});
    if(host&&gameRef.current)safeSend(state,gameRef.current,{target:peerId});
   };
   room.onPeerLeave=(peerId)=>{
    if(host){
     delete inputRef.current[peerId];
     if(gameRef.current)publish(removePlayer(gameRef.current,peerId));
    }else if(peerId===hostPeerRef.current){
     setNotice('The host disconnected. Leave this room to start a new one.');
     gameRef.current=null;setGame(null);
    }
   };
      connectionRef.current=true;
   setRoomCode(code);setMode('arena');
   history.replaceState({},'',location.pathname+'?room='+code);
   let last=performance.now(),broadcast=0;
   tickRef.current=setInterval(()=>{
    if(host){
     const now=performance.now(),dt=Math.min((now-last)/1000,.12);last=now;
     inputRef.current[selfId]=heldRef.current;
     if(!gameRef.current)return;
     const current=gameRef.current;
     const next=tick(current,inputRef.current,dt);
     if(next!==current)gameRef.current=next;
     broadcast+=dt;
     if(broadcast>=.12){broadcast=0;publish(gameRef.current);}
    }else safeSend(input,heldRef.current,{target:hostPeerRef.current||undefined});
   },host?40:75);
  }catch(error){
   try{room?.leave();}catch{}
   roomRef.current=null;connectionRef.current=false;hostRef.current=false;
   setNotice('Unable to open room: '+(error?.message||'Connection failed'));
  }finally{setConnecting(false);}
 }
 const start=()=>{if(hostRef.current&&gameRef.current?.players?.length>=2)publish(beginParty(gameRef.current));};
 const addBot=()=>{
  if(!hostRef.current||gameRef.current?.phase!=='lobby')return;
  const before=gameRef.current;if(before.players.length>=8)return;
  const count=before.players.filter(p=>p.id.startsWith('bot-')).length;
  const botId='bot-'+Date.now().toString(36)+'-'+count;
  publish(addPlayer(before,botId,['MUSHROOM','PICKLE','CHAOS BOT','LIL GUY','SPEEDY','WILD CARD','ROBOT'][count%7]));
 };
 const option=(options)=>{if(hostRef.current&&gameRef.current)publish(setOptions(gameRef.current,options));};
 const rematch=()=>{
  if(!hostRef.current||gameRef.current?.phase!=='podium')return;
  publish({...gameRef.current,phase:'lobby',players:gameRef.current.players.map(p=>({...p,score:0,points:0,alive:true})),
    event:'READY FOR ANOTHER PARTY?',round:0,seq:gameRef.current.seq+1});
 };
 async function copyLink(){
  const url=location.origin+location.pathname+'?room='+roomCode;
  try{await navigator.clipboard.writeText(url);setNotice('Invite link copied!');}
  catch{setNotice(url);}
 }
 function control(x,z){heldRef.current={...heldRef.current,x,z};
  if(!hostRef.current)safeSend(actionsRef.current.input,heldRef.current,{target:hostPeerRef.current||undefined});}
 function setJump(pressed){
  heldRef.current={...heldRef.current,jump:pressed,jumpId:(heldRef.current.jumpId||0)+(pressed&&!heldRef.current.jump?1:0)};
  if(!hostRef.current)safeSend(actionsRef.current.input,heldRef.current,{target:hostPeerRef.current||undefined});
 }
 const directions=useRef(new Set());
 const updateKeys=()=>{
  const d=directions.current;
  const x=Number(d.has('right'))-Number(d.has('left')),z=Number(d.has('down'))-Number(d.has('up'));
  control(x,z);
 };
 useEffect(()=>{
  if(mode!=='arena')return;
  const map={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
  const down=e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
   if(e.code==='Space'){e.preventDefault();setJump(true);return;}
   const direction=map[e.key.toLowerCase()];
   if(direction){e.preventDefault();directions.current.add(direction);updateKeys();}
  };
  const up=e=>{if(e.code==='Space'){e.preventDefault();setJump(false);return;}const direction=map[e.key.toLowerCase()];
   if(direction){e.preventDefault();directions.current.delete(direction);updateKeys();}};
  const blur=()=>{directions.current.clear();control(0,0);setJump(false);};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  window.addEventListener('blur',blur);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);
   window.removeEventListener('blur',blur);blur();};
 },[mode]);
 const pads=[['up','▲'],['left','◀'],['down','▼'],['right','▶']];
 const partyStatus=game?.phase==='playing'?challenge.family.name:
   game?.phase==='countdown'?'GAME STARTING':game?.phase==='results'?'ROUND COMPLETE':
   game?.phase==='podium'?'PARTY CHAMPION':'GATHER THE GANG';
 const showCatalog=(game?.phase==='lobby'&&isHost)||mode==='home';
 return <div className="site">
  <header className="navigation"><div className="nav-inner">
   <button className="logo" onClick={()=>mode==='arena'?disconnect():setCatalogOpen(false)} aria-label="DateWade Games home">
    <span className="logo-mark">DW<span>✦</span></span><span>DATEWADE <b>GAMES</b></span>
   </button><div className="nav-links"><span className="pill green">● 3D PARTY ARENA</span><span className="pill">300 CHALLENGES</span>
    {mode==='arena'&&<button className="nav-exit" onClick={disconnect}>LEAVE ROOM ↗</button>}</div>
  </div></header>
  {mode==='home'?<main className="home">
   <section className="home-hero">
    <div className="hero-text"><div className="kicker"><span className="dot"/> THE ULTIMATE FRIENDSHIP TEST</div>
     <h1>THE PARTY<br/>IS <em>ON<span>!</span></em></h1>
     <p>300 fast, ridiculous challenges. One 3D arena. Your friends. Zero mercy. No downloads, no signups—just absolute chaos.</p>
     <div className="hero-badges"><span>✦ 2–8 FRIENDS</span><span>⚡ 55–87 SEC GAMES</span><span>◉ IN YOUR BROWSER</span></div>
    </div>
    <div className="hero-stage"><Arena3D game={demo} meId="demo"/>
     <span className="stage-note">MEET YOUR NEW PLAYGROUND ↗</span>
    </div>
   </section>
   <div className="home-grid">
    <section className="create-panel"><div className="card-overline"><span>01 / THE GAME LOBBY</span><span className="tag">PLAY NOW</span></div>
     <h2>GATHER THE SQUAD<span>.</span></h2>
     <label htmlFor="player-name">YOUR PLAYER NAME</label>
     <input id="player-name" maxLength={15} value={name} placeholder="Your totally normal nickname" onChange={e=>setName(e.target.value)}/>
     <button className="action lime wide" disabled={connecting} onClick={()=>connect(true)}>CREATE A PRIVATE ROOM <span>↗</span></button>
     <div className="divider-text"><span>OR JOIN SOMEONE ELSE</span></div>
     <div className="join-row"><input aria-label="Six character room code" placeholder="ROOM CODE" maxLength={6}
      value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))}
      onKeyDown={e=>{if(e.key==='Enter')connect(false);}}/>
      <button className="action dark" disabled={connecting} onClick={()=>connect(false)}>JOIN ↗</button>
     </div>
     {notice&&<p className="notice" role="status">{notice}</p>}
     <p className="tiny-hint">↗ SHARE A ROOM LINK. EVERYBODY PLAYS IN THE SAME ARENA.</p>
    </section>
    <section className="spotlight"><div className="card-overline"><span>02 / THE LINEUP</span><span>∞ REPLAYABILITY</span></div>
     <h2>TWELVE WAYS<br/>TO <span>LOSE FRIENDS.</span></h2>
     <div className="spotlight-list">{GAME_MODES.slice(0,4).map((m,i)=><div className="spotlight-row" key={m.slug}>
      <span className="mode-emoji">{m.icon}</span><div><b>{m.name}</b><small>{m.rule}</small></div><span className="spotlight-n">{String(i+1).padStart(2,'0')}</span>
     </div>)}</div>
     <button className="outline-button" onClick={()=>setCatalogOpen(true)}>BROWSE ALL 300 CHALLENGES <span>↗</span></button>
    </section>
   </div>
   <section className="bottom-strip"><span>12 GAME MODES</span><span>✦</span><span>25 STAGE VARIATIONS EACH</span><span>✦</span><span>300 PLAYABLE CHALLENGES</span></section>
  </main>:<main className="room">
   <div className="room-top"><div><span className="small-label">DATEWADE / PARTY ARENA</span>
     <h1>{partyStatus}<span>.</span></h1></div>
     <div className="invite"><span>PRIVATE ROOM <b>{roomCode}</b></span><button onClick={copyLink}>COPY INVITE ↗</button></div>
   </div>
   {notice&&<div className="toast" role="status">{notice}</div>}
   <div className="room-grid"><section className="play-column">
    <div className="game-toolbar"><div className="mode-name"><span>{challenge.family.icon}</span>
      <div><small>CHALLENGE #{String(challenge.id+1).padStart(3,'0')} · {challenge.course}</small>
       <b>{challenge.family.name}</b></div></div>
      <div className="clock"><small>{game?.phase==='playing'?'TIME LEFT':game?.phase==='countdown'?'STARTS IN':game?.phase==='results'?'NEXT ROUND IN':'ROUND'}</small>
       <strong>{game?.phase==='playing'||game?.phase==='countdown'||game?.phase==='results'?Math.ceil(game.remaining||0).toString().padStart(2,'0'):game?.round||'—'}</strong></div></div>
    <div className="gameframe"><Arena3D game={game||demo} liveRef={gameRef} meId={idRef.current||'demo'}/>
     {game?.phase==='playing'&&<div className="objective"><span>{challenge.family.icon}</span>{challenge.family.rule}</div>}
     {game?.phase==='countdown'&&<div className="overlay-interlude"><div className="interlude-kicker">ROUND {game.round} OF {game.maxRounds}</div>
      <h2>{challenge.family.name}</h2><p>{challenge.family.rule}</p><strong>{Math.ceil(game.remaining)}</strong></div>}
     {game?.phase==='results'&&<div className="overlay-interlude"><div className="interlude-kicker">ROUND {game.round} COMPLETE</div>
      <h2>{game.players.find(p=>p.id===game.winner)?.name||'SOMEBODY'} WINS!</h2><p>{game.event}</p><strong>{Math.ceil(game.remaining)}</strong></div>}
     {game?.phase==='podium'&&<div className="overlay-interlude"><div className="interlude-kicker">THE FINAL VERDICT</div>
      <h2>🏆 {game.players.find(p=>p.id===game.winner)?.name||'NOBODY'} WINS!</h2><p>Bragging rights secured. Friendships questionable.</p>
      {isHost&&<button className="action lime" onClick={rematch}>PLAY AGAIN ↗</button>}</div>}
     {game?.phase==='lobby'&&<div className="overlay-interlude lobby-overlay"><div className="interlude-kicker">THE SQUAD IS ASSEMBLING</div>
      <h2>READY TO PARTY?</h2><p>{game.players.length} / 8 players · {game.maxRounds} short games per party</p>
      {isHost?<div className="lobby-ctas"><button onClick={addBot} disabled={game.players.length>=8} className="action dark">+ ADD BOT</button>
       <button className="action lime" onClick={start} disabled={game.players.length<2}>START THE PARTY ↗</button></div>
       :<p className="waiting">WAITING FOR THE HOST TO START...</p>}</div>}
     {!game&&<div className="overlay-interlude"><h2>CONNECTING...</h2><p>Looking for your friend's lobby. Make sure the host is online.</p></div>}
    </div>
    <div className="game-foot"><span className="connection">● {game?'ROOM CONNECTED':'CONNECTING TO HOST'} · WEBRTC</span>
      <button className="minimal" onClick={()=>setShowHelp(v=>!v)}>{showHelp?'HIDE':'SHOW'} CONTROLS (?)</button>
      <button className="minimal" onClick={()=>setSfx(v=>!v)}>SFX {sfx?'ON':'OFF'}</button></div>
    {showHelp&&<div className="help-box">Move with <b>WASD</b>, <b>arrow keys</b>, <b>SPACE to double-jump</b>, or the on-screen controls. Your camera follows your character. You earn party points by placing in each round. The host chooses when to start.</div>}
    <div className="touch-area"><span>MOVE YOUR CHARACTER · JUMP TO DODGE HAZARDS</span><div className="touchpad">{pads.map(([direction,glyph])=><button key={direction} className={'pad '+direction} aria-label={'Move '+direction}
      onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);directions.current.add(direction);updateKeys();}}
      onPointerUp={e=>{e.preventDefault();directions.current.delete(direction);updateKeys();}}
      onPointerCancel={()=>{directions.current.delete(direction);updateKeys();}}>{glyph}</button>)}</div><button className="jump-button" aria-label="Jump or double jump"
       onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setJump(true);}}
       onPointerUp={()=>setJump(false)} onPointerCancel={()=>setJump(false)}>⤒ JUMP</button></div>
   </section>
   <aside className="room-side"><section className="side-card"><div className="side-head"><span>THE PLAYERS</span><span>{game?.players?.length||0}/8</span></div>
    <div className="leaderboard">{scoreboard.map((p,i)=><div className="player-row" key={p.id}>
      <span className="player-place">{String(i+1).padStart(2,'0')}</span><span className="player-face" style={{background:p.color}}>{p.name?.[0]?.toUpperCase()}</span>
      <span className="player-ident"><b>{p.name}{p.id===idRef.current?' (YOU)':''}</b><small>{p.id.startsWith('bot-')?'AI OPPONENT':p.id===game.hostId?'ROOM HOST':'CHALLENGER'}</small></span>
      <span className="player-points">{game?.phase==='lobby'?'—':game?.phase==='podium'?p.points:formatPoints(p.score)}</span>
     </div>)}</div>
   </section>
    <section className="side-card selection"><div className="side-head"><span>THE GAME PLAN</span><span>{game?.round||0}/{game?.maxRounds||5}</span></div>
      <p>12 minigame mechanics × 25 evolving stages. The next round rotates through the 300-challenge lineup.</p>
      {game?.phase==='lobby'&&isHost&&<div className="settings"><label>NUMBER OF GAMES</label>
       <select value={game.maxRounds} onChange={e=>option({maxRounds:e.target.value})}><option value="5">5 GAMES</option><option value="10">10 GAMES</option><option value="20">20 GAMES</option></select>
       <label>FIRST CHALLENGE</label><button className="select-challenge" onClick={()=>setCatalogOpen(true)}>#{String(game.selection+1).padStart(3,'0')} — {preset(game.selection).family.name} ↗</button>
      </div>}
      {game?.phase!=='lobby'&&<div className="progress"><div style={{width:(100*(game?.round||0)/(game?.maxRounds||5))+'%'}}/></div>}
     </section>
     <button className="action lime wide" onClick={copyLink}>COPY INVITE LINK <span>↗</span></button>
     <div className="hint-card"><b>FIND YOUR FRIENDS. OUTRUN THE CHAOS.</b><p>Each match is short. Every point counts. Whoever leads after the final game becomes the party champion.</p></div>
   </aside></div>
  </main>}
  {catalogOpen&&showCatalog&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCatalogOpen(false);}}>
   <section className="catalog-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-heading">
    <div className="catalog-header"><div><span className="small-label">THE COMPLETE LINEUP / 300</span><h2 id="catalog-heading">CHALLENGE <em>VAULT.</em></h2>
     <p>12 distinct minigame types, each with 25 gameplay stage variants.</p></div>
     <button onClick={()=>setCatalogOpen(false)} aria-label="Close challenge catalog" className="close-modal">✕</button></div>
    <div className="catalog-filters"><button className={familyFilter==='all'?'active':''} onClick={()=>setFamilyFilter('all')}>ALL 300</button>
     {GAME_MODES.map((f,i)=><button key={f.slug} className={familyFilter===String(i)?'active':''} onClick={()=>setFamilyFilter(String(i))}>{f.icon} {f.name}</button>)}</div>
    <div className="catalog-grid">{filtered.map(c=><button className="catalog-item" key={c.id}
      onClick={()=>{if(mode==='arena'&&hostRef.current&&gameRef.current?.phase==='lobby')option({selection:c.id});setCatalogOpen(false);}}>
      <span className="challenge-index">#{String(c.number).padStart(3,'0')}</span><span className="catalog-icon">{c.family.icon}</span>
      <b>{c.family.name}</b><small>{c.theme} · {c.course} · STAGE {c.variant+1}/25</small>
     </button>)}</div>
   </section></div>}
  <footer className="footer"><span>DATEWADE.GAMES / FRIENDSHIP IS TEMPORARY. GLORY IS FOREVER.</span><span>MADE FOR THE GROUP CHAT ✦ 2026</span></footer>
 </div>;
}
