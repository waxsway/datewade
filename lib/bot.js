import { ARENA_W, ARENA_H, PLAYER_R } from './constants.js';
import { hasLineOfSight, pointInRect } from './physics.js';

function blocked(x, y, walls) {
  if (x < PLAYER_R || x > ARENA_W - PLAYER_R || y < PLAYER_R || y > ARENA_H - PLAYER_R) {
    return true;
  }
  for (const w of walls) {
    if (pointInRect(x, y, w, PLAYER_R + 4)) {
      return true;
    }
  }
  return false;
}

// Rotate the wanted direction until it isn't walking into cover.
function avoidWalls(x, y, dx, dy, walls) {
  const len = Math.hypot(dx, dy);
  if (len < 0.01) {
    return { dx: 0, dy: 0 };
  }
  const base = Math.atan2(dy, dx);
  const tries = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6];
  for (const off of tries) {
    const a = base + off;
    const px = x + Math.cos(a) * 46;
    const py = y + Math.sin(a) * 46;
    if (!blocked(px, py, walls)) {
      return { dx: Math.cos(a) * Math.min(1, len), dy: Math.sin(a) * Math.min(1, len) };
    }
  }
  return { dx: -dx, dy: -dy };
}

export function thinkBot(match, p, dt) {
  const out = { s: 0, mx: 0, my: 0, a: p.aim, f: false, d: false, r: false };
  if (!p.alive) {
    return out;
  }
  const brain = p.brain;
  if (brain.strafeDir === undefined) {
    brain.strafeDir = 1;
    if (match.rng() < 0.5) {
      brain.strafeDir = -1;
    }
    brain.strafeT = 1;
    brain.retargetT = 0;
    brain.aimErr = 0;
    brain.aimErrT = 0;
    brain.reactT = 0.25 + match.rng() * 0.25;
  }

  const walls = match.walls;
  const me = p.body;

  brain.retargetT -= dt;
  let target = match.players.get(brain.targetId);
  if (!target || !target.alive || brain.retargetT <= 0) {
    target = null;
    let bestD = Infinity;
    for (const other of match.players.values()) {
      if (other.id === p.id || !other.alive) {
        continue;
      }
      const d = Math.hypot(other.body.x - me.x, other.body.y - me.y);
      let score = d;
      if (hasLineOfSight(me.x, me.y, other.body.x, other.body.y, walls, 2)) {
        score -= 200;
      }
      if (score < bestD) {
        bestD = score;
        target = other;
      }
    }
    brain.retargetT = 1.2;
    if (target) {
      if (brain.targetId !== target.id) {
        brain.seenT = 0;
      }
      brain.targetId = target.id;
      brain.tx = target.body.x;
      brain.ty = target.body.y;
    }
  }
  if (!target) {
    return out;
  }

  const tx = target.body.x;
  const ty = target.body.y;
  let tvx = 0;
  let tvy = 0;
  if (brain.tx !== undefined) {
    tvx = (tx - brain.tx) / dt;
    tvy = (ty - brain.ty) / dt;
  }
  brain.tx = tx;
  brain.ty = ty;

  const dx = tx - me.x;
  const dy = ty - me.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const los = hasLineOfSight(me.x, me.y, tx, ty, walls, p.stats.bulletRadius);

  // Aim with lead and a slowly wandering error so bots are beatable.
  const s = p.stats;
  const lead = dist / s.bulletSpeed;
  const ax = tx + tvx * lead * 0.8;
  const ay = ty + tvy * lead * 0.8;
  brain.aimErrT -= dt;
  if (brain.aimErrT <= 0) {
    brain.aimErr = (match.rng() - 0.5) * 0.22;
    brain.aimErrT = 0.3 + match.rng() * 0.4;
  }
  const wantAim = Math.atan2(ay - me.y, ax - me.x) + brain.aimErr;
  let diff = wantAim - p.aim;
  while (diff > Math.PI) {
    diff -= Math.PI * 2;
  }
  while (diff < -Math.PI) {
    diff += Math.PI * 2;
  }
  const turn = Math.max(-9 * dt, Math.min(9 * dt, diff));
  out.a = p.aim + turn;

  // Movement
  let desired = 330;
  if (s.multishot >= 3) {
    desired = 220;
  }
  if (s.bulletSpeed > 1800) {
    desired = 450;
  }
  let mx = 0;
  let my = 0;
  const ux = dx / dist;
  const uy = dy / dist;
  if (los) {
    const radial = Math.max(-1, Math.min(1, (dist - desired) / 120));
    brain.strafeT -= dt;
    if (brain.strafeT <= 0) {
      brain.strafeDir = -brain.strafeDir;
      brain.strafeT = 0.7 + match.rng() * 1.4;
    }
    mx = ux * radial + -uy * brain.strafeDir * 0.9;
    my = uy * radial + ux * brain.strafeDir * 0.9;
  } else {
    mx = ux;
    my = uy;
  }

  // Stay inside the zone.
  const cx = ARENA_W / 2 - me.x;
  const cy = ARENA_H / 2 - me.y;
  const fromCenter = Math.hypot(cx, cy);
  if (fromCenter > match.zoneR * 0.8) {
    mx = mx * 0.3 + (cx / fromCenter) * 1.2;
    my = my * 0.3 + (cy / fromCenter) * 1.2;
  }

  const steered = avoidWalls(me.x, me.y, mx, my, walls);
  out.mx = steered.dx;
  out.my = steered.dy;

  // Dodge incoming bullets with a dash.
  if (me.dashCd <= 0) {
    for (const b of match.bullets) {
      if (b.owner === p.id) {
        continue;
      }
      const bx = me.x - b.x;
      const by = me.y - b.y;
      const bd = Math.hypot(bx, by);
      if (bd > 150) {
        continue;
      }
      const bs = Math.max(1, Math.hypot(b.vx, b.vy));
      const toward = (bx * b.vx + by * b.vy) / (bd * bs);
      if (toward > 0.85 && match.rng() < 0.12) {
        const sideX = -b.vy / bs;
        const sideY = b.vx / bs;
        let sign = 1;
        if (match.rng() < 0.5) {
          sign = -1;
        }
        const dodge = avoidWalls(me.x, me.y, sideX * sign, sideY * sign, walls);
        out.mx = dodge.dx;
        out.my = dodge.dy;
        out.d = true;
        break;
      }
    }
  }

  // Shoot once the target has been in view for a moment.
  if (los) {
    brain.seenT = (brain.seenT || 0) + dt;
  } else {
    brain.seenT = 0;
  }
  const range = s.bulletSpeed * s.bulletLife * 0.95;
  if (los && brain.seenT > brain.reactT && Math.abs(diff) < 0.25 && dist < range) {
    out.f = true;
  }
  return out;
}
