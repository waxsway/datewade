'use client';

import {useEffect, useRef, useState} from 'react';

const WIDTH = 900;
const HEIGHT = 510;
const LIMIT = 8;
const COLORS = ['#d7ff4a','#a88bff','#ff729e','#64dcff','#ffbf69','#81f7cf','#e3a6f5','#ff8c66'];
const APP_ID = 'com.datewade.bombtag.party.2026';
const emptyKeys = () => ({up:false,down:false,left:false,right:false});
const safeName = (name) => String(name || '').trim().slice(0,15) || 'Mystery Guest';
const makePlayer = (id, name, index) => ({
  id, name:safeName(name), x:WIDTH/2 + Math.cos(index * .785) * 165,
  y:HEIGHT/2 + Math.sin(index * .785) * 135, alive:true, wins:0,
  color: COLORS[index % COLORS.length]
});
const initialGame = (id, name) => ({
  phase:'lobby', players:[makePlayer(id,name,0)], carrier:null,
  seconds:16, round:0, cooldown:0, champion:null, hostId:id, event:''
});
const isBot = (id) => id.startsWith('bot-');
const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => chars[b % chars.length]).join('');
};
const safeSend = (action,data,opts) => {
  if (action) Promise.resolve(action.send(data,opts)).catch(() => {});
};
const sample = (array) => array[Math.floor(Math.random()*array.length)];

function startMatch(before) {
  const players = before.players.map((p,i) => ({
    ...p, alive:true, x:WIDTH/2 + Math.cos(i*2*Math.PI/before.players.length)*165,
    y:HEIGHT/2 + Math.sin(i*2*Math.PI/before.players.length)*140
  }));
  return {...before,players,phase:'intermission',round:1,seconds:3,
    carrier:sample(players).id, cooldown:1.2,champion:null,event:'GET READY'};
}
function advanceGame(g, keys, delta, tick) {
  if (g.phase !== 'playing' && g.phase !== 'intermission') return g;
  const dt = Math.min(delta,.1);
  const next = {...g, players:g.players.map(p=>({...p})), seconds:Math.max(0,g.seconds-dt),
    cooldown:Math.max(0,g.cooldown-dt)};
  if (next.phase === 'intermission') {
    if (next.seconds <= 0) {next.phase='playing';next.seconds=16;next.cooldown=1.5;next.event='RUN!';}
    return next;
  }
  next.players.forEach(p => {
    if (!p.alive) return;
    let k = keys[p.id] || emptyKeys();
    if (isBot(p.id)) {
      const holder = next.players.find(other=>other.id===next.carrier);
      const angle = (tick/1050 + p.id.length*1.6);
      const awayX = holder ? p.x - holder.x : 0;
      const awayY = holder ? p.y - holder.y : 0;
      const flee = p.id!==next.carrier && holder && Math.hypot(awayX,awayY)<255;
      let dirX = flee ? awayX : Math.cos(angle)*150 + (holder ? holder.x-p.x:0);
      let dirY = flee ? awayY : Math.sin(angle)*150 + (holder ? holder.y-p.y:0);
      const norm = Math.hypot(dirX,dirY)||1;
      k = {left:dirX/norm<-.3,right:dirX/norm>.3,up:dirY/norm<-.3,down:dirY/norm>.3};
    }
    const vx = Number(k.right)-Number(k.left), vy = Number(k.down)-Number(k.up);
    const length = Math.hypot(vx,vy)||1;
    p.x = Math.max(31,Math.min(WIDTH-31,p.x+vx/length*250*dt));
    p.y = Math.max(31,Math.min(HEIGHT-31,p.y+vy/length*250*dt));
  });
  if (next.cooldown<=0) {
    const hot = next.players.find(p=>p.id===next.carrier);
    if (hot?.alive) {
      const tagged = next.players.filter(p=>p.alive && p.id!==hot.id
        && Math.hypot(p.x-hot.x,p.y-hot.y)<55);
      if(tagged.length) {
        next.carrier=tagged[0].id;
        next.cooldown=1.1;
        next.event=hot.name.toUpperCase()+' PASSED THE BOMB!';
      }
    }
  }
  if (next.seconds<=0) {
    const bombed = next.players.find(p=>p.id===next.carrier);
    if(bombed) bombed.alive=false;
    const survivors = next.players.filter(p=>p.alive);
    if(survivors.length <= 1) {
      const champ = survivors[0];
      if(champ) champ.wins += 1;
      next.phase='champion';next.champion=champ?.id || null;next.carrier=null;
      next.event=champ ? champ.name.toUpperCase()+' WINS!' : 'DRAW!';
    } else {
      next.phase='intermission';next.round += 1;next.seconds=3;
      next.carrier=sample(survivors).id;next.cooldown=1.2;
      next.event=(bombed?.name.toUpperCase()||'SOMEONE')+' EXPLODED!';
    }
  }
  return next;
}

function Icon({kind,size=18}) {
  const paths = {
    bomb:<><circle cx="11" cy="13" r="7"/><path d="m15.5 7.8 2.8-3M17 4l2.8 1.5m-.6-3.5 1.2-1"/></>,
    users:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 6a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/></>,
    link:<><path d="M9 15l6-6M10 6H8a5 5 0 0 0 0 10h2m4-10h2a5 5 0 0 1 0 10h-2"/></>,
    arrow:<path d="M5 12h14m-6-6 6 6-6 6"/>,
    bolt:<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export default function BombTag() {
  const [mode,setMode] = useState('home');
  const [name,setName] = useState('');
  const [roomInput,setRoomInput] = useState('');
  const [roomCode,setRoomCode] = useState('');
  const [game,setGame] = useState(null);
  const [notice,setNotice] = useState('');
  const [connecting,setConnecting] = useState(false);
  const [hostId,setHostId] = useState('');
  const roomRef=useRef(null), actions=useRef(null), myId=useRef(''), hostRef=useRef(false);
  const gameRef=useRef(null), keysRef=useRef({}), heldRef=useRef(emptyKeys());
  const timerRef=useRef(null), joinedRef=useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('bombtag-name');
      if(stored) setName(stored);
      const q = new URLSearchParams(location.search).get('room');
      if(q && /^[A-Z2-9]{6}$/i.test(q)) setRoomInput(q.toUpperCase());
    } catch {}
  },[]);

  function publish(g) {
    gameRef.current = g;
    setGame(g);
    if (hostRef.current) safeSend(actions.current?.state,g);
  }
  function stop() {
    if(timerRef.current) clearInterval(timerRef.current);
    timerRef.current=null;
    try {roomRef.current?.leave();} catch {}
    roomRef.current=null;actions.current=null;joinedRef.current=false;
    hostRef.current=false;keysRef.current={};heldRef.current=emptyKeys();myId.current='';
    gameRef.current=null;setGame(null);setMode('home');setHostId('');
    setConnecting(false);setNotice('');
    if(typeof window!=='undefined') history.replaceState({},'',location.pathname);
  }
  useEffect(()=>()=>{if(timerRef.current) clearInterval(timerRef.current);
    try {roomRef.current?.leave();}catch{}},[]);

  async function connect(creator) {
    if(connecting || joinedRef.current)return;
    const trimmed=safeName(name);
    const code=creator?randomCode():roomInput.toUpperCase().trim();
    if(!creator && !/^[A-Z2-9]{6}$/.test(code)) {setNotice('Enter a six-character room code.');return;}
    setConnecting(true);setNotice('');
    try {
      const {joinRoom,selfId}=await import('trystero');
      localStorage.setItem('bombtag-name',trimmed);
      const room=joinRoom({appId:APP_ID},code);
      roomRef.current=room;myId.current=selfId;hostRef.current=creator;
      const hello=room.makeAction('hello');
      const state=room.makeAction('state');
      const move=room.makeAction('move');
      actions.current={hello,state,move};
      if(creator) {
        const newState=initialGame(selfId,trimmed);
        gameRef.current=newState;setGame(newState);setHostId(selfId);
      } else {
        gameRef.current=null;setGame(null);setHostId('');
      }
      room.onPeerJoin = peerId => {
        safeSend(hello,{name:trimmed,host:creator},{target:peerId});
        if(creator && gameRef.current) safeSend(state,gameRef.current,{target:peerId});
      };
      hello.onMessage = (payload,{peerId}) => {
        if(!payload || typeof payload.name!=='string')return;
        if(!creator) {
          if(payload.host) setHostId(peerId);
          return;
        }
        const current=gameRef.current;
        if(!current || current.players.some(p=>p.id===peerId)) return;
        if(current.players.length>=LIMIT) {safeSend(state,current,{target:peerId});return;}
        const player=makePlayer(peerId,payload.name,current.players.length);
        player.alive=current.phase==='lobby';
        publish({...current,players:[...current.players,player],event:player.name.toUpperCase()+' JOINED'});
      };
      state.onMessage=(incoming,{peerId})=>{
        if(creator || !incoming || incoming.hostId!==peerId || !Array.isArray(incoming.players))return;
        if(incoming.players.length>LIMIT+1) return;
        gameRef.current=incoming;setGame(incoming);setHostId(peerId);setNotice('');
      };
      move.onMessage=(packet,{peerId})=>{
        if(!creator || !packet || !gameRef.current?.players.some(p=>p.id===peerId))return;
        keysRef.current[peerId]={
          up:packet.up===true,down:packet.down===true,
          left:packet.left===true,right:packet.right===true
        };
      };
      room.onPeerLeave=(peerId)=>{
        if(creator) {
          const previous=gameRef.current;
          if(!previous)return;
          const players=previous.players.filter(p=>p.id!==peerId);
          delete keysRef.current[peerId];
          let updated={...previous,players,event:'A PLAYER LEFT'};
          if(previous.carrier===peerId) {
            const alive=players.filter(p=>p.alive);
            updated.carrier=alive.length?sample(alive).id:null;
          }
          if(previous.phase==='playing' && players.filter(p=>p.alive).length<=1) {
            const survivor=players.find(p=>p.alive);
            if(survivor) survivor.wins += 1;
            updated={...updated,phase:'champion',champion:survivor?.id||null,carrier:null,
              event:survivor?.name.toUpperCase()+' WINS!'||'ROUND ENDED'};
          }
          publish(updated);
        } else if(peerId===gameRef.current?.hostId) {
          gameRef.current=null;setGame(null);setHostId('');
          setNotice('Host disconnected. Return home to start another room.');
        }
      };
      if(creator) {
        let last=performance.now(),broadcast=0;
        timerRef.current=setInterval(()=>{
          const now=performance.now(), dt=Math.min((now-last)/1000,.12);
          last=now;
          const current=gameRef.current;
          if(!current)return;
          keysRef.current[selfId]=heldRef.current;
          if(current.phase==='playing'||current.phase==='intermission') {
            gameRef.current=advanceGame(current,keysRef.current,dt,now);
            broadcast+=dt;
            if(broadcast>=.09){broadcast=0;publish(gameRef.current);}
          }
        },35);
      } else {
        timerRef.current=setInterval(()=>{
          safeSend(actions.current?.move,heldRef.current);
        },90);
      }
      joinedRef.current=true;setRoomCode(code);setMode('room');
      history.replaceState({},'',location.pathname+'?room='+code);
    } catch(error) {
      setNotice('Could not open room. Please try again. '+(error?.message||''));
      try{roomRef.current?.leave();}catch{}
      roomRef.current=null;
    } finally {setConnecting(false);}
  }
  function start() {
    if(!hostRef.current || !gameRef.current || gameRef.current.players.length<2) return;
    publish(startMatch(gameRef.current));
  }
  function addBot() {
    if(!hostRef.current || !gameRef.current || gameRef.current.phase!=='lobby')return;
    const s=gameRef.current;if(s.players.length>=LIMIT)return;
    const id='bot-'+Date.now().toString(36)+'-'+s.players.length;
    const bot=makePlayer(id,'BOT '+(s.players.filter(p=>isBot(p.id)).length+1),s.players.length);
    publish({...s,players:[...s.players,bot],event:'BOT JOINED THE CHAOS'});
  }
  function setDirection(dir,down) {
    heldRef.current={...heldRef.current,[dir]:down};
    if(!hostRef.current) safeSend(actions.current?.move,heldRef.current);
  }
  useEffect(()=>{
    if(mode!=='room')return;
    const keyMap={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
    const onKey=e=>{
      if(['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
      const dir=keyMap[e.key.toLowerCase()];
      if(dir){e.preventDefault();setDirection(dir,true);}
    };
    const onUp=e=>{const dir=keyMap[e.key.toLowerCase()];if(dir){e.preventDefault();setDirection(dir,false);}};
    const onBlur=()=>{heldRef.current=emptyKeys();};
    window.addEventListener('keydown',onKey);window.addEventListener('keyup',onUp);window.addEventListener('blur',onBlur);
    return ()=>{window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onUp);window.removeEventListener('blur',onBlur);};
  },[mode]);
  async function copyRoom(){
    const link=location.origin+location.pathname+'?room='+roomCode;
    try {await navigator.clipboard.writeText(link);setNotice('Invite link copied!');}
    catch{setNotice(link);}
  }

  const players=game?.players||[];
  const me=players.find(p=>p.id===myId.current);
  const champion=players.find(p=>p.id===game?.champion);
  const carrier=players.find(p=>p.id===game?.carrier);
  const playing=game?.phase==='playing';
  const color=me?.color || COLORS[0];
  return <div className="site">
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><Icon kind="bomb" size={19}/></span><span>DATEWADE<span className="brand-dot">.</span>GAMES</span></div>
      <div className="header-right"><span className="online-dot"/> NO DOWNLOADS. ALL CHAOS.</div>
    </header>
    {mode==='home' ? <main className="landing">
      <section className="hero">
        <div className="eyebrow"><span className="status-pip"/> THE FRIENDSHIP-ENDING PARTY GAME <span className="index">/ 001</span></div>
        <div className="hero-art" aria-hidden="true"><div className="bomb-outline">✹</div><div className="danger-ring"/></div>
        <div className="hero-copy"><div className="hero-kicker">YOUR FRIENDS. ONE BOMB. ZERO TRUST.</div>
          <h1>BOMB<span>TAG</span><b>!</b></h1>
          <p>One ticking bomb. One very unlucky friend. Tag someone to pass it before the clock hits zero. Last player standing wins.</p>
          <div className="hero-stats"><span><Icon kind="users"/> 2–8 PLAYERS</span><span><Icon kind="bolt"/> QUICK-FIRE ROUNDS</span><span>⚡ NO SIGN-UP</span></div>
        </div>
      </section>
      <section className="entry-wrap">
        <div className="entry-card">
          <div className="card-head"><span>01 / THE SETUP</span><span className="badge-hot">LET'S PLAY</span></div>
          <label htmlFor="playerName" className="field-label">WHAT SHOULD WE CALL YOU?</label>
          <input id="playerName" className="field" maxLength={15} placeholder="Your extremely cool name" value={name} onChange={e=>setName(e.target.value)} />
          <div className="entry-actions"><button className="button primary" disabled={connecting} onClick={()=>connect(true)}>CREATE A ROOM <Icon kind="arrow"/></button>
            <div className="or">OR JOIN THE GANG</div>
            <div className="join"><input className="field code-field" aria-label="Room code" maxLength={6} placeholder="ROOM CODE" value={roomInput} onChange={e=>setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))} onKeyDown={e=>{if(e.key==='Enter')connect(false);}}/><button className="button secondary" disabled={connecting} onClick={()=>connect(false)}>JOIN <Icon kind="arrow"/></button></div>
          </div>
          {notice && <p className="notice" role="status">{notice}</p>}
          <div className="card-foot"><span className="green-dot"/> HOST A PRIVATE ROOM AND SHARE THE LINK WITH YOUR FRIENDS.</div>
        </div>
        <div className="how-card">
          <div className="card-head"><span>02 / THE RULES</span><span>IT'S PERSONAL</span></div>
          <div className="rule"><strong>01</strong><div><b>GET THE BOMB</b><p>One player starts each round holding a very bad surprise.</p></div></div>
          <div className="rule"><strong>02</strong><div><b>PASS THE PROBLEM</b><p>Run into another player to make it their problem. Fast.</p></div></div>
          <div className="rule"><strong>03</strong><div><b>DON'T EXPLODE</b><p>Whoever has it at zero gets eliminated. Last survivor wins.</p></div></div>
          <div className="how-bottom">WASD / ARROW KEYS / TOUCH CONTROLS</div>
        </div>
      </section>
      <div className="marquee"><div>FRIENDLY FIRE IS A LOVE LANGUAGE <span>✹</span> PASS THE BOMB <span>✹</span> TRUST NO ONE <span>✹</span> FRIENDLY FIRE IS A LOVE LANGUAGE <span>✹</span> PASS THE BOMB <span>✹</span></div></div>
    </main> : <main className="room-page">
      <div className="room-nav"><button className="text-button" onClick={stop}>← LEAVE GAME</button><div className="room-code"><small>YOUR ROOM</small><b>{roomCode}</b><button onClick={copyRoom} aria-label="Copy invite link" title="Copy invite link"><Icon kind="link"/></button></div></div>
      {notice && <p className="notice floating" role="status">{notice}</p>}
      <div className="game-grid">
        <div className="arena-column">
          <div className="game-head"><div><span className="eyebrow-mini">THE ARENA / NO MERCY</span><h2>BOMB<span>TAG!</span></h2></div><div className={'clock '+(playing && game.seconds<5?'urgent':'')}><small>{game?.phase==='intermission'?'NEXT ROUND':playing?'TIME LEFT':'STATUS'}</small><strong>{playing || game?.phase==='intermission'?Math.ceil(game.seconds).toString().padStart(2,'0'):game?.phase==='champion'?'GG':'--'}<span>{playing?'S':''}</span></strong></div></div>
          <div className="arena" style={{'--my-color':color}}>
            <div className="arena-lines" aria-hidden="true"/>
            {!game ? <div className="arena-overlay"><div className="huge-icon">◎</div><h3>LOOKING FOR HOST</h3><p>Connecting to your friend's game. Make sure they're online.</p></div> : <>
              {players.map(p=><div className={'player '+(!p.alive?'out':'')+(p.id===game.carrier?' is-bomb':'')+(p.id===myId.current?' is-me':'')} key={p.id}
                style={{left:(p.x/WIDTH*100)+'%',top:(p.y/HEIGHT*100)+'%','--player-color':p.color}}>
                <div className="player-body"><span>{p.id===game.carrier?'💣':p.name.slice(0,1).toUpperCase()}</span></div><div className="player-label">{p.id===myId.current?'YOU':p.name}</div>
              </div>)}
              {game.phase==='lobby' && <div className="arena-overlay"><div className="huge-icon">✹</div><h3>ASSEMBLE THE SQUAD</h3><p>{players.length} / {LIMIT} players connected. Invite friends or add bots.</p>{hostRef.current && <div className="overlay-actions"><button className="button secondary" onClick={addBot} disabled={players.length>=LIMIT}>+ ADD BOT</button><button className="button primary" disabled={players.length<2} onClick={start}>START GAME <Icon kind="arrow"/></button></div>}{!hostRef.current && <p className="subnote">Waiting for the host to start...</p>}</div>}
              {game.phase==='intermission' && <div className="round-flash"><small>ROUND {game.round}</small><strong>{game.round===1?'GET READY':'NEXT UP'}</strong><span>{Math.ceil(game.seconds)}</span></div>}
              {game.phase==='champion' && <div className="arena-overlay winner"><div className="huge-icon">🏆</div><h3>{champion ? champion.name.toUpperCase()+' WINS!' : 'DRAW!'}</h3><p>Friendships have been tested. Some did not survive.</p>{hostRef.current && <button className="button primary" onClick={start}>PLAY AGAIN <Icon kind="arrow"/></button>}{!hostRef.current && <p className="subnote">Waiting for host to rematch...</p>}</div>}
            </>}
            {playing && <div className="arena-banner">{carrier?.id===myId.current?'YOU HAVE THE BOMB — TAG SOMEONE!':carrier?carrier.name.toUpperCase()+' HAS THE BOMB':'RUN!'}</div>}
            <div className="arena-coordinates">ARENA_001 // {game?.round?('ROUND '+game.round):'LOBBY'}</div>
          </div>
          <div className="under-arena"><span><span className="green-dot"/> {roomCode} · {game?'CONNECTED':'CONNECTING'}</span><span>{playing?'DON’T STOP MOVING':'WASD OR ARROWS TO MOVE'}</span></div>
          <div className="mobile-controls" aria-label="Touch movement controls"><div className="d-pad">
            {['up','left','down','right'].map(dir=><button key={dir} className={'pad '+dir} aria-label={'Move '+dir} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setDirection(dir,true);}} onPointerUp={e=>{e.preventDefault();setDirection(dir,false);}} onPointerCancel={()=>setDirection(dir,false)}>{({up:'▲',down:'▼',left:'◀',right:'▶'})[dir]}</button>)}
          </div><span>HOLD TO MOVE</span></div>
        </div>
        <aside className="sidebar"><div className="sidebar-card"><div className="card-head"><span>THE SUSPECTS</span><span>{players.length} / {LIMIT}</span></div>
          {players.length ? <div className="roster">{players.map(p=><div key={p.id} className={'roster-row '+(!p.alive?'eliminated':'')}><span className="roster-avatar" style={{background:p.color}}>{p.name[0]?.toUpperCase()}</span><div><b>{p.name}{p.id===myId.current?' (YOU)':''}</b><small>{!p.alive?'ELIMINATED':game?.carrier===p.id?'💣 HOLDING BOMB':isBot(p.id)?'BOT':'IN THE GAME'}</small></div><span className="wins">{p.wins?('🏆 '+p.wins):'—'}</span></div>)}</div> : <p className="sidebar-empty">Waiting for players...</p>}
        </div><div className="sidebar-card tip-card"><div className="card-head"><span>MISSION CONTROL</span><span>↗</span></div><h4>PASS THE PROBLEM.</h4><p>Run into another player to pass the bomb. You have a brief safety window after tagging.</p><div className="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>OR</span><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div>
        <button className="share-button" onClick={copyRoom}><Icon kind="link"/> COPY INVITE LINK <Icon kind="arrow"/></button></aside>
      </div>
    </main>}
    <footer>MADE FOR FRIENDS, ENEMIES & EVERYONE IN BETWEEN. <strong>DATEWADE.COM © 2026</strong></footer>
  </div>;
}
