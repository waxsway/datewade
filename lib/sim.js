import {
  ARENA_W,
  ARENA_H,
  TICK,
  PLAYER_R,
  MAX_PLAYERS,
  PLAYER_COLORS,
  COUNTDOWN_TIME,
  ROUND_END_TIME,
  UPGRADE_TIME,
  ZONE_START,
  ZONE_SHRINK_TIME,
  ZONE_MIN_RADIUS,
  ZONE_DPS
} from './constants.js';
import { MAPS } from './maps.js';
import { statsFromCards, rollOffer, CARD_BY_ID } from './cards.js';
import { moveBody, pointInRect } from './physics.js';
import { mulberry32, shuffle } from './rng.js';
import { thinkBot } from './bot.js';

export const ZONE_START_RADIUS = Math.hypot(ARENA_W / 2, ARENA_H / 2) + 40;

function round1(v) {
  return Math.round(v * 10) / 10;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function emptyInput() {
  return { s: 0, mx: 0, my: 0, a: 0, f: false, d: false, r: false };
}

export function zoneRadiusAt(roundT) {
  if (roundT < ZONE_START) {
    return ZONE_START_RADIUS;
  }
  const k = Math.min(1, (roundT - ZONE_START) / ZONE_SHRINK_TIME);
  return ZONE_START_RADIUS + (ZONE_MIN_RADIUS - ZONE_START_RADIUS) * k;
}

export function phaseAllowsMove(phase) {
  if (phase === 'fight') {
    return true;
  }
  if (phase === 'roundEnd') {
    return true;
  }
  return false;
}

export class Match {
  constructor(seed) {
    this.rng = mulberry32(seed || 1234);
    this.players = new Map();
    this.bullets = [];
    this.nextBulletId = 1;
    this.events = [];
    this.phase = 'lobby';
    this.phaseT = 0;
    this.roundT = 0;
    this.round = 0;
    this.mapIndex = 0;
    this.mapOrder = [0, 1, 2, 3];
    this.settings = { roundsToWin: 5 };
    this.metaVersion = 1;
    this.time = 0;
    this.zoneR = ZONE_START_RADIUS;
    this.zoneTick = 0;
    this.roundWinner = null;
    this.matchWinner = null;
    this.startedWith = 0;
  }

  get walls() {
    return MAPS[this.mapIndex].walls;
  }

  bump() {
    this.metaVersion += 1;
  }

  emit(evt) {
    this.events.push(evt);
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ---------------------------------------------------------------- roster

  freeSlot() {
    const used = new Set();
    for (const p of this.players.values()) {
      used.add(p.slot);
    }
    for (let i = 0; i < MAX_PLAYERS; i += 1) {
      if (!used.has(i)) {
        return i;
      }
    }
    return -1;
  }

  pickColor(wanted) {
    const used = new Set();
    for (const p of this.players.values()) {
      used.add(p.color);
    }
    if (PLAYER_COLORS.includes(wanted) && !used.has(wanted)) {
      return wanted;
    }
    for (const c of PLAYER_COLORS) {
      if (!used.has(c)) {
        return c;
      }
    }
    return PLAYER_COLORS[0];
  }

  addPlayer(id, name, color, isBot) {
    if (this.players.has(id)) {
      const existing = this.players.get(id);
      existing.name = name;
      this.bump();
      return existing;
    }
    if (this.players.size >= MAX_PLAYERS) {
      return null;
    }
    const cards = [];
    const p = {
      id,
      slot: this.freeSlot(),
      name,
      color: this.pickColor(color),
      bot: isBot === true,
      cards,
      stats: statsFromCards(cards),
      score: 0,
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      alive: false,
      hp: 0,
      body: { x: ARENA_W / 2, y: ARENA_H / 2, kvx: 0, kvy: 0, dashT: 0, dashVx: 0, dashVy: 0, dashCd: 0 },
      aim: 0,
      fireCd: 0,
      ammo: 0,
      reloadT: 0,
      invulnT: 0,
      lastHitT: 99,
      lastHitBy: null,
      livesUsed: 0,
      inputQueue: [],
      lastInput: emptyInput(),
      lastSeq: 0,
      offer: [],
      picked: null,
      pickDelay: 0,
      brain: {}
    };
    this.players.set(id, p);
    this.bump();
    return p;
  }

  removePlayer(id) {
    if (!this.players.has(id)) {
      return;
    }
    this.players.delete(id);
    this.bump();
    if (this.phase === 'fight') {
      this.checkRoundEnd();
    }
    if (this.phase !== 'lobby' && this.players.size < 2) {
      this.backToLobby();
    }
  }

  setSetting(key, value) {
    if (key === 'roundsToWin') {
      const n = Number(value);
      if (n === 3 || n === 5 || n === 7 || n === 10) {
        this.settings.roundsToWin = n;
        this.bump();
      }
    }
  }

  // ---------------------------------------------------------------- input

  pushInputs(id, inputs) {
    const p = this.players.get(id);
    if (!p) {
      return;
    }
    for (const raw of inputs) {
      p.inputQueue.push(raw);
    }
    // If the queue backs up (lag spike) skip ahead, but keep any dash press.
    if (p.inputQueue.length > 8) {
      let dash = false;
      while (p.inputQueue.length > 3) {
        const dropped = p.inputQueue.shift();
        if (dropped.d) {
          dash = true;
        }
      }
      if (dash) {
        p.inputQueue[0].d = true;
      }
    }
  }

  consumeInput(p) {
    if (p.inputQueue.length > 0) {
      const inp = p.inputQueue.shift();
      p.lastInput = inp;
      if (inp.s > p.lastSeq) {
        p.lastSeq = inp.s;
      }
      return inp;
    }
    const repeat = p.lastInput;
    return { s: repeat.s, mx: repeat.mx, my: repeat.my, a: repeat.a, f: repeat.f, d: false, r: false };
  }

  // ---------------------------------------------------------------- flow

  startMatch() {
    if (this.players.size < 2) {
      return false;
    }
    for (const p of this.players.values()) {
      p.cards = [];
      p.stats = statsFromCards(p.cards);
      p.score = 0;
      p.kills = 0;
      p.deaths = 0;
      p.damageDealt = 0;
      p.offer = [];
      p.picked = null;
    }
    this.round = 0;
    this.matchWinner = null;
    this.roundWinner = null;
    this.mapOrder = shuffle([0, 1, 2, 3], this.rng);
    this.startRound();
    return true;
  }

  startRound() {
    this.round += 1;
    this.mapIndex = this.mapOrder[(this.round - 1) % this.mapOrder.length];
    this.bullets = [];
    this.roundT = 0;
    this.zoneR = ZONE_START_RADIUS;
    this.zoneTick = 0;
    this.roundWinner = null;
    const spawns = shuffle(MAPS[this.mapIndex].spawns, this.rng);
    let i = 0;
    for (const p of this.players.values()) {
      const sp = spawns[i % spawns.length];
      i += 1;
      p.body = { x: sp.x, y: sp.y, kvx: 0, kvy: 0, dashT: 0, dashVx: 0, dashVy: 0, dashCd: 0 };
      p.aim = Math.atan2(ARENA_H / 2 - sp.y, ARENA_W / 2 - sp.x);
      p.alive = true;
      p.hp = p.stats.maxHp;
      p.ammo = p.stats.magSize;
      p.fireCd = 0;
      p.reloadT = 0;
      p.invulnT = 0;
      p.lastHitT = 99;
      p.lastHitBy = null;
      p.livesUsed = 0;
      p.offer = [];
      p.picked = null;
      p.brain = {};
    }
    this.startedWith = this.players.size;
    this.phase = 'countdown';
    this.phaseT = COUNTDOWN_TIME;
    this.bump();
  }

  beginUpgrades() {
    this.phase = 'upgrade';
    this.phaseT = UPGRADE_TIME;
    for (const p of this.players.values()) {
      const won = p.id === this.roundWinner;
      p.offer = rollOffer(this.rng, won, p.cards);
      p.picked = null;
      p.pickDelay = 1.2 + this.rng() * 3;
    }
    this.bump();
  }

  pick(id, cardId) {
    if (this.phase !== 'upgrade') {
      return false;
    }
    const p = this.players.get(id);
    if (!p) {
      return false;
    }
    if (p.picked !== null) {
      return false;
    }
    if (!p.offer.includes(cardId)) {
      return false;
    }
    if (!CARD_BY_ID[cardId]) {
      return false;
    }
    p.picked = cardId;
    p.cards.push(cardId);
    p.stats = statsFromCards(p.cards);
    this.bump();
    let allPicked = true;
    for (const other of this.players.values()) {
      if (other.picked === null) {
        allPicked = false;
      }
    }
    if (allPicked && this.phaseT > 1.2) {
      this.phaseT = 1.2;
    }
    return true;
  }

  backToLobby() {
    this.phase = 'lobby';
    this.phaseT = 0;
    this.bullets = [];
    this.round = 0;
    this.matchWinner = null;
    this.roundWinner = null;
    for (const p of this.players.values()) {
      p.alive = false;
      p.offer = [];
      p.picked = null;
    }
    this.bump();
  }

  // ---------------------------------------------------------------- tick

  step() {
    const dt = TICK;
    this.time += dt;

    const inputs = new Map();
    for (const p of this.players.values()) {
      let inp = this.consumeInput(p);
      if (p.bot) {
        inp = thinkBot(this, p, dt);
      }
      inputs.set(p.id, inp);
    }

    if (this.phase === 'countdown') {
      for (const p of this.players.values()) {
        p.aim = inputs.get(p.id).a;
      }
      this.phaseT -= dt;
      if (this.phaseT <= 0) {
        this.phase = 'fight';
        this.phaseT = 0;
        this.emit(['go']);
        this.bump();
      }
      return;
    }

    if (this.phase === 'fight' || this.phase === 'roundEnd') {
      for (const p of this.players.values()) {
        this.updatePlayer(p, inputs.get(p.id), dt);
      }
      this.updateBullets(dt);
      if (this.phase === 'fight') {
        this.roundT += dt;
        this.updateZone(dt);
        this.checkRoundEnd();
      } else {
        this.phaseT -= dt;
        if (this.phaseT <= 0) {
          this.afterRound();
        }
      }
      return;
    }

    if (this.phase === 'upgrade') {
      this.phaseT -= dt;
      for (const p of this.players.values()) {
        if (p.bot && p.picked === null) {
          p.pickDelay -= dt;
          if (p.pickDelay <= 0) {
            this.pick(p.id, this.botChoose(p));
          }
        }
      }
      if (this.phaseT <= 0) {
        for (const p of this.players.values()) {
          if (p.picked === null && p.offer.length > 0) {
            const choice = p.offer[Math.floor(this.rng() * p.offer.length)];
            this.pick(p.id, choice);
          }
        }
        this.startRound();
      }
    }
  }

  botChoose(p) {
    // Bots like rarer cards a little more than random.
    let best = p.offer[0];
    let bestScore = -1;
    for (const id of p.offer) {
      const card = CARD_BY_ID[id];
      let score = this.rng();
      if (card.rarity === 'epic') {
        score += 0.6;
      } else if (card.rarity === 'rare') {
        score += 0.3;
      }
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }

  afterRound() {
    let champion = null;
    for (const p of this.players.values()) {
      if (p.score >= this.settings.roundsToWin) {
        champion = p;
      }
    }
    if (champion) {
      this.matchWinner = champion.id;
      this.phase = 'matchEnd';
      this.phaseT = 0;
      this.bullets = [];
      this.emit(['me', champion.id]);
      this.bump();
      return;
    }
    this.beginUpgrades();
  }

  checkRoundEnd() {
    if (this.phase !== 'fight') {
      return;
    }
    const alive = [];
    for (const p of this.players.values()) {
      if (p.alive) {
        alive.push(p);
      }
    }
    if (alive.length > 1) {
      return;
    }
    if (alive.length === 1) {
      const winner = alive[0];
      winner.score += 1;
      this.roundWinner = winner.id;
    } else {
      this.roundWinner = null;
    }
    this.phase = 'roundEnd';
    this.phaseT = ROUND_END_TIME;
    if (this.roundWinner) {
      this.emit(['re', this.roundWinner]);
    } else {
      this.emit(['re', '']);
    }
    this.bump();
  }

  updatePlayer(p, inp, dt) {
    if (!p.alive) {
      return;
    }
    p.aim = inp.a;
    const canMove = phaseAllowsMove(this.phase);
    const dashed = moveBody(p.body, inp, p.stats, dt, this.walls, canMove);
    if (dashed) {
      this.emit(['d', p.id]);
      if (p.stats.dashInvuln > 0 && p.invulnT < p.stats.dashInvuln) {
        p.invulnT = p.stats.dashInvuln;
      }
    }
    if (p.invulnT > 0) {
      p.invulnT -= dt;
    }
    p.lastHitT += dt;
    if (p.stats.regen > 0 && p.lastHitT > 3 && p.hp < p.stats.maxHp) {
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.regen * dt);
    }
    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        p.reloadT = 0;
        p.ammo = p.stats.magSize;
      }
    }
    if (p.fireCd > 0) {
      p.fireCd -= dt;
    }
    if (this.phase !== 'fight') {
      return;
    }
    if (inp.r && p.ammo < p.stats.magSize && p.reloadT <= 0) {
      this.startReload(p);
    }
    if (inp.f && p.fireCd <= 0 && p.reloadT <= 0 && p.ammo > 0) {
      this.fire(p);
    }
  }

  startReload(p) {
    p.reloadT = p.stats.reloadTime;
    this.emit(['rl', p.id]);
  }

  fire(p) {
    const s = p.stats;
    p.fireCd = s.fireDelay;
    p.ammo -= 1;
    const n = s.multishot;
    const fan = (Math.min(70, (n - 1) * 8) * Math.PI) / 180;
    const jitter = (s.spread * Math.PI) / 180;
    for (let i = 0; i < n; i += 1) {
      let angle = p.aim;
      if (n > 1) {
        angle += -fan / 2 + (fan * i) / (n - 1);
      }
      angle += (this.rng() - 0.5) * jitter;
      this.bullets.push({
        id: this.nextBulletId,
        owner: p.id,
        slot: p.slot,
        x: p.body.x + Math.cos(p.aim) * PLAYER_R * 0.5,
        y: p.body.y + Math.sin(p.aim) * PLAYER_R * 0.5,
        vx: Math.cos(angle) * s.bulletSpeed,
        vy: Math.sin(angle) * s.bulletSpeed,
        r: s.bulletRadius,
        life: s.bulletLife,
        dmg: s.damage,
        bounces: s.bounces,
        pierce: s.pierce,
        homing: s.homing,
        explode: s.explosionRadius,
        ghost: s.ghost > 0,
        knock: s.knockback,
        hits: [],
        dead: false
      });
      this.nextBulletId += 1;
    }
    this.emit([
      's',
      p.id,
      round1(p.body.x + Math.cos(p.aim) * (PLAYER_R + 12)),
      round1(p.body.y + Math.sin(p.aim) * (PLAYER_R + 12)),
      round2(p.aim),
      Math.round(s.damage)
    ]);
    if (p.ammo <= 0) {
      this.startReload(p);
    }
  }

  updateBullets(dt) {
    const walls = this.walls;
    for (const b of this.bullets) {
      if (b.dead) {
        continue;
      }
      b.life -= dt;
      if (b.life <= 0) {
        this.killBullet(b, b.x, b.y, false);
        continue;
      }
      if (b.homing > 0) {
        this.steerBullet(b, dt);
      }
      const speed = Math.hypot(b.vx, b.vy);
      const steps = Math.max(1, Math.ceil((speed * dt) / 10));
      const sdt = dt / steps;
      for (let i = 0; i < steps && !b.dead; i += 1) {
        const px = b.x;
        const py = b.y;
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;

        // Arena edges
        let hitEdge = false;
        if (b.x < b.r || b.x > ARENA_W - b.r) {
          hitEdge = true;
          if (b.bounces > 0) {
            b.vx = -b.vx;
            b.x = px;
            b.bounces -= 1;
            this.emit(['w', round1(b.x), round1(b.y)]);
          } else {
            this.killBullet(b, b.x, b.y, true);
          }
        }
        if (!b.dead && (b.y < b.r || b.y > ARENA_H - b.r)) {
          hitEdge = true;
          if (b.bounces > 0) {
            b.vy = -b.vy;
            b.y = py;
            b.bounces -= 1;
            this.emit(['w', round1(b.x), round1(b.y)]);
          } else {
            this.killBullet(b, b.x, b.y, true);
          }
        }
        if (b.dead) {
          break;
        }

        // Cover
        if (!b.ghost && !hitEdge) {
          for (const w of walls) {
            if (!pointInRect(b.x, b.y, w, b.r * 0.5)) {
              continue;
            }
            if (b.bounces > 0) {
              const pad = b.r * 0.5;
              const wasOutsideX = px < w.x - pad || px > w.x + w.w + pad;
              if (wasOutsideX) {
                b.vx = -b.vx;
              } else {
                b.vy = -b.vy;
              }
              b.x = px;
              b.y = py;
              b.bounces -= 1;
              this.emit(['w', round1(b.x), round1(b.y)]);
            } else {
              this.killBullet(b, b.x, b.y, true);
            }
            break;
          }
        }
        if (b.dead) {
          break;
        }

        // Players
        for (const p of this.players.values()) {
          if (!p.alive) {
            continue;
          }
          if (p.id === b.owner) {
            continue;
          }
          if (b.hits.includes(p.id)) {
            continue;
          }
          const dx = p.body.x - b.x;
          const dy = p.body.y - b.y;
          const reach = PLAYER_R + b.r;
          if (dx * dx + dy * dy > reach * reach) {
            continue;
          }
          b.hits.push(p.id);
          if (p.invulnT > 0) {
            continue;
          }
          const sp = Math.max(1, Math.hypot(b.vx, b.vy));
          this.damage(p, b.dmg, b.owner, b.vx / sp, b.vy / sp, b.knock);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            this.killBullet(b, b.x, b.y, false);
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  steerBullet(b, dt) {
    let best = null;
    let bestD = 520;
    for (const p of this.players.values()) {
      if (!p.alive || p.id === b.owner || b.hits.includes(p.id)) {
        continue;
      }
      const d = Math.hypot(p.body.x - b.x, p.body.y - b.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) {
      return;
    }
    const cur = Math.atan2(b.vy, b.vx);
    const want = Math.atan2(best.body.y - b.y, best.body.x - b.x);
    let diff = want - cur;
    while (diff > Math.PI) {
      diff -= Math.PI * 2;
    }
    while (diff < -Math.PI) {
      diff += Math.PI * 2;
    }
    const maxTurn = b.homing * dt;
    let turn = diff;
    if (turn > maxTurn) {
      turn = maxTurn;
    }
    if (turn < -maxTurn) {
      turn = -maxTurn;
    }
    const speed = Math.hypot(b.vx, b.vy);
    const next = cur + turn;
    b.vx = Math.cos(next) * speed;
    b.vy = Math.sin(next) * speed;
  }

  killBullet(b, x, y, hitWall) {
    b.dead = true;
    if (b.explode > 0) {
      this.explode(b, x, y);
      return;
    }
    if (hitWall) {
      this.emit(['w', round1(x), round1(y)]);
    }
  }

  explode(b, x, y) {
    const radius = b.explode;
    this.emit(['x', round1(x), round1(y), Math.round(radius)]);
    for (const p of this.players.values()) {
      if (!p.alive || p.id === b.owner || p.invulnT > 0) {
        continue;
      }
      const dx = p.body.x - x;
      const dy = p.body.y - y;
      const d = Math.hypot(dx, dy);
      const reach = radius + PLAYER_R;
      if (d > reach) {
        continue;
      }
      // Direct hits already took full damage from the bullet itself.
      if (b.hits.includes(p.id)) {
        continue;
      }
      const falloff = 1 - 0.5 * (d / reach);
      let nx = 0;
      let ny = 0;
      if (d > 0.01) {
        nx = dx / d;
        ny = dy / d;
      }
      this.damage(p, b.dmg * 0.75 * falloff, b.owner, nx, ny, b.knock * 1.6);
    }
  }

  damage(target, amount, sourceId, nx, ny, knock) {
    if (!target.alive) {
      return;
    }
    if (target.invulnT > 0) {
      return;
    }
    const dealt = amount * (1 - target.stats.armor);
    target.hp -= dealt;
    target.lastHitT = 0;
    if (sourceId !== 'zone') {
      target.lastHitBy = sourceId;
    }
    const scale = Math.min(2, Math.sqrt(Math.max(0.2, amount / 20)));
    target.body.kvx += nx * knock * scale;
    target.body.kvy += ny * knock * scale;
    this.emit(['h', target.id, round1(target.body.x), round1(target.body.y), Math.max(1, Math.round(dealt)), sourceId]);

    const shooter = this.players.get(sourceId);
    if (shooter) {
      shooter.damageDealt += dealt;
      if (shooter.alive && shooter.stats.lifesteal > 0) {
        shooter.hp = Math.min(shooter.stats.maxHp, shooter.hp + dealt * shooter.stats.lifesteal);
      }
    }

    if (target.hp > 0) {
      return;
    }
    if (target.livesUsed < target.stats.extraLives) {
      target.livesUsed += 1;
      target.hp = target.stats.maxHp * 0.4;
      target.invulnT = 1;
      this.emit(['rv', target.id]);
      return;
    }
    this.kill(target);
  }

  kill(target) {
    target.alive = false;
    target.hp = 0;
    target.deaths += 1;
    let killerId = '';
    if (target.lastHitBy && target.lastHitT < 6) {
      killerId = target.lastHitBy;
    }
    const killer = this.players.get(killerId);
    if (killer && killer.id !== target.id) {
      killer.kills += 1;
    }
    this.emit(['k', target.id, killerId, round1(target.body.x), round1(target.body.y)]);
    this.bump();
  }

  updateZone(dt) {
    this.zoneR = zoneRadiusAt(this.roundT);
    this.zoneTick += dt;
    if (this.zoneTick < 0.5) {
      return;
    }
    this.zoneTick = 0;
    for (const p of this.players.values()) {
      if (!p.alive) {
        continue;
      }
      const d = Math.hypot(p.body.x - ARENA_W / 2, p.body.y - ARENA_H / 2);
      if (d > this.zoneR) {
        const wasInvuln = p.invulnT;
        p.invulnT = 0;
        this.damage(p, ZONE_DPS * 0.5, 'zone', 0, 0, 0);
        if (p.alive) {
          p.invulnT = wasInvuln;
        }
      }
    }
  }

  // ---------------------------------------------------------------- network

  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      let flags = 0;
      if (p.invulnT > 0) {
        flags |= 1;
      }
      if (p.body.dashT > 0) {
        flags |= 2;
      }
      let reload = -1;
      if (p.reloadT > 0) {
        reload = round2(1 - p.reloadT / p.stats.reloadTime);
      }
      let aliveFlag = 0;
      if (p.alive) {
        aliveFlag = 1;
      }
      players.push([
        p.id,
        round1(p.body.x),
        round1(p.body.y),
        round2(p.aim),
        Math.ceil(p.hp),
        aliveFlag,
        flags,
        p.ammo,
        reload,
        round2(p.body.dashCd),
        p.lastSeq,
        round1(p.body.kvx),
        round1(p.body.kvy),
        Math.round(p.body.dashT * 1000) / 1000,
        round1(p.body.dashVx),
        round1(p.body.dashVy)
      ]);
    }
    const bullets = [];
    for (const b of this.bullets) {
      bullets.push([b.id, round1(b.x), round1(b.y), Math.round(b.vx), Math.round(b.vy), round1(b.r), b.slot]);
    }
    return {
      t: Math.round(this.time * 1000) / 1000,
      ph: this.phase,
      pt: round2(this.phaseT),
      rt: round2(this.roundT),
      z: Math.round(this.zoneR),
      p: players,
      b: bullets
    };
  }

  meta() {
    const players = [];
    for (const p of this.players.values()) {
      players.push({
        id: p.id,
        slot: p.slot,
        name: p.name,
        color: p.color,
        bot: p.bot,
        score: p.score,
        kills: p.kills,
        deaths: p.deaths,
        dmg: Math.round(p.damageDealt),
        cards: p.cards.slice(),
        stats: p.stats,
        offer: p.offer.slice(),
        picked: p.picked
      });
    }
    return {
      v: this.metaVersion,
      phase: this.phase,
      round: this.round,
      mapIndex: this.mapIndex,
      settings: { roundsToWin: this.settings.roundsToWin },
      roundWinner: this.roundWinner,
      matchWinner: this.matchWinner,
      players
    };
  }
}
