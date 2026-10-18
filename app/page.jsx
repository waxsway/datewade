'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import {
 catalog,preset,GAME_MODES,TOTAL_CHALLENGES,COLORS,
 freshRoom,addPlayer,removePlayer,beginParty,setOptions,tick
} from '../lib/party.js';
const Arena3D=dynamic(()=>import('../components/Arena3D.jsx'),{ssr:false,loading:()=> <div className="renderer-loading">INITIALIZING 3D WORLD…</div>});
const APP_ID='com.datewade.partygames.v2.2026';
const codeChars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){const a=new Uint8Array(6);crypto.getRandomValues(a);return [...a].map(v=>codeChars[v%codeChars.length]).join('');}
function send(action,data,peerId){if(!action)return;Promise.resolve(action.send(data,peerId?{target:peerId}:undefined)).catch(()=>{});}
const safeName=value=>String(value||'PLAYER').trim().replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,15)||'PLAYER';
const controlFromKeys=k=>{
 let x=Number(!!(k.d||k.arrowright))-Number(!!(k.a||k.arrowleft)),
 z=Number(!!(k.s||k.arrowdown))-Number(!!(k.w||k.arrowup));
 const len=Math.hypot(x,z)||1;return{x:x/len,z:z/len};
};
function Label({children,number}){return <div className="field-title">{number&&<span>{number}</span>}{children}</div>;}
function Choice({active,children,onClick}){return <button className={'choice'+(active?' selected':'')} onClick={onClick}>{children}</button>;}
function Icon({name}){
 if(name==='arrow')return <span aria-hidden>↗</span>;
 if(name==='copy')return <span aria-hidden>⎘</span>;
 if(name==='users')return <span aria-hidden>♟</span>;
 return <span aria-hidden>✦</span>;
}
export default function DateWadeParty(){
 const [mode,setMode]=useState('home'),[nickname,setNickname]=useState(''),[joinCode,setJoinCode]=useState('');
 const [roomCode,setRoomCode]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false);
 const [game,setGame]=useState(null),[preview,setPreview]=useState(0),[rounds,setRounds]=useState(5);
 const gameRef=useRef(null),roomRef=useRef(null),myId=useRef(''),isHost=useRef(false),
 actions=useRef(null),controls=useRef({}),keys=useRef({}),input=useRef({x:0,z:0}),
 timer=useRef(null),watchdog=useRef(null),joining=useRef(false),viewSeq=useRef(0);
 const store=(next,broadcast=true)=>{
  gameRef.current=next;setGame(next);
  if(broadcast&&isHost.current)send(actions.current?.state,next);
 };
 useEffect(()=>{
  try{
   setNickname(localStorage.getItem('dw-party-name')||'');
   const code=new URLSearchParams(location.search).get('room')?.toUpperCase();
   if(code&&/^[A-Z2-9]{6}$/.test(code))setJoinCode(code);
  }catch{}
  return ()=>{try{roomRef.current?.leave();}catch{}if(timer.current)clearInterval(timer.current);if(watchdog.current)clearTimeout(watchdog.current);};
 },[]);
 const leave=()=>{
  if(timer.current)clearInterval(timer.current);
  if(watchdog.current)clearTimeout(watchdog.current);
  timer.current=null;watchdog.current=null;joining.current=false;
  try{roomRef.current?.leave();}catch{}
  roomRef.current=null;actions.current=null;gameRef.current=null;myId.current='';isHost.current=false;
  keys.current={};input.current={x:0,z:0};controls.current={};setGame(null);setMode('home');setNotice('');
  setPending(false);
  if(typeof window!=='undefined')history.replaceState({},'',location.pathname);
 };
 async function join(create){
  if(pending||joining.current)return;
  const code=create?newCode():joinCode.trim().toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code)){setNotice('PLEASE ENTER A VALID SIX-CHARACTER CODE.');return;}
  joining.current=true;setPending(true);setNotice('');
  let room=null;
  try{
   const {joinRoom,selfId}=await import('trystero');
   const alias=safeName(nickname);
   localStorage.setItem('dw-party-name',alias);
   room=joinRoom({appId:APP_ID},code);
   roomRef.current=room;myId.current=selfId;isHost.current=create;
   const hello=room.makeAction('player-hello'),state=room.makeAction('world-state'),move=room.makeAction('direction');
   actions.current={hello,state,move};
   if(create){const newState=freshRoom(selfId,alias);store(newState,false);setPreview(0);setRounds(5);}
   else {gameRef.current=null;setGame(null);}
   hello.onMessage=(payload,{peerId})=>{
    if(!create||!payload||typeof payload.name!=='string'||typeof peerId!=='string')return;
    const before=gameRef.current;if(!before)return;
    const next=addPlayer(before,peerId,payload.name);store(next);
    send(state,next,peerId);
   };
   state.onMessage=(incoming,{peerId})=>{
    if(create||!incoming||incoming.hostId!==peerId||!Array.isArray(incoming.players)||incoming.players.length>8)return;
    if(!['lobby','countdown','playing','results','podium'].includes(incoming.phase))return;
    gameRef.current=incoming;setGame(incoming);setNotice('');viewSeq.current=incoming.seq||0;
   };
   move.onMessage=(data,{peerId})=>{
    if(!create||!gameRef.current?.players.some(p=>p.id===peerId))return;
    controls.current[peerId]={x:Math.max(-1,Math.min(1,Number(data?.x)||0)),
      z:Math.max(-1,Math.min(1,Number(data?.z)||0))};
   };
   room.onPeerJoin=peerId=>{
    send(hello,{name:alias},peerId);
    if(create&&gameRef.current)send(state,gameRef.current,peerId);
   };
   room.onPeerLeave=peerId=>{
    if(create){
     delete controls.current[peerId];
     if(gameRef.current)store(removePlayer(gameRef.current,peerId));
    }else if(gameRef.current?.hostId===peerId){
     gameRef.current=null;setGame(null);setNotice('THE HOST LEFT THE GAME. HEAD BACK AND CREATE ANOTHER ROOM.');
    }
   };
   if(create){
    let then=performance.now(),networkAccumulator=0;
    timer.current=setInterval(()=>{
     const now=performance.now(),dt=Math.min((now-then)/1000,.12);then=now;
     const g=gameRef.current;if(!g)return;
     controls.current[selfId]=input.current;
     if(g.phase!=='lobby'&&g.phase!=='podium') {
      gameRef.current=tick(g,controls.current,dt);
      networkAccumulator+=dt;
      if(networkAccumulator>=.095||g.phase!==gameRef.current.phase){
       networkAccumulator=0;store(gameRef.current);
      }
     }
    },35);
   }else{
    timer.current=setInterval(()=>send(move,input.current),70);
    watchdog.current=setTimeout(()=>{
     if(!gameRef.current)setNotice('NO HOST FOUND YET. DOUBLE-CHECK THE CODE AND MAKE SURE THE HOST IS ONLINE.');
    },10000);
   }
   setRoomCode(code);setMode('room');
   history.replaceState({},'',location.pathname+'?room='+code);
  }catch(err){
   if(room)try{room.leave();}catch{}
   setNotice('COULD NOT START NETWORK CONNECTION. '+(err?.message||'TRY AGAIN.'));
   roomRef.current=null;actions.current=null;
  }finally{joining.current=false;setPending(false);}
 }
 function setKey(key,on){
  keys.current[key]=on;
  input.current=controlFromKeys(keys.current);
  if(!isHost.current)send(actions.current?.move,input.current);
 }
 useEffect(()=>{
  if(mode!=='room')return;
  const accepted=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
  const keydown=e=>{
   const key=e.key.toLowerCase();
   if(accepted.includes(key)&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
    e.preventDefault();setKey(key,true);
   }
  };
  const keyup=e=>{const key=e.key.toLowerCase();if(accepted.includes(key)){e.preventDefault();setKey(key,false);}};
  const reset=()=>{keys.current={};input.current={x:0,z:0};};
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',reset);
  return ()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',reset);reset();};
 },[mode]);
 function modifyOptions(selected,rds){
  if(!isHost.current||gameRef.current?.phase!=='lobby')return;
  const options=setOptions(gameRef.current,{selection:selected,maxRounds:rds});
  store(options);setPreview(options.selection);setRounds(options.maxRounds);
 }
 function addBot(){
  const g=gameRef.current;
  if(!isHost.current||!g||g.players.length>=8||g.phase!=='lobby')return;
  const name='BOT '+(g.players.filter(p=>p.id.startsWith('bot-')).length+1);
  const id='bot-'+crypto.randomUUID();
  store(addPlayer(g,id,name));
 }
 function begin(){
  const g=gameRef.current;
  if(!isHost.current||!g||g.players.length<2)return;
  store(beginParty(g));
 }
 async function copyInvite(){
  const invite=location.origin+location.pathname+'?room='+roomCode;
  try{await navigator.clipboard.writeText(invite);setNotice('INVITE LINK COPIED ✓');}
  catch{setNotice(invite);}
 }
 const playing=game?.phase==='playing';
 const current=game?preset(game.challenge):preset(preview);
 const own=game?.players?.find(p=>p.id===myId.current);
 const winner=game?.players?.find(p=>p.id===game.winner);
 const champions=game?.players?.slice().sort((a,b)=>b.points-a.points)||[];
 return <div className="shell">
  <header className="masthead"><div className="logotype"><span className="logomark">✳</span>DATEWADE<span className="lime">/</span>PARTY ARENA</div>
   <div className="mastmeta"><span className="alive-dot"/> MULTIPLAYER MAYHEM <span className="edition">/ SEASON 01</span></div>
  </header>
  {mode==='home'?<main className="home">
   <section className="hero-layout">
    <div className="hero-left">
     <div className="eyebrow"><span className="overline-dot"/> THE UNOFFICIAL FRIENDSHIP STRESS TEST · EST. 2026</div>
     <div className="hero-title"><div>WELCOME</div><div>TO THE <span className="outline-type">PARTY</span><span className="accent-punctuation">!</span></div></div>
     <p className="hero-description">One arena. Your best friends. A ridiculous amount of ways to embarrass each other. Fast 3D mini-games, instant rematches, and absolutely no excuses.</p>
     <div className="hero-pills"><span>✳ 2–8 PLAYERS</span><span>◉ THIRD-PERSON 3D</span><span>⚡ 300 CHALLENGE VARIANTS</span></div>
     <div className="hero-actions">
      <div className="setup-card">
       <div className="card-head"><span>01 <b>/</b> JOIN THE CHAOS</span><span className="lite-pill">NO DOWNLOAD</span></div>
       <Label>YOUR LEGENDARY GAMER NAME</Label>
       <input className="main-input" aria-label="Player nickname" maxLength={15} placeholder="What do we call you?" value={nickname} onChange={e=>setNickname(e.target.value)}/>
       <button disabled={pending} className="big-start" onClick={()=>join(true)}>CREATE A PARTY <span>↗</span></button>
       <div className="separator"><span>OR CRASH SOMEONE ELSE'S PARTY</span></div>
       <div className="join-row"><input className="main-input code-input" maxLength={6} aria-label="Six-digit party code" placeholder="6-CHAR CODE" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))} onKeyDown={e=>{if(e.key==='Enter')join(false);}}/><button disabled={pending} onClick={()=>join(false)}>JOIN ↗</button></div>
       {!!notice&&<p className="noticemsg">{notice}</p>}
      </div>
     </div>
    </div>
    <div className="hero-right">
     <div className="poster-header">THE PARTY STARTS HERE <span>↗</span></div>
     <div className="poster-scene">
      <div className="poster-orb"/>
      <div className="poster-grid"/>
      <div className="poster-big">300<span>+</span></div>
      <div className="poster-desc">WAYS TO<br/> LOSE TO YOUR FRIENDS</div>
      <div className="poster-bits">
       <span>💣</span><span>🏁</span><span>☄️</span><span>👑</span>
      </div>
      <div className="poster-stamp">ONE MORE ROUND.<br/>JUST ONE.</div>
     </div>
     <div className="poster-bottom"><span>STUPID GAMES. BRILLIANT NIGHTS.</span><span>◉ ONLINE</span></div>
    </div>
   </section>
   <section className="browse-section">
    <div className="section-heading"><div><div className="eyebrow">A TASTE OF THE CHAOS</div><h2>MEET THE <span>MINI-GAMES.</span></h2></div><span className="catalog-count">12 RULESETS × 25 STAGE VARIANTS = <strong>300</strong> CHALLENGES</span></div>
    <div className="mode-list">{GAME_MODES.slice(0,6).map((m,i)=><div className={'mode-preview palette-'+i} key={m.slug}><span className="mode-n">{String(i+1).padStart(2,'0')}</span><span className="mode-emoji">{m.icon}</span><strong>{m.name}</strong><span>{m.kind.toUpperCase()} ↗</span></div>)}</div>
    <div className="footnote">A rotating catalog of 300 stage-and-rules combinations. Twelve different core game types with 25 variants each — not 300 unique hand-built game types.</div>
   </section>
  </main>:<main className="game-screen">
   <div className="room-toolbar"><button className="leave" onClick={leave}>← EXIT PARTY</button><div className="room-access"><span>INVITE YOUR FRIENDS</span><strong>{roomCode}</strong><button onClick={copyInvite}>COPY LINK ⎘</button></div></div>
   {!!notice&&<p className="noticemsg game-notice">{notice}</p>}
   <div className="game-main">
    <div className="play-column">
     <div className="stage-header">
      <div><span className="stage-small">{game?.phase==='lobby'?'WAITING FOR THE SQUAD':game?'ROUND '+game.round+' / '+game.maxRounds:'SEARCHING FOR THE HOST'}</span>
       <h2>{game?.phase==='lobby'?'THE LOBBY':current.family.name}<span className="tiny-star">✳</span></h2>
       <p>{game?.phase==='lobby'?'Invite your buddies, add bots, and start the show.':current.family.rule}</p>
      </div><div className="stage-timer"><span>{playing?'SECONDS LEFT':game?.phase==='countdown'?'STARTING IN':game?.phase==='results'?'ROUND OVER':game?.phase==='podium'?'CHAMPION':'PARTY SIZE'}</span>
       <b>{game&&['playing','countdown','results'].includes(game.phase)?Math.ceil(game.remaining).toString().padStart(2,'0'):game?.phase==='lobby'?String(game.players.length).padStart(2,'0'):'—'}</b></div>
     </div>
     <div className="arena-viewport">
      <Arena3D game={game} meId={myId.current}/>
      {game?.phase==='lobby'&&<div className="arena-overlay">
       <span className="overlay-kicker">PARTY LOBBY · {game.players.length}/8 CONNECTED</span>
       <h3>GATHER THE<br/><span>CHAOS CREW.</span></h3>
       <p>Ready for short, stupidly competitive 3D mini-games?</p>
       {isHost.current?<div className="arena-actions"><button onClick={addBot} className="light-button" disabled={game.players.length>=8}>+ ADD A BOT</button><button onClick={begin} disabled={game.players.length<2} className="acid-button">START PARTY ↗</button></div>:<span className="wait-note">THE HOST STARTS THE SESSION</span>}
      </div>}
      {!game&&<div className="arena-overlay"><span className="overlay-kicker">SEARCHING FOR HOST</span><h3>CONNECTING<br/><span>THE DOTS.</span></h3><p>The host must keep their browser tab open.</p></div>}
      {game?.phase==='countdown'&&<div className="round-center"><span>ROUND {game.round} · #{String(current.number).padStart(3,'0')}</span><h3>{current.family.name}</h3><b>{Math.ceil(game.remaining)}</b><p>{current.family.rule}</p></div>}
      {game?.phase==='results'&&<div className="round-center results-center"><span>ROUND {game.round} COMPLETE</span><h3>{winner?.name.toUpperCase()||'NOBODY'}<br/>TAKES IT!</h3><p>Scores are in. Prepare for the next round.</p></div>}
      {game?.phase==='podium'&&<div className="round-center results-center"><span>PARTY COMPLETE · FINAL RESULTS</span><h3>🏆 {champions[0]?.name.toUpperCase()}<br/>IS THE CHAMP!</h3><p>Winner earns bragging rights. Everyone else gets excuses.</p>{isHost.current&&<button className="acid-button" onClick={()=>store(setOptions({...gameRef.current,phase:'lobby',round:0,players:gameRef.current.players.map(p=>({...p,points:0,score:0}))},{selection:(game.challenge+1)%300}))}>↻ PLAY AGAIN</button>}</div>}
      {game?.phase==='playing'&&<div className="live-hud"><div className="hud-left"><span className="live-pulse"/> LIVE NOW <b>{current.family.icon} {current.family.name}</b></div><div className="hud-right">SCORE <b>{Math.round(own?.score||0)}</b></div></div>}
      {game?.phase==='playing'&&[6,7].includes(current.mode)&&<div className={'freeze-alert '+(Math.floor(game.elapsed/(current.mode===6?2.9:3.3))%2?'stop-now':'go-now')}>{Math.floor(game.elapsed/(current.mode===6?2.9:3.3))%2?'🛑 FREEZE!':'🟢 MOVE!'}</div>}
      {game?.phase==='playing'&&current.mode===0&&<div className="bomb-alert">{game.bomb===myId.current?'💣 YOU HAVE THE BOMB!':'💣 '+(game.players.find(p=>p.id===game.bomb)?.name||'SOMEONE')+' HAS THE BOMB'}</div>}
      <div className="corner-mark">STAGE #{String(current.number).padStart(3,'0')} · {current.theme}/{current.course}</div>
     </div>
     <div className="under-play"><span><i/> {game?'CONNECTED':'SEARCHING'} · {game?.players?.length||0} PLAYERS</span><span>MOVE: WASD / ARROWS / TOUCH PAD</span></div>
     <div className="touch-controls"><p>DRAG OR HOLD TO MOVE</p><div className="dpad">{['up','left','down','right'].map(direction=><button key={direction} className={'dir '+direction} aria-label={'Move '+direction}
      onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setKey(({up:'w',down:'s',left:'a',right:'d'})[direction],true);}}
      onPointerUp={()=>setKey(({up:'w',down:'s',left:'a',right:'d'})[direction],false)}
      onPointerCancel={()=>setKey(({up:'w',down:'s',left:'a',right:'d'})[direction],false)}
      >{({up:'▲',down:'▼',left:'◀',right:'▶'})[direction]}</button>)}</div></div>
    </div>
    <aside className="game-sidebar">
     <div className="panel"><div className="panel-title"><span>01 / THE SQUAD</span><span>{game?.players?.length||0}/8</span></div>
       <div className="players">{(game?.players||[]).slice().sort((a,b)=>b.points-a.points).map((p,i)=><div className="player-row" key={p.id}>
        <div className="player-icon" style={{background:p.color}}>{p.name.slice(0,1)}</div><div className="player-name"><b>{p.name}{p.id===myId.current?' (YOU)':''}</b><small>{p.id.startsWith('bot-')?'CPU BOT':p.id===game.hostId?'ROOM HOST':'PARTY MEMBER'}</small></div>
        <div className="player-score">{game.phase==='lobby'?'✓':Math.round(p.points)}<small>PTS</small></div>
       </div>)}</div>
       {!game?.players?.length&&<p className="empty-players">WAITING TO CONNECT…</p>}
     </div>
     {game?.phase==='lobby'&&isHost.current&&<div className="panel options-panel"><div className="panel-title"><span>02 / PARTY SETTINGS</span><span>⚙</span></div>
      <Label>HOW MANY ROUNDS?</Label><div className="round-choices">{[5,10,20].map(n=><Choice key={n} active={game.maxRounds===n} onClick={()=>modifyOptions(game.selection,n)}>{n}</Choice>)}</div>
      <Label>START AT CHALLENGE</Label><div className="select-row"><select value={game.selection} onChange={e=>modifyOptions(Number(e.target.value),game.maxRounds)}>
       {catalog.map(c=><option key={c.id} value={c.id}>#{String(c.number).padStart(3,'0')} — {c.name}</option>)}
      </select></div>
      <p className="sidebar-hint">Every round rotates through the catalog. 300 combinations, 12 distinct rule types.</p>
     </div>}
     <div className="panel info-panel"><div className="panel-title"><span>THE CURRENT CHALLENGE</span><span>#{String(current.number).padStart(3,'0')}</span></div>
      <div className="challenge-icon">{current.family.icon}</div>
      <h4>{current.family.name}</h4><p>{current.family.rule}</p>
      <div className="small-details"><span>THEME <b>{current.theme}</b></span><span>COURSE <b>{current.course}</b></span><span>TYPE <b>{current.family.kind.toUpperCase()}</b></span></div>
     </div>
     <button className="invite-button" onClick={copyInvite}>⎘ SHARE INVITE LINK <span>↗</span></button>
    </aside>
   </div>
  </main>}
  <footer><span>DATEWADE PARTY ARENA <b>© 2026</b></span><span>MADE TO TEST YOUR FRIENDSHIPS. <b>NO ACCOUNT REQUIRED.</b></span></footer>
 </div>;
}
