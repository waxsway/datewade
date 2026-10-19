import {
  ARENA_W,
  ARENA_H,
  PLAYER_R,
  DASH_TIME,
  DASH_SPEED,
  KNOCKBACK_DECAY
} from './constants.js';

// Push a circle out of an axis-aligned rectangle. Mutates pos.
export function resolveCircleRect(pos, r, wall) {
  const cx = Math.max(wall.x, Math.min(pos.x, wall.x + wall.w));
  const cy = Math.max(wall.y, Math.min(pos.y, wall.y + wall.h));
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) {
    return false;
  }
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * r;
    pos.y = cy + (dy / d) * r;
    return true;
  }
  // Center is inside the rect: push out along the shallowest side.
  const left = pos.x - wall.x;
  const right = wall.x + wall.w - pos.x;
  const top = pos.y - wall.y;
  const bottom = wall.y + wall.h - pos.y;
  const smallest = Math.min(left, right, top, bottom);
  if (smallest === left) {
    pos.x = wall.x - r;
  } else if (smallest === right) {
    pos.x = wall.x + wall.w + r;
  } else if (smallest === top) {
    pos.y = wall.y - r;
  } else {
    pos.y = wall.y + wall.h + r;
  }
  return true;
}

export function clampToArena(pos, r) {
  if (pos.x < r) {
    pos.x = r;
  }
  if (pos.x > ARENA_W - r) {
    pos.x = ARENA_W - r;
  }
  if (pos.y < r) {
    pos.y = r;
  }
  if (pos.y > ARENA_H - r) {
    pos.y = ARENA_H - r;
  }
}

export function pointInRect(x, y, wall, pad) {
  if (x < wall.x - pad) {
    return false;
  }
  if (x > wall.x + wall.w + pad) {
    return false;
  }
  if (y < wall.y - pad) {
    return false;
  }
  if (y > wall.y + wall.h + pad) {
    return false;
  }
  return true;
}

// Liang-Barsky segment vs rect test, used for bot line of sight.
export function segmentHitsRect(x1, y1, x2, y2, wall, pad) {
  const minX = wall.x - pad;
  const maxX = wall.x + wall.w + pad;
  const minY = wall.y - pad;
  const maxY = wall.y + wall.h + pad;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) {
        return false;
      }
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) {
          return false;
        }
        if (t > t0) {
          t0 = t;
        }
      } else {
        if (t < t0) {
          return false;
        }
        if (t < t1) {
          t1 = t;
        }
      }
    }
  }
  return true;
}

export function hasLineOfSight(x1, y1, x2, y2, walls, pad) {
  for (const w of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, w, pad)) {
      return false;
    }
  }
  return true;
}

// Movement shared by the host simulation and client prediction. Given the same
// body state, input and stats it always produces the same result.
//
// body: { x, y, kvx, kvy, dashT, dashVx, dashVy, dashCd }
// input: { mx, my, a, d }  (move vector, aim angle, dash pressed this tick)
// returns true when a dash started this tick.
export function moveBody(body, input, stats, dt, walls, canMove) {
  let dashStarted = false;
  if (body.dashCd > 0) {
    body.dashCd -= dt;
    if (body.dashCd < 0) {
      body.dashCd = 0;
    }
  }

  let mx = 0;
  let my = 0;
  if (canMove) {
    mx = input.mx;
    my = input.my;
  }
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  if (canMove && input.d === true && body.dashCd <= 0 && body.dashT <= 0) {
    let dx = mx;
    let dy = my;
    if (Math.hypot(dx, dy) < 0.1) {
      dx = Math.cos(input.a);
      dy = Math.sin(input.a);
    }
    const dl = Math.hypot(dx, dy);
    body.dashVx = (dx / dl) * DASH_SPEED;
    body.dashVy = (dy / dl) * DASH_SPEED;
    body.dashT = DASH_TIME;
    body.dashCd = stats.dashCooldown;
    dashStarted = true;
  }

  let vx = 0;
  let vy = 0;
  if (body.dashT > 0) {
    vx = body.dashVx;
    vy = body.dashVy;
    body.dashT -= dt;
    if (body.dashT < 0) {
      body.dashT = 0;
    }
  } else {
    vx = mx * stats.moveSpeed;
    vy = my * stats.moveSpeed;
  }

  vx += body.kvx;
  vy += body.kvy;
  const decay = Math.exp(-KNOCKBACK_DECAY * dt);
  body.kvx *= decay;
  body.kvy *= decay;
  if (Math.abs(body.kvx) < 1) {
    body.kvx = 0;
  }
  if (Math.abs(body.kvy) < 1) {
    body.kvy = 0;
  }

  // Two half steps keep fast dashes from clipping through thin cover.
  for (let i = 0; i < 2; i += 1) {
    body.x += (vx * dt) / 2;
    body.y += (vy * dt) / 2;
    for (const w of walls) {
      resolveCircleRect(body, PLAYER_R, w);
    }
    clampToArena(body, PLAYER_R);
  }
  return dashStarted;
}

export function copyBody(src) {
  return {
    x: src.x,
    y: src.y,
    kvx: src.kvx,
    kvy: src.kvy,
    dashT: src.dashT,
    dashVx: src.dashVx,
    dashVy: src.dashVy,
    dashCd: src.dashCd
  };
}
