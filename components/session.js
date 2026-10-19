// A Session is one player's connection to a game. The host runs the real
// simulation; everyone else predicts their own movement and interpolates the rest.

import { Match, phaseAllowsMove, ZONE_START_RADIUS } from '../lib/sim.js';
import { MAPS } from '../lib/maps.js';
import { moveBody, copyBody } from '../lib/physics.js';
import { statsFromCards } from '../lib/cards.js';
import { TICK, SNAPSHOT_EVERY, BOT_NAMES, PLAYER_COLORS, MAX_PLAYERS, PLAYER_R } from '../lib/constants.js';
import { createNet } from '../lib/net.js';
import { Renderer } from './renderer.js';
import { play, unlockAudio } from './sfx.js';

const INTERP_DELAY = 0.1;

function clampUnit(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) {
    d -= Math.PI * 2;
  }
  while (d < -Math.PI) {
    d += Math.PI * 2;
  }
  return a + d * t;
}

// Worker-driven timer so the host keeps simulating when its tab is in the background.
function makeTicker(fn) {
  let worker = null;
  let interval = null;
  try {
    const src = 'let id=null;onmessage=(e)=>{if(e.data==="start"){id=setInterval(()=>postMessage(0),8);}else{clearInterval(id);}};';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = fn;
    worker.postMessage('start');
  } catch (err) {
    worker = null;
    interval = setInterval(fn, 8);
  }
  return () => {
    if (worker) {
      worker.postMessage('stop');
      worker.terminate();
    }
    if (interval) {
      clearInterval(interval);
    }
  };
}

export class Session {
  constructor(opts) {
    this.kind = opts.kind; // 'host' | 'join' | 'practice'
    this.code = opts.code;
    this.name = opts.name;
    this.color = opts.color;
    this.netKind = opts.netKind;
    this.onUi = opts.onUi;
    this.isHost = opts.kind !== 'join';
    this.net = null;
    this.selfId = '';
    this.match = null;
    this.meta = null;
    this.hostId = '';
    this.notice = '';
    this.ended = '';
    this.disposed = false;

    // input
    this.keys = new Set();
    this.mouse = { cx: 0, cy: 0, down: false, inside: false };
    this.dashQueued = false;
    this.reloadQueued = false;

    // client prediction
    this.snaps = [];
    this.timeOffset = null;
    this.pendingEvents = [];
    this.pred = null;
    this.history = [];
    this.seq = 0;
    this.outgoing = [];
    this.renderOffset = { x: 0, y: 0 };
    this.clientAcc = 0;
    this.localShotAt = -1;
    this.localAmmo = 0;
    this.waitReload = false;
    this.sawReload = false;
    this.lastRound = -1;

    // host loop
    this.hostAcc = 0;
    this.lastHostTime = 0;
    this.tickCount = 0;
    this.prevPos = new Map();
    this.lastStepAt = 0;
    this.lastMetaSent = 0;
    this.lastMetaTime = 0;

    this.killfeed = [];
    this.banner = null;
    this.lastUi = 0;
    this.renderer = null;
    this.raf = 0;
    this.stopTicker = null;
  }

  async start(canvas) {
    this.renderer = new Renderer(canvas);
    this.net = await createNet(this.netKind, this.code);
    if (this.disposed) {
      this.net.leave();
      return;
    }
    this.selfId = this.net.selfId;

    if (this.isHost) {
      this.match = new Match(Math.floor(Math.random() * 1e9));
      this.match.addPlayer(this.selfId, this.name, this.color, false);
      this.hostId = this.selfId;
      if (this.kind === 'practice') {
        this.addBot();
        this.addBot();
        this.addBot();
      }
      this.net.on('hi', (data, peerId) => this.onHello(data, peerId));
      this.net.on('in', (data, peerId) => this.onRemoteInput(data, peerId));
      this.net.on('pick', (data, peerId) => {
        if (data && typeof data.card === 'string') {
          this.match.pick(peerId, data.card);
        }
      });
      this.net.onPeerJoin = (peerId) => {
        this.sendMeta(peerId);
      };
      this.net.onPeerLeave = (peerId) => {
        this.match.removePlayer(peerId);
      };
      this.lastHostTime = performance.now();
      this.lastStepAt = this.lastHostTime;
      this.stopTicker = makeTicker(() => this.hostTick());
    } else {
      this.net.on('meta', (data, peerId) => this.onMeta(data, peerId));
      this.net.on('snap', (data, peerId) => this.onSnap(data, peerId));
      this.net.on('full', () => {
        this.ended = 'That room is full (8 players max).';
        this.pushUi(true);
      });
      this.net.onPeerJoin = (peerId) => {
        this.net.send('hi', { name: this.name, color: this.color }, peerId);
      };
      this.net.onPeerLeave = (peerId) => {
        if (peerId === this.hostId) {
          this.ended = 'The host left the game.';
          this.pushUi(true);
        }
      };
      this.notice = 'Connecting to room ' + this.code + '...';
    }

    this.attachInput(canvas);
    let last = performance.now();
    const frame = (now) => {
      if (this.disposed) {
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.frame(now, dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
    this.pushUi(true);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.stopTicker) {
      this.stopTicker();
    }
    if (this.detachInput) {
      this.detachInput();
    }
    if (this.net) {
      this.net.leave();
    }
  }

  // ------------------------------------------------------------ input

  attachInput(canvas) {
    const down = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }
      const k = e.code;
      if (k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') {
        if (!e.repeat) {
          this.dashQueued = true;
        }
        e.preventDefault();
      }
      if (k === 'KeyR' && !e.repeat) {
        this.reloadQueued = true;
      }
      if (k.startsWith('Arrow') || k === 'Tab') {
        e.preventDefault();
      }
      this.keys.add(k);
      if (this.onKey) {
        this.onKey(e);
      }
    };
    const up = (e) => {
      this.keys.delete(e.code);
    };
    const move = (e) => {
      this.mouse.cx = e.clientX;
      this.mouse.cy = e.clientY;
      this.mouse.inside = true;
    };
    const mdown = (e) => {
      unlockAudio();
      if (e.button === 0 && e.target === canvas) {
        this.mouse.down = true;
      }
      if (e.button === 2 && e.target === canvas) {
        this.dashQueued = true;
      }
    };
    const mup = (e) => {
      if (e.button === 0) {
        this.mouse.down = false;
      }
    };
    const blur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
    const ctxmenu = (e) => {
      if (e.target === canvas) {
        e.preventDefault();
      }
    };
    const resize = () => {
      this.renderer.resize();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', mdown);
    window.addEventListener('mouseup', mup);
    window.addEventListener('blur', blur);
    window.addEventListener('contextmenu', ctxmenu);
    window.addEventListener('resize', resize);
    this.detachInput = () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', mdown);
      window.removeEventListener('mouseup', mup);
      window.removeEventListener('blur', blur);
      window.removeEventListener('contextmenu', ctxmenu);
      window.removeEventListener('resize', resize);
    };
  }

  readInput(fromX, fromY) {
    let mx = 0;
    let my = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) {
      mx -= 1;
    }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) {
      mx += 1;
    }
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      my -= 1;
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      my += 1;
    }
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
    const world = this.renderer.screenToWorld(this.mouse.cx, this.mouse.cy);
    const a = Math.atan2(world.y - fromY, world.x - fromX);
    const inp = {
      s: 0,
      mx: Math.round(mx * 100) / 100,
      my: Math.round(my * 100) / 100,
      a: Math.round(a * 100) / 100,
      f: this.mouse.down,
      d: this.dashQueued,
      r: this.reloadQueued
    };
    this.dashQueued = false;
    this.reloadQueued = false;
    return inp;
  }

  // ------------------------------------------------------------ host

  onHello(data, peerId) {
    if (!data || typeof data.name !== 'string') {
      return;
    }
    const name = data.name.trim().slice(0, 14) || 'Player';
    let color = '';
    if (typeof data.color === 'string') {
      color = data.color;
    }
    const p = this.match.addPlayer(peerId, name, color, false);
    if (!p) {
      this.net.send('full', {}, peerId);
      return;
    }
    this.sendMeta(peerId);
  }

  onRemoteInput(data, peerId) {
    if (!Array.isArray(data)) {
      return;
    }
    const list = [];
    for (const raw of data.slice(0, 12)) {
      if (!Array.isArray(raw)) {
        continue;
      }
      let a = Number(raw[3]);
      if (!Number.isFinite(a)) {
        a = 0;
      }
      list.push({
        s: Math.max(0, Math.floor(Number(raw[0]) || 0)),
        mx: clampUnit(raw[1]),
        my: clampUnit(raw[2]),
        a,
        f: raw[4] === 1,
        d: raw[5] === 1,
        r: raw[6] === 1
      });
    }
    this.match.pushInputs(peerId, list);
  }

  sendMeta(target) {
    const meta = this.match.meta();
    meta.hostId = this.selfId;
    meta.code = this.code;
    this.net.send('meta', meta, target);
  }

  hostTick() {
    if (this.disposed) {
      return;
    }
    const now = performance.now();
    this.hostAcc += (now - this.lastHostTime) / 1000;
    this.lastHostTime = now;
    if (this.hostAcc > TICK * 10) {
      this.hostAcc = TICK * 10;
    }
    while (this.hostAcc >= TICK) {
      this.hostAcc -= TICK;
      this.hostStep();
    }
  }

  hostStep() {
    const m = this.match;
    const me = m.players.get(this.selfId);
    if (me) {
      const inp = this.readInput(me.body.x, me.body.y);
      m.pushInputs(this.selfId, [inp]);
    }
    this.prevPos.clear();
    for (const p of m.players.values()) {
      this.prevPos.set(p.id, { x: p.body.x, y: p.body.y, aim: p.aim });
    }
    for (const b of m.bullets) {
      this.prevPos.set('b' + b.id, { x: b.x, y: b.y });
    }
    const prevPhase = m.phase;
    const prevCount = Math.ceil(m.phaseT);
    m.step();
    this.lastStepAt = performance.now();
    this.tickCount += 1;
    if (m.phase === 'countdown' && (prevPhase !== 'countdown' || Math.ceil(m.phaseT) !== prevCount)) {
      play('beep');
    }

    if (this.tickCount % SNAPSHOT_EVERY === 0) {
      const snap = m.snapshot();
      const events = m.drainEvents();
      snap.e = events;
      this.net.send('snap', snap);
      for (const e of events) {
        this.localEvent(e);
      }
    }
    const now = performance.now();
    if (m.metaVersion !== this.lastMetaSent || now - this.lastMetaTime > 1500) {
      if (m.metaVersion !== this.lastMetaSent) {
        this.meta = m.meta();
        this.meta.hostId = this.selfId;
        this.meta.code = this.code;
        this.pushUi(true);
      }
      this.lastMetaSent = m.metaVersion;
      this.lastMetaTime = now;
      this.sendMeta();
    }
  }

  // host controls
  startMatch() {
    if (!this.isHost) {
      return;
    }
    this.match.startMatch();
  }

  addBot() {
    if (!this.isHost || this.match.players.size >= MAX_PLAYERS) {
      return;
    }
    const used = new Set();
    for (const p of this.match.players.values()) {
      used.add(p.name);
    }
    let name = BOT_NAMES.find((n) => !used.has(n));
    if (!name) {
      name = 'Bot ' + this.match.players.size;
    }
    const id = 'bot-' + Math.random().toString(36).slice(2, 8);
    this.match.addPlayer(id, name, '', true);
  }

  removeBot() {
    if (!this.isHost) {
      return;
    }
    let last = null;
    for (const p of this.match.players.values()) {
      if (p.bot) {
        last = p;
      }
    }
    if (last) {
      this.match.removePlayer(last.id);
    }
  }

  kick(id) {
    if (!this.isHost || id === this.selfId) {
      return;
    }
    this.match.removePlayer(id);
  }

  setRounds(n) {
    if (this.isHost) {
      this.match.setSetting('roundsToWin', n);
    }
  }

  backToLobby() {
    if (this.isHost) {
      this.match.backToLobby();
    }
  }

  pick(cardId) {
    play('card');
    if (this.isHost) {
      this.match.pick(this.selfId, cardId);
    } else {
      this.net.send('pick', { card: cardId }, this.hostId);
    }
  }

  // ------------------------------------------------------------ client

  onMeta(data, peerId) {
    if (!data || !Array.isArray(data.players)) {
      return;
    }
    if (data.hostId !== peerId) {
      return;
    }
    if (this.hostId && this.hostId !== peerId) {
      return;
    }
    this.hostId = peerId;
    const fresh = !this.meta;
    this.meta = data;
    if (fresh) {
      this.notice = '';
    }
    const inRoom = data.players.some((p) => p.id === this.selfId);
    if (!inRoom && !this.ended) {
      this.net.send('hi', { name: this.name, color: this.color }, peerId);
    }
    this.pushUi(true);
  }

  onSnap(snap, peerId) {
    if (peerId !== this.hostId || !snap || !Array.isArray(snap.p)) {
      return;
    }
    const nowS = performance.now() / 1000;
    const est = snap.t - nowS;
    if (this.timeOffset === null || Math.abs(est - this.timeOffset) > 1) {
      this.timeOffset = est;
    } else if (est > this.timeOffset) {
      this.timeOffset += (est - this.timeOffset) * 0.2;
    } else {
      this.timeOffset += (est - this.timeOffset) * 0.02;
    }
    this.snaps.push(snap);
    if (this.snaps.length > 40) {
      this.snaps.shift();
    }
    if (Array.isArray(snap.e)) {
      for (const e of snap.e) {
        this.pendingEvents.push({ t: snap.t, e });
      }
    }
    this.reconcile(snap);
  }

  myStats() {
    if (this.meta) {
      const me = this.meta.players.find((p) => p.id === this.selfId);
      if (me && me.stats) {
        return me.stats;
      }
    }
    return statsFromCards([]);
  }

  reconcile(snap) {
    const row = snap.p.find((r) => r[0] === this.selfId);
    if (!row) {
      this.pred = null;
      return;
    }
    const server = {
      x: row[1],
      y: row[2],
      kvx: row[11],
      kvy: row[12],
      dashT: row[13],
      dashVx: row[14],
      dashVy: row[15],
      dashCd: row[9]
    };
    const lastSeq = row[10];
    this.history = this.history.filter((h) => h.s > lastSeq);

    // local ammo tracking for instant shot feedback
    const reload = row[8];
    if (!this.waitReload && reload >= 0) {
      this.waitReload = true;
      this.sawReload = true;
    }
    if (this.waitReload && reload >= 0) {
      this.sawReload = true;
    }
    if (this.waitReload && this.sawReload && reload < 0) {
      this.waitReload = false;
      this.sawReload = false;
      this.localAmmo = row[7];
    }

    if (row[5] !== 1 || snap.ph === 'countdown' || snap.ph === 'upgrade' || snap.ph === 'lobby') {
      this.pred = copyBody(server);
      this.renderOffset.x = 0;
      this.renderOffset.y = 0;
      this.history = [];
      if (snap.ph === 'countdown') {
        this.localAmmo = this.myStats().magSize;
        this.waitReload = false;
        this.sawReload = false;
      }
      return;
    }
    const walls = MAPS[this.mapIndex()].walls;
    const stats = this.myStats();
    const canMove = phaseAllowsMove(snap.ph);
    const replay = copyBody(server);
    for (const h of this.history) {
      moveBody(replay, h, stats, TICK, walls, canMove);
    }
    if (this.pred) {
      this.renderOffset.x += this.pred.x - replay.x;
      this.renderOffset.y += this.pred.y - replay.y;
      if (Math.hypot(this.renderOffset.x, this.renderOffset.y) > 90) {
        this.renderOffset.x = 0;
        this.renderOffset.y = 0;
      }
    }
    this.pred = replay;
  }

  mapIndex() {
    if (this.meta) {
      return this.meta.mapIndex;
    }
    return 0;
  }

  latestSnap() {
    if (this.snaps.length === 0) {
      return null;
    }
    return this.snaps[this.snaps.length - 1];
  }

  clientStep() {
    const snap = this.latestSnap();
    if (!snap || !this.hostId) {
      return;
    }
    let fromX = 0;
    let fromY = 0;
    if (this.pred) {
      fromX = this.pred.x;
      fromY = this.pred.y;
    }
    const inp = this.readInput(fromX, fromY);
    this.seq += 1;
    inp.s = this.seq;
    const canMove = phaseAllowsMove(snap.ph);
    const row = snap.p.find((r) => r[0] === this.selfId);
    const alive = row && row[5] === 1;
    if (this.pred && alive) {
      const stats = this.myStats();
      moveBody(this.pred, inp, stats, TICK, MAPS[this.mapIndex()].walls, canMove);
      this.history.push({ s: inp.s, mx: inp.mx, my: inp.my, a: inp.a, d: inp.d });
      if (this.history.length > 120) {
        this.history.shift();
      }
      this.predictShot(inp, snap, stats);
    }
    let fire = 0;
    if (inp.f) {
      fire = 1;
    }
    let dash = 0;
    if (inp.d) {
      dash = 1;
    }
    let reload = 0;
    if (inp.r) {
      reload = 1;
    }
    this.outgoing.push([inp.s, inp.mx, inp.my, inp.a, fire, dash, reload]);
    if (this.outgoing.length >= 2) {
      this.net.send('in', this.outgoing, this.hostId);
      this.outgoing = [];
    }
  }

  predictShot(inp, snap, stats) {
    if (snap.ph !== 'fight' || !inp.f || this.waitReload) {
      return;
    }
    const now = performance.now() / 1000;
    if (now - this.localShotAt < stats.fireDelay) {
      return;
    }
    if (this.localAmmo <= 0) {
      return;
    }
    this.localShotAt = now;
    this.localAmmo -= 1;
    if (this.localAmmo <= 0) {
      this.waitReload = true;
      this.sawReload = false;
    }
    const x = this.pred.x + Math.cos(inp.a) * (PLAYER_R + 12);
    const y = this.pred.y + Math.sin(inp.a) * (PLAYER_R + 12);
    this.localEvent(['s', this.selfId, x, y, inp.a, stats.damage], true);
  }

  // ------------------------------------------------------------ views

  infoLookup(players) {
    const metaById = new Map();
    if (this.meta) {
      for (const p of this.meta.players) {
        metaById.set(p.id, p);
      }
    }
    const posById = new Map();
    for (const p of players) {
      posById.set(p.id, p);
    }
    return {
      meId: this.selfId,
      byId: (id) => {
        const m = metaById.get(id);
        const pos = posById.get(id);
        if (!m && !pos) {
          return null;
        }
        let color = '#ffffff';
        let name = '?';
        if (m) {
          color = m.color;
          name = m.name;
        }
        let x = 0;
        let y = 0;
        if (pos) {
          x = pos.x;
          y = pos.y;
        }
        return { color, name, x, y };
      }
    };
  }

  metaPlayer(id) {
    if (!this.meta) {
      return null;
    }
    return this.meta.players.find((p) => p.id === id) || null;
  }

  slotColor() {
    const bySlot = new Map();
    if (this.meta) {
      for (const p of this.meta.players) {
        bySlot.set(p.slot, p.color);
      }
    }
    return (slot) => {
      const c = bySlot.get(slot);
      if (c) {
        return c;
      }
      return PLAYER_COLORS[slot % PLAYER_COLORS.length];
    };
  }

  hostView() {
    const m = this.match;
    const alpha = Math.max(0, Math.min(1, (performance.now() - this.lastStepAt) / 1000 / TICK));
    const players = [];
    for (const p of m.players.values()) {
      const prev = this.prevPos.get(p.id);
      let x = p.body.x;
      let y = p.body.y;
      let aim = p.aim;
      if (prev) {
        x = lerp(prev.x, p.body.x, alpha);
        y = lerp(prev.y, p.body.y, alpha);
        aim = lerpAngle(prev.aim, p.aim, alpha);
      }
      let reload = -1;
      if (p.reloadT > 0) {
        reload = 1 - p.reloadT / p.stats.reloadTime;
      }
      players.push({
        id: p.id,
        name: p.name,
        color: p.color,
        x,
        y,
        aim,
        hp: p.hp,
        maxHp: p.stats.maxHp,
        alive: p.alive,
        invuln: p.invulnT > 0,
        dashing: p.body.dashT > 0,
        reload,
        ammo: p.ammo,
        mag: p.stats.magSize,
        dashCd: p.body.dashCd,
        dashMax: p.stats.dashCooldown
      });
    }
    const bullets = [];
    for (const b of m.bullets) {
      const prev = this.prevPos.get('b' + b.id);
      let x = b.x;
      let y = b.y;
      if (prev) {
        x = lerp(prev.x, b.x, alpha);
        y = lerp(prev.y, b.y, alpha);
      }
      bullets.push({ id: b.id, x, y, vx: b.vx, vy: b.vy, r: b.r, slot: b.slot });
    }
    return {
      phase: m.phase,
      phaseT: m.phaseT,
      roundT: m.roundT,
      zoneR: m.zoneR,
      mapIndex: m.mapIndex,
      players,
      bullets
    };
  }

  clientView() {
    const latest = this.latestSnap();
    if (!latest || !this.meta) {
      return null;
    }
    const renderT = performance.now() / 1000 + this.timeOffset - INTERP_DELAY;
    let a = null;
    let b = null;
    for (let i = this.snaps.length - 1; i > 0; i -= 1) {
      if (this.snaps[i - 1].t <= renderT && this.snaps[i].t >= renderT) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    }
    if (!a) {
      if (this.snaps.length > 0 && renderT < this.snaps[0].t) {
        a = this.snaps[0];
      } else {
        a = latest;
      }
      b = a;
    }
    let t = 0;
    if (b.t > a.t) {
      t = Math.max(0, Math.min(1, (renderT - a.t) / (b.t - a.t)));
    }

    // Fire queued effects whose time has come
    const due = [];
    const keep = [];
    for (const pe of this.pendingEvents) {
      if (pe.t <= renderT) {
        due.push(pe.e);
      } else {
        keep.push(pe);
      }
    }
    this.pendingEvents = keep;

    const aRows = new Map();
    for (const r of a.p) {
      aRows.set(r[0], r);
    }
    const players = [];
    for (const r of b.p) {
      const meta = this.metaPlayer(r[0]);
      if (!meta) {
        continue;
      }
      const ra = aRows.get(r[0]) || r;
      let x = lerp(ra[1], r[1], t);
      let y = lerp(ra[2], r[2], t);
      const aim = lerpAngle(ra[3], r[3], t);
      const isMe = r[0] === this.selfId;
      // My own row uses the newest data for the HUD, and predicted position.
      let src = r;
      if (isMe) {
        src = latest.p.find((q) => q[0] === this.selfId) || r;
        if (this.pred && src[5] === 1) {
          x = this.pred.x + this.renderOffset.x;
          y = this.pred.y + this.renderOffset.y;
        } else {
          x = src[1];
          y = src[2];
        }
      }
      players.push({
        id: r[0],
        name: meta.name,
        color: meta.color,
        x,
        y,
        aim,
        hp: src[4],
        maxHp: meta.stats.maxHp,
        alive: src[5] === 1,
        invuln: (src[6] & 1) === 1,
        dashing: (src[6] & 2) === 2,
        ammo: src[7],
        reload: src[8],
        mag: meta.stats.magSize,
        dashCd: src[9],
        dashMax: meta.stats.dashCooldown
      });
    }
    const bRows = new Map();
    for (const row of a.b) {
      bRows.set(row[0], row);
    }
    const bullets = [];
    for (const row of b.b) {
      const prev = bRows.get(row[0]);
      let x = row[1];
      let y = row[2];
      if (prev && b !== a) {
        x = lerp(prev[1], row[1], t);
        y = lerp(prev[2], row[2], t);
      } else if (b !== a) {
        // spawned between snapshots: back-extrapolate along its path
        const back = (b.t - renderT);
        x = row[1] - row[3] * back;
        y = row[2] - row[4] * back;
      }
      bullets.push({ id: row[0], x, y, vx: row[3], vy: row[4], r: row[5], slot: row[6] });
    }
    return {
      phase: latest.ph,
      phaseT: latest.pt,
      roundT: latest.rt,
      zoneR: lerp(a.z, b.z, t),
      mapIndex: this.meta.mapIndex,
      players,
      bullets,
      due
    };
  }

  // ------------------------------------------------------------ frame

  localEvent(e, predicted) {
    if (!this.renderer) {
      return;
    }
    const type = e[0];
    if (type === 's' && e[1] === this.selfId && !this.isHost && predicted !== true) {
      return; // already shown when we predicted the shot
    }
    const view = this.lastView;
    let players = [];
    if (view) {
      players = view.players;
    }
    this.renderer.handleEvent(e, this.infoLookup(players));
    this.soundFor(e);
    this.feedFor(e);
  }

  soundFor(e) {
    const type = e[0];
    if (type === 's') {
      play('shoot', { damage: e[5], mine: e[1] === this.selfId });
    } else if (type === 'h') {
      if (e[1] === this.selfId) {
        play('hurt');
      } else if (e[5] === this.selfId) {
        play('hit');
      } else {
        play('hit');
      }
    } else if (type === 'k') {
      play('kill');
    } else if (type === 'x') {
      play('boom');
    } else if (type === 'w') {
      play('wall');
    } else if (type === 'd') {
      play('dash');
    } else if (type === 'rl' && e[1] === this.selfId) {
      play('reload');
    } else if (type === 'rv') {
      play('revive');
    } else if (type === 'go') {
      play('go');
    } else if (type === 're') {
      if (e[1] === this.selfId) {
        play('win');
      } else {
        play('beep');
      }
    } else if (type === 'me') {
      play('win');
    }
  }

  feedFor(e) {
    if (e[0] === 'k') {
      const victim = this.metaPlayer(e[1]);
      const killer = this.metaPlayer(e[2]);
      let victimInfo = { name: '?', color: '#ffffff' };
      if (victim) {
        victimInfo = { name: victim.name, color: victim.color };
      }
      let killerInfo = null;
      if (killer) {
        killerInfo = { name: killer.name, color: killer.color };
      }
      this.killfeed.push({
        id: Math.random(),
        at: performance.now(),
        victim: victimInfo,
        killer: killerInfo
      });
      if (this.killfeed.length > 5) {
        this.killfeed.shift();
      }
      this.pushUi(true);
    }
    if (e[0] === 're') {
      this.banner = { kind: 'round', winner: e[1], at: performance.now() };
      this.pushUi(true);
    }
  }

  frame(now, dt) {
    let view = null;
    if (this.isHost) {
      view = this.hostView();
    } else {
      this.clientAcc += dt;
      let steps = 0;
      while (this.clientAcc >= TICK && steps < 6) {
        this.clientAcc -= TICK;
        this.clientStep();
        steps += 1;
      }
      if (this.clientAcc > TICK) {
        this.clientAcc = 0;
      }
      view = this.clientView();
      if (view) {
        this.lastView = view;
        for (const e of view.due) {
          this.localEvent(e);
        }
        if (view.phase === 'countdown') {
          const count = Math.ceil(view.phaseT);
          if (count !== this.lastCount) {
            this.lastCount = count;
            play('beep');
          }
        } else {
          this.lastCount = -1;
        }
      }
    }
    if (!view) {
      this.renderEmpty();
      this.pushUi(false);
      return;
    }
    this.lastView = view;
    view.meId = this.selfId;
    view.slotColor = this.slotColor();
    const me = view.players.find((p) => p.id === this.selfId);
    const world = this.renderer.screenToWorld(this.mouse.cx, this.mouse.cy);
    view.mouse = world;
    view.showCrosshair = this.mouse.inside;
    view.reload = -1;
    if (me) {
      view.myAim = Math.atan2(world.y - me.y, world.x - me.x);
      view.crossColor = me.color;
      if (me.alive) {
        view.reload = me.reload;
      }
    }
    this.renderer.render(view, dt);
    this.me = me || null;
    this.pushUi(false);
  }

  renderEmpty() {
    const r = this.renderer;
    r.render(
      {
        phase: 'lobby',
        phaseT: 0,
        roundT: 0,
        zoneR: ZONE_START_RADIUS,
        mapIndex: 0,
        players: [],
        bullets: [],
        meId: this.selfId,
        slotColor: () => '#fff',
        mouse: r.screenToWorld(this.mouse.cx, this.mouse.cy),
        showCrosshair: false,
        reload: -1
      },
      1 / 60
    );
  }

  pushUi(force) {
    const now = performance.now();
    if (!force && now - this.lastUi < 100) {
      return;
    }
    this.lastUi = now;
    let phase = 'lobby';
    let phaseT = 0;
    let roundT = 0;
    if (this.isHost && this.match) {
      phase = this.match.phase;
      phaseT = this.match.phaseT;
      roundT = this.match.roundT;
    } else {
      const s = this.latestSnap();
      if (s) {
        phase = s.ph;
        phaseT = s.pt;
        roundT = s.rt;
      } else if (this.meta) {
        phase = this.meta.phase;
      }
    }
    this.killfeed = this.killfeed.filter((k) => now - k.at < 6000);
    let me = null;
    if (this.me) {
      me = {
        hp: this.me.hp,
        maxHp: this.me.maxHp,
        ammo: this.me.ammo,
        mag: this.me.mag,
        reload: this.me.reload,
        dashCd: this.me.dashCd,
        dashMax: this.me.dashMax,
        alive: this.me.alive,
        x: this.me.x,
        y: this.me.y
      };
    }
    if (this.onUi) {
      this.onUi({
        isHost: this.isHost,
        practice: this.kind === 'practice',
        code: this.code,
        selfId: this.selfId,
        meta: this.meta,
        phase,
        phaseT,
        roundT,
        me,
        killfeed: this.killfeed.slice(),
        notice: this.notice,
        ended: this.ended
      });
    }
  }
}
