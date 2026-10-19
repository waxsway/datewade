// Paints each map's static background once into an offscreen canvas.
// Everything is procedural with a fixed seed so every player sees the same map.

import { ARENA_W, ARENA_H } from '../lib/constants.js';
import { MAPS } from '../lib/maps.js';
import { mulberry32 } from '../lib/rng.js';

export const MARGIN = 48;

const WALL_HEIGHT = {
  ac: 22,
  vent: 30,
  crate: 18,
  pillar: 36,
  ruin: 26,
  sandbag: 15,
  barrel: 22,
  container: 32,
  bollard: 14
};

export function wallHeight(kind) {
  const h = WALL_HEIGHT[kind];
  if (h === undefined) {
    return 20;
  }
  return h;
}

// ---------------------------------------------------------------- helpers

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function blob(ctx, x, y, rx, ry, rng, jitter) {
  const n = 10;
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 - jitter / 2 + rng() * jitter;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2;
    const my = (p0[1] + p1[1]) / 2;
    if (i === 0) {
      const pl = pts[n - 1];
      ctx.moveTo((pl[0] + p0[0]) / 2, (pl[1] + p0[1]) / 2);
    }
    ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  ctx.closePath();
}

function speckle(ctx, rng, x, y, w, h, count, colors, minSize, maxSize, alpha) {
  for (let i = 0; i < count; i += 1) {
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = minSize + rng() * (maxSize - minSize);
    ctx.fillRect(x + rng() * w, y + rng() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function glow(ctx, x, y, r, color, strength) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

function inOpenFloor(x, y, walls, pad) {
  for (const w of walls) {
    if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) {
      return false;
    }
  }
  return true;
}

function vignette(ctx, strength) {
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  const g = ctx.createRadialGradient(cx, cy, ARENA_H * 0.35, cx, cy, ARENA_W * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,' + strength + ')');
  ctx.fillStyle = g;
  ctx.fillRect(-MARGIN, -MARGIN, ARENA_W + MARGIN * 2, ARENA_H + MARGIN * 2);
}

// Pseudo 3D block: shadow, front face, then top face lifted by its height.
function shadowFor(ctx, w, light) {
  const h = wallHeight(w.k);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,' + light.shadowAlpha + ')';
  ctx.filter = 'blur(' + light.blur + 'px)';
  const ox = h * light.dx;
  const oy = h * light.dy;
  if (w.k === 'barrel' || w.k === 'bollard' || w.k === 'pillar') {
    ctx.beginPath();
    ctx.ellipse(w.x + w.w / 2 + ox, w.y + w.h / 2 + oy, w.w / 2 + 2, w.h / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(w.x, w.y);
    ctx.lineTo(w.x + w.w, w.y);
    ctx.lineTo(w.x + w.w + ox, w.y + oy);
    ctx.lineTo(w.x + w.w + ox, w.y + w.h + oy);
    ctx.lineTo(w.x + ox, w.y + w.h + oy);
    ctx.lineTo(w.x, w.y + w.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function faces(ctx, w, top, front, edge) {
  const h = wallHeight(w.k);
  ctx.fillStyle = front;
  ctx.fillRect(w.x, w.y + w.h - h, w.w, h);
  ctx.fillStyle = top;
  ctx.fillRect(w.x, w.y - h, w.w, w.h);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w.x + 0.75, w.y - h + 0.75, w.w - 1.5, w.h - 1.5);
  // Edge highlight where top meets front
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(w.x, w.y + w.h - h - 1, w.w, 2);
}

// ---------------------------------------------------------------- wall kinds

function drawCrate(ctx, w, rng, wood) {
  const h = wallHeight(w.k);
  faces(ctx, w, wood.top, wood.front, wood.edge);
  const tx = w.x;
  const ty = w.y - h;
  // planks on top
  ctx.strokeStyle = wood.line;
  ctx.lineWidth = 1;
  const planks = Math.max(2, Math.round(w.h / 14));
  for (let i = 1; i < planks; i += 1) {
    const yy = ty + (w.h / planks) * i;
    ctx.beginPath();
    ctx.moveTo(tx + 3, yy);
    ctx.lineTo(tx + w.w - 3, yy);
    ctx.stroke();
  }
  // X brace
  ctx.strokeStyle = wood.brace;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(tx + 5, ty + 5);
  ctx.lineTo(tx + w.w - 5, ty + w.h - 5);
  ctx.moveTo(tx + w.w - 5, ty + 5);
  ctx.lineTo(tx + 5, ty + w.h - 5);
  ctx.stroke();
  ctx.strokeStyle = wood.brace;
  ctx.lineWidth = 3;
  ctx.strokeRect(tx + 3, ty + 3, w.w - 6, w.h - 6);
  // nails
  ctx.fillStyle = 'rgba(30,30,30,0.7)';
  const nails = [
    [tx + 6, ty + 6],
    [tx + w.w - 6, ty + 6],
    [tx + 6, ty + w.h - 6],
    [tx + w.w - 6, ty + w.h - 6]
  ];
  for (const n of nails) {
    ctx.beginPath();
    ctx.arc(n[0], n[1], 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // front plank lines
  ctx.strokeStyle = wood.line;
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i += 1) {
    const yy = w.y + w.h - h + (h / 3) * i;
    ctx.beginPath();
    ctx.moveTo(w.x + 2, yy);
    ctx.lineTo(w.x + w.w - 2, yy);
    ctx.stroke();
  }
  speckle(ctx, rng, tx, ty, w.w, w.h, 30, [wood.line], 1, 2, 0.3);
}

function drawAC(ctx, w, rng) {
  const h = wallHeight(w.k);
  faces(ctx, w, '#8b929c', '#5a6069', '#a7adb6');
  const tx = w.x;
  const ty = w.y - h;
  // fan grilles
  const fans = Math.max(1, Math.floor(w.w / 60));
  const r = Math.min(w.h * 0.36, (w.w / fans) * 0.36);
  for (let i = 0; i < fans; i += 1) {
    const cx = tx + (w.w / fans) * (i + 0.5);
    const cy = ty + w.h / 2;
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6c737d';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, (r * k) / 3.2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#9aa1ab';
    for (let k = 0; k < 4; k += 1) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((k * Math.PI) / 2 + rng());
      ctx.beginPath();
      ctx.ellipse(r * 0.45, 0, r * 0.4, r * 0.14, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#c9ced5';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
  // front vents
  ctx.strokeStyle = 'rgba(20,22,26,0.6)';
  ctx.lineWidth = 1;
  for (let x = w.x + 6; x < w.x + w.w - 4; x += 5) {
    ctx.beginPath();
    ctx.moveTo(x, w.y + w.h - h + 4);
    ctx.lineTo(x, w.y + w.h - 4);
    ctx.stroke();
  }
  // grime streaks
  speckle(ctx, rng, tx, ty, w.w, w.h, 60, ['#3d424a', '#b9bec6'], 1, 2.5, 0.35);
  // small status led
  ctx.fillStyle = '#5cff8a';
  ctx.fillRect(w.x + w.w - 10, w.y + w.h - h + 4, 3, 3);
  glow(ctx, w.x + w.w - 8.5, w.y + w.h - h + 5.5, 12, '#5cff8a', 0.6);
}

function drawVent(ctx, w, rng) {
  const h = wallHeight(w.k);
  faces(ctx, w, '#6e7580', '#454a52', '#8d949e');
  const tx = w.x;
  const ty = w.y - h;
  ctx.fillStyle = '#2a2e34';
  rr(ctx, tx + 6, ty + 6, w.w - 12, w.h - 12, 4);
  ctx.fill();
  ctx.strokeStyle = '#7b828c';
  ctx.lineWidth = 2;
  for (let y = ty + 12; y < ty + w.h - 10; y += 8) {
    ctx.beginPath();
    ctx.moveTo(tx + 8, y);
    ctx.lineTo(tx + w.w - 8, y);
    ctx.stroke();
  }
  speckle(ctx, rng, tx, ty, w.w, w.h, 40, ['#30343a', '#a0a7b0'], 1, 2, 0.3);
}

function drawPillar(ctx, w, rng) {
  const h = wallHeight(w.k);
  const cx = w.x + w.w / 2;
  const r = w.w / 2;
  // base plinth
  ctx.fillStyle = '#7d766a';
  ctx.fillRect(w.x - 3, w.y + w.h - 12, w.w + 6, 12);
  // column body
  const g = ctx.createLinearGradient(w.x, 0, w.x + w.w, 0);
  g.addColorStop(0, '#6f685d');
  g.addColorStop(0.35, '#b8ae9c');
  g.addColorStop(1, '#5e584e');
  ctx.fillStyle = g;
  ctx.fillRect(w.x + 4, w.y + w.h / 2 - h, w.w - 8, h + w.h / 2 - 10);
  // flutes
  ctx.strokeStyle = 'rgba(60,55,48,0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 6; i += 1) {
    const x = w.x + 4 + ((w.w - 8) / 6) * i;
    ctx.beginPath();
    ctx.moveTo(x, w.y + w.h / 2 - h + 6);
    ctx.lineTo(x, w.y + w.h - 12);
    ctx.stroke();
  }
  // capital top
  const tg = ctx.createRadialGradient(cx - r * 0.3, w.y + w.h / 2 - h - r * 0.3, 2, cx, w.y + w.h / 2 - h, r + 4);
  tg.addColorStop(0, '#e2d8c4');
  tg.addColorStop(1, '#8f8676');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.ellipse(cx, w.y + w.h / 2 - h, r + 3, r * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5f584d';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // moss on top
  ctx.fillStyle = 'rgba(92,140,60,0.75)';
  for (let i = 0; i < 6; i += 1) {
    blob(ctx, cx - r * 0.5 + rng() * r, w.y + w.h / 2 - h - r * 0.4 + rng() * r * 0.6, 4 + rng() * 6, 3 + rng() * 4, rng, 0.5);
    ctx.fill();
  }
  // cracks
  ctx.strokeStyle = 'rgba(40,36,30,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  let px = cx - 4 + rng() * 8;
  let py = w.y + w.h / 2 - h + 8;
  ctx.moveTo(px, py);
  for (let i = 0; i < 4; i += 1) {
    px += -5 + rng() * 10;
    py += 6 + rng() * 6;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
}

function drawRuin(ctx, w, rng) {
  const h = wallHeight(w.k);
  // front face with bricks
  ctx.fillStyle = '#6d6457';
  ctx.fillRect(w.x, w.y + w.h - h, w.w, h);
  ctx.strokeStyle = 'rgba(40,35,30,0.5)';
  ctx.lineWidth = 1;
  for (let row = 0; row < h; row += 8) {
    const y = w.y + w.h - h + row;
    ctx.beginPath();
    ctx.moveTo(w.x, y);
    ctx.lineTo(w.x + w.w, y);
    ctx.stroke();
    let offset = 9;
    if ((row / 8) % 2 === 0) {
      offset = 0;
    }
    for (let x = w.x + offset; x < w.x + w.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
    }
  }
  // jagged broken top
  const tx = w.x;
  const ty = w.y - h;
  ctx.fillStyle = '#a39785';
  ctx.beginPath();
  ctx.moveTo(tx, ty + 3);
  const steps = Math.max(4, Math.round(Math.max(w.w, w.h) / 14));
  if (w.w >= w.h) {
    for (let i = 0; i <= steps; i += 1) {
      ctx.lineTo(tx + (w.w / steps) * i, ty + rng() * 6);
    }
    ctx.lineTo(tx + w.w, ty + w.h);
    for (let i = steps; i >= 0; i -= 1) {
      ctx.lineTo(tx + (w.w / steps) * i, ty + w.h - rng() * 4);
    }
  } else {
    ctx.lineTo(tx + w.w, ty + rng() * 4);
    for (let i = 0; i <= steps; i += 1) {
      ctx.lineTo(tx + w.w - rng() * 6, ty + (w.h / steps) * i);
    }
    ctx.lineTo(tx, ty + w.h);
    for (let i = steps; i >= 0; i -= 1) {
      ctx.lineTo(tx + rng() * 6, ty + (w.h / steps) * i);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#5b5348';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // top stone joints
  ctx.strokeStyle = 'rgba(70,62,52,0.55)';
  ctx.lineWidth = 1;
  if (w.w >= w.h) {
    for (let x = tx + 16; x < tx + w.w; x += 18 + rng() * 8) {
      ctx.beginPath();
      ctx.moveTo(x, ty + 4);
      ctx.lineTo(x + rng() * 3, ty + w.h - 3);
      ctx.stroke();
    }
  } else {
    for (let y = ty + 16; y < ty + w.h; y += 18 + rng() * 8) {
      ctx.beginPath();
      ctx.moveTo(tx + 4, y);
      ctx.lineTo(tx + w.w - 4, y + rng() * 3);
      ctx.stroke();
    }
  }
  // moss and vines
  ctx.fillStyle = 'rgba(86,138,58,0.8)';
  for (let i = 0; i < Math.max(4, (w.w + w.h) / 20); i += 1) {
    blob(ctx, tx + rng() * w.w, ty + rng() * w.h, 3 + rng() * 6, 2 + rng() * 5, rng, 0.6);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(60,110,45,0.9)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 3; i += 1) {
    let vx = w.x + rng() * w.w;
    let vy = w.y + w.h - h;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    for (let k = 0; k < 4; k += 1) {
      vx += -3 + rng() * 6;
      vy += h / 4;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(96,160,64,0.9)';
    ctx.beginPath();
    ctx.ellipse(vx, vy, 3, 1.6, rng() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSandbags(ctx, w, rng) {
  const h = wallHeight(w.k);
  ctx.fillStyle = '#7d6a48';
  ctx.fillRect(w.x, w.y + w.h - h, w.w, h);
  const rows = 2;
  const bagW = 30;
  const tx = w.x;
  const ty = w.y - h;
  for (let row = 0; row < rows; row += 1) {
    const by = ty + (w.h / rows) * row;
    const bh = w.h / rows;
    let offset = 0;
    if (row % 2 === 1) {
      offset = -bagW / 2;
    }
    for (let x = tx + offset; x < tx + w.w; x += bagW - 2) {
      const left = Math.max(tx, x);
      const right = Math.min(tx + w.w, x + bagW);
      if (right - left < 6) {
        continue;
      }
      const g = ctx.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, '#d8c08c');
      g.addColorStop(1, '#9c8459');
      ctx.fillStyle = g;
      rr(ctx, left + 1, by + 1, right - left - 2, bh - 2, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(80,64,40,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // seam stitch
      ctx.strokeStyle = 'rgba(90,72,46,0.5)';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(left + 4, by + bh / 2);
      ctx.lineTo(right - 4, by + bh / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // front bag bulges
  for (let x = w.x; x < w.x + w.w; x += bagW - 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, w.y + w.h - h, 1.5, h);
  }
  speckle(ctx, rng, tx, ty, w.w, w.h, 40, ['#6e5a3a', '#efdcae'], 1, 2, 0.35);
}

function drawBarrel(ctx, w, rng) {
  const h = wallHeight(w.k);
  const cx = w.x + w.w / 2;
  const r = w.w / 2;
  const bodyTop = w.y + w.h / 2 - h;
  const g = ctx.createLinearGradient(w.x, 0, w.x + w.w, 0);
  g.addColorStop(0, '#7a1d1d');
  g.addColorStop(0.35, '#d0453a');
  g.addColorStop(1, '#5c1515');
  ctx.fillStyle = g;
  ctx.fillRect(w.x, bodyTop, w.w, h + w.h / 2);
  ctx.beginPath();
  ctx.ellipse(cx, w.y + w.h / 2 + w.h / 2 - 2, r, r * 0.35, 0, 0, Math.PI);
  ctx.fill();
  // rings
  ctx.strokeStyle = 'rgba(40,10,10,0.6)';
  ctx.lineWidth = 2;
  for (let k = 1; k <= 2; k += 1) {
    const yy = bodyTop + ((h + w.h / 2) / 3) * k;
    ctx.beginPath();
    ctx.moveTo(w.x, yy);
    ctx.lineTo(w.x + w.w, yy);
    ctx.stroke();
  }
  // lid
  ctx.fillStyle = '#b8392f';
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6b1a16';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,200,180,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#4a1210';
  ctx.beginPath();
  ctx.arc(cx + r * 0.35, bodyTop - r * 0.1, 3, 0, Math.PI * 2);
  ctx.fill();
  // hazard label
  ctx.fillStyle = '#f2c94c';
  ctx.beginPath();
  ctx.moveTo(cx, w.y + w.h / 2 - 2);
  ctx.lineTo(cx + 6, w.y + w.h / 2 + 8);
  ctx.lineTo(cx - 6, w.y + w.h / 2 + 8);
  ctx.closePath();
  ctx.fill();
  speckle(ctx, rng, w.x, bodyTop, w.w, h, 20, ['#3a0d0d'], 1, 2, 0.4);
}

function drawContainer(ctx, w, rng, color) {
  const h = wallHeight(w.k);
  faces(ctx, w, color.top, color.front, color.edge);
  const tx = w.x;
  const ty = w.y - h;
  const horizontal = w.w >= w.h;
  // corrugation ribs
  ctx.strokeStyle = color.rib;
  ctx.lineWidth = 2;
  if (horizontal) {
    for (let x = tx + 8; x < tx + w.w - 4; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, ty + 4);
      ctx.lineTo(x, ty + w.h - 4);
      ctx.stroke();
    }
  } else {
    for (let y = ty + 8; y < ty + w.h - 4; y += 7) {
      ctx.beginPath();
      ctx.moveTo(tx + 4, y);
      ctx.lineTo(tx + w.w - 4, y);
      ctx.stroke();
    }
  }
  // front ribs
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let x = w.x + 5; x < w.x + w.w; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, w.y + w.h - h + 2);
    ctx.lineTo(x, w.y + w.h - 2);
    ctx.stroke();
  }
  // corner castings
  ctx.fillStyle = 'rgba(30,30,30,0.7)';
  ctx.fillRect(tx + 1, ty + 1, 6, 6);
  ctx.fillRect(tx + w.w - 7, ty + 1, 6, 6);
  ctx.fillRect(tx + 1, ty + w.h - 7, 6, 6);
  ctx.fillRect(tx + w.w - 7, ty + w.h - 7, 6, 6);
  // snow on the roof
  ctx.fillStyle = 'rgba(240,248,255,0.92)';
  for (let i = 0; i < 7; i += 1) {
    blob(ctx, tx + rng() * w.w, ty + rng() * w.h, 8 + rng() * 16, 5 + rng() * 9, rng, 0.5);
    ctx.fill();
  }
  // stencil text stripe
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  if (horizontal) {
    ctx.fillRect(tx + w.w * 0.2, ty + w.h / 2 - 2, w.w * 0.3, 4);
  } else {
    ctx.fillRect(tx + w.w / 2 - 2, ty + w.h * 0.2, 4, w.h * 0.3);
  }
  // rust
  speckle(ctx, rng, tx, ty, w.w, w.h, 70, ['#7a3b1c', '#a0522d'], 1, 3, 0.4);
}

function drawBollard(ctx, w) {
  const h = wallHeight(w.k);
  const cx = w.x + w.w / 2;
  const r = w.w / 2;
  ctx.fillStyle = '#2c2f33';
  ctx.fillRect(w.x + 2, w.y + w.h / 2 - h, w.w - 4, h + w.h / 2 - 2);
  ctx.fillStyle = '#3c4046';
  ctx.beginPath();
  ctx.ellipse(cx, w.y + w.h / 2 - h, r, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6d737b';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,248,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx - 2, w.y + w.h / 2 - h - 1, r * 0.6, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // rope wrap
  ctx.strokeStyle = '#b89463';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w.x + 1, w.y + w.h / 2 - h / 2);
  ctx.lineTo(w.x + w.w - 1, w.y + w.h / 2 - h / 2 + 3);
  ctx.stroke();
}

function drawWall(ctx, w, rng, mapId) {
  if (w.k === 'ac') {
    drawAC(ctx, w, rng);
  } else if (w.k === 'vent') {
    drawVent(ctx, w, rng);
  } else if (w.k === 'crate') {
    if (mapId === 'desert') {
      drawCrate(ctx, w, rng, { top: '#b78a4f', front: '#7d5a30', edge: '#d3a66a', line: '#6b4c27', brace: '#8f6635' });
    } else if (mapId === 'docks') {
      drawCrate(ctx, w, rng, { top: '#8a6b47', front: '#5a4430', edge: '#a8865d', line: '#4a3824', brace: '#6b5136' });
      ctx.fillStyle = 'rgba(240,248,255,0.85)';
      blob(ctx, w.x + w.w * 0.4, w.y - wallHeight(w.k) + w.h * 0.35, w.w * 0.3, w.h * 0.2, rng, 0.5);
      ctx.fill();
    } else {
      drawCrate(ctx, w, rng, { top: '#7a5b3a', front: '#4d3925', edge: '#94724c', line: '#3d2c1c', brace: '#5c4329' });
    }
  } else if (w.k === 'pillar') {
    drawPillar(ctx, w, rng);
  } else if (w.k === 'ruin') {
    drawRuin(ctx, w, rng);
  } else if (w.k === 'sandbag') {
    drawSandbags(ctx, w, rng);
  } else if (w.k === 'barrel') {
    drawBarrel(ctx, w, rng);
  } else if (w.k === 'container') {
    const palettes = [
      { top: '#b23a2e', front: '#7a241c', edge: '#d0574a', rib: 'rgba(60,15,10,0.45)' },
      { top: '#2f6fae', front: '#1d4672', edge: '#4e8ccc', rib: 'rgba(10,30,60,0.45)' },
      { top: '#2f8f5b', front: '#1c5c3a', edge: '#4cab77', rib: 'rgba(10,50,30,0.45)' },
      { top: '#d17a22', front: '#8f4f12', edge: '#e89a49', rib: 'rgba(70,35,5,0.45)' }
    ];
    const pick = palettes[Math.floor(Math.abs(w.x * 7 + w.y * 13) % palettes.length)];
    drawContainer(ctx, w, rng, pick);
  } else if (w.k === 'bollard') {
    drawBollard(ctx, w);
  } else {
    faces(ctx, w, '#777', '#555', '#999');
  }
}

// ---------------------------------------------------------------- themes

function paintRooftop(ctx, rng, walls) {
  // City far below, seen past the roof edge.
  ctx.fillStyle = '#070912';
  ctx.fillRect(-MARGIN, -MARGIN, ARENA_W + MARGIN * 2, ARENA_H + MARGIN * 2);
  for (let i = 0; i < 900; i += 1) {
    const x = -MARGIN + rng() * (ARENA_W + MARGIN * 2);
    const y = -MARGIN + rng() * (ARENA_H + MARGIN * 2);
    const c = ['#ffd27a', '#7ae1ff', '#ff7ad9', '#ffffff'][Math.floor(rng() * 4)];
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.25 + rng() * 0.6;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Roof membrane
  ctx.fillStyle = '#262934';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  for (let y = 0; y < ARENA_H; y += 150) {
    for (let x = 0; x < ARENA_W; x += 200) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.01 + rng() * 0.025) + ')';
      ctx.fillRect(x, y, 200, 150);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  for (let y = 150; y < ARENA_H; y += 150) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ARENA_W, y);
    ctx.stroke();
  }
  for (let x = 200; x < ARENA_W; x += 200) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, ARENA_H);
    ctx.stroke();
  }
  speckle(ctx, rng, 0, 0, ARENA_W, ARENA_H, 9000, ['#3a3e4b', '#1b1d25', '#4a4f5e'], 1, 2.2, 0.55);

  // Tar patches
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = 'rgba(10,10,14,0.35)';
    blob(ctx, rng() * ARENA_W, rng() * ARENA_H, 20 + rng() * 50, 12 + rng() * 30, rng, 0.6);
    ctx.fill();
  }

  // Cables snaking along the roof
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = '#111318';
    ctx.lineWidth = 4;
    const sx = rng() * ARENA_W;
    let sy = ARENA_H;
    if (rng() < 0.5) {
      sy = 0;
    }
    const ex = rng() * ARENA_W;
    const ey = rng() * ARENA_H;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + 200 * (rng() - 0.5), ARENA_H / 2, ex + 200 * (rng() - 0.5), ey, ex, ey);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,130,150,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Helipad
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  ctx.fillStyle = '#2c303c';
  ctx.beginPath();
  ctx.arc(cx, cy, 165, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e8c547';
  ctx.lineWidth = 8;
  ctx.setLineDash([26, 14]);
  ctx.beginPath();
  ctx.arc(cx, cy, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 132, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,240,240,0.85)';
  ctx.fillRect(cx - 50, cy - 60, 22, 120);
  ctx.fillRect(cx + 28, cy - 60, 22, 120);
  ctx.fillRect(cx - 28, cy - 11, 56, 22);
  speckle(ctx, rng, cx - 165, cy - 165, 330, 330, 900, ['#1d2029', '#3c4150'], 1, 2.5, 0.5);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const lx = cx + Math.cos(a) * 172;
    const ly = cy + Math.sin(a) * 172;
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, lx, ly, 26, '#ffd27a', 0.55);
  }

  // Skylights (decor, walk over them)
  const skylights = [
    [650, 640, 92, 58],
    [858, 202, 92, 58],
    [90, 250, 60, 90],
    [1450, 560, 60, 90]
  ];
  for (const s of skylights) {
    ctx.fillStyle = '#4b5263';
    ctx.fillRect(s[0] - 4, s[1] - 4, s[2] + 8, s[3] + 8);
    const g = ctx.createLinearGradient(s[0], s[1], s[0] + s[2], s[1] + s[3]);
    g.addColorStop(0, '#1d3c55');
    g.addColorStop(0.5, '#2f6b8f');
    g.addColorStop(1, '#152a3d');
    ctx.fillStyle = g;
    ctx.fillRect(s[0], s[1], s[2], s[3]);
    ctx.strokeStyle = '#6b7385';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s[0] + s[2] / 2, s[1]);
    ctx.lineTo(s[0] + s[2] / 2, s[1] + s[3]);
    ctx.moveTo(s[0], s[1] + s[3] / 2);
    ctx.lineTo(s[0] + s[2], s[1] + s[3] / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s[0] + 6, s[1] + s[3] - 6);
    ctx.lineTo(s[0] + s[2] * 0.4, s[1] + 6);
    ctx.stroke();
    glow(ctx, s[0] + s[2] / 2, s[1] + s[3] / 2, 70, '#3ee6e0', 0.18);
  }

  // Puddles reflecting the neon
  for (let i = 0; i < 16; i += 1) {
    const px = rng() * ARENA_W;
    const py = rng() * ARENA_H;
    if (!inOpenFloor(px, py, walls, 30)) {
      continue;
    }
    let tint = 'rgba(62,230,224,';
    if (rng() < 0.5) {
      tint = 'rgba(255,77,190,';
    }
    const g = ctx.createRadialGradient(px, py, 2, px, py, 60);
    g.addColorStop(0, tint + '0.28)');
    g.addColorStop(1, 'rgba(20,25,40,0.2)');
    ctx.fillStyle = g;
    blob(ctx, px, py, 26 + rng() * 40, 12 + rng() * 22, rng, 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Parapet around the edge, with neon strips
  ctx.fillStyle = '#4a4e5c';
  ctx.fillRect(-MARGIN + 30, -MARGIN + 30, ARENA_W + 36, 18);
  ctx.fillRect(-MARGIN + 30, ARENA_H, ARENA_W + 36, 18);
  ctx.fillRect(-MARGIN + 30, -MARGIN + 30, 18, ARENA_H + 36);
  ctx.fillRect(ARENA_W, -MARGIN + 30, 18, ARENA_H + 36);
  ctx.fillStyle = '#5d6272';
  ctx.fillRect(-18, -18, ARENA_W + 36, 6);
  ctx.fillRect(-18, ARENA_H + 12, ARENA_W + 36, 6);
  const neon = [
    ['#ff4dc4', 0, -6, ARENA_W, 3],
    ['#3ee6e0', 0, ARENA_H + 3, ARENA_W, 3],
    ['#ff4dc4', -6, 0, 3, ARENA_H],
    ['#3ee6e0', ARENA_W + 3, 0, 3, ARENA_H]
  ];
  for (const n of neon) {
    ctx.fillStyle = n[0];
    ctx.fillRect(n[1], n[2], n[3], n[4]);
  }
  for (let x = 0; x <= ARENA_W; x += 160) {
    glow(ctx, x, -4, 80, '#ff4dc4', 0.3);
    glow(ctx, x, ARENA_H + 4, 80, '#3ee6e0', 0.3);
  }
  for (let y = 0; y <= ARENA_H; y += 150) {
    glow(ctx, -4, y, 80, '#ff4dc4', 0.25);
    glow(ctx, ARENA_W + 4, y, 80, '#3ee6e0', 0.25);
  }
  // Neon sign spill in two corners
  glow(ctx, 60, 60, 260, '#ff4dc4', 0.22);
  glow(ctx, ARENA_W - 60, ARENA_H - 60, 260, '#3ee6e0', 0.22);
  glow(ctx, ARENA_W - 60, 60, 200, '#c77dff', 0.15);
  glow(ctx, 60, ARENA_H - 60, 200, '#c77dff', 0.15);
}

function paintRuins(ctx, rng, walls) {
  // Jungle around the ruin
  ctx.fillStyle = '#1d3a1c';
  ctx.fillRect(-MARGIN, -MARGIN, ARENA_W + MARGIN * 2, ARENA_H + MARGIN * 2);
  for (let i = 0; i < 520; i += 1) {
    let x = -MARGIN + rng() * (ARENA_W + MARGIN * 2);
    let y = -MARGIN + rng() * (ARENA_H + MARGIN * 2);
    const side = Math.floor(rng() * 4);
    if (side === 0) {
      y = -MARGIN + rng() * (MARGIN + 6);
    } else if (side === 1) {
      y = ARENA_H - 6 + rng() * (MARGIN + 6);
    } else if (side === 2) {
      x = -MARGIN + rng() * (MARGIN + 6);
    } else {
      x = ARENA_W - 6 + rng() * (MARGIN + 6);
    }
    const shade = 30 + Math.floor(rng() * 70);
    ctx.fillStyle = 'rgb(' + Math.floor(shade * 0.5) + ',' + (shade + 40) + ',' + Math.floor(shade * 0.45) + ')';
    blob(ctx, x, y, 10 + rng() * 18, 8 + rng() * 14, rng, 0.5);
    ctx.fill();
  }

  // Flagstones
  ctx.fillStyle = '#4a5a3a';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const tile = 50;
  for (let gy = 0; gy < ARENA_H; gy += tile) {
    let rowOffset = tile / 2;
    if (Math.floor(gy / tile) % 2 === 0) {
      rowOffset = 0;
    }
    for (let gx = -tile; gx < ARENA_W + tile; gx += tile) {
      const x = gx + rowOffset;
      const shade = 122 + Math.floor(rng() * 22);
      const warm = Math.floor(rng() * 10);
      ctx.fillStyle = 'rgb(' + (shade + warm) + ',' + (shade - 4 + warm) + ',' + (shade - 18) + ')';
      rr(ctx, x + 2, gy + 2, tile - 4, tile - 4, 4);
      ctx.fill();
      if (rng() < 0.18) {
        ctx.strokeStyle = 'rgba(60,52,40,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        let cx = x + 6 + rng() * (tile - 12);
        let cy = gy + 4;
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 4; k += 1) {
          cx += -6 + rng() * 12;
          cy += 6 + rng() * 6;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }
  }
  speckle(ctx, rng, 0, 0, ARENA_W, ARENA_H, 5000, ['#8a8170', '#b3aa94', '#6f6a5c'], 1, 2, 0.3);

  // Center mosaic
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  ctx.fillStyle = '#b39a6c';
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.fill();
  for (let ring = 0; ring < 3; ring += 1) {
    const r0 = 50 + ring * 24;
    const count = 16 + ring * 8;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      ctx.fillStyle = ['#3d6b6e', '#a8553a', '#d9c48f'][(i + ring) % 3];
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.rotate(a);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
  }
  ctx.strokeStyle = 'rgba(70,55,35,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 120, 0, Math.PI * 2);
  ctx.stroke();

  // Moss creeping between stones and grass patches
  for (let i = 0; i < 70; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    const big = rng() < 0.3;
    let rx = 10 + rng() * 20;
    if (big) {
      rx = 30 + rng() * 50;
    }
    ctx.fillStyle = 'rgba(' + (60 + Math.floor(rng() * 30)) + ',' + (110 + Math.floor(rng() * 40)) + ',45,0.55)';
    blob(ctx, x, y, rx, rx * (0.5 + rng() * 0.4), rng, 0.6);
    ctx.fill();
    // blades
    ctx.strokeStyle = 'rgba(110,170,70,0.8)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < rx; k += 1) {
      const bx = x - rx + rng() * rx * 2;
      const by = y - rx * 0.4 + rng() * rx * 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 2 + rng() * 4, by - 4 - rng() * 5);
      ctx.stroke();
    }
  }
  // flowers
  for (let i = 0; i < 80; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    ctx.fillStyle = ['#ffe066', '#ff8fab', '#ffffff', '#c77dff'][Math.floor(rng() * 4)];
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 2, y + Math.sin(a) * 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f4a261';
    ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
  }
  // rubble
  for (let i = 0; i < 90; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    if (!inOpenFloor(x, y, walls, 6)) {
      continue;
    }
    const s = 3 + rng() * 7;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 2, s, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ['#9c9381', '#b5ab96', '#857c6b'][Math.floor(rng() * 3)];
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s * 0.3, y - s * 0.8);
    ctx.lineTo(x + s * 0.8, y - s * 0.4);
    ctx.lineTo(x + s * 0.6, y + s * 0.6);
    ctx.lineTo(x - s * 0.4, y + s * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  // fallen leaves
  for (let i = 0; i < 140; i += 1) {
    ctx.fillStyle = ['#c97b2a', '#a3561b', '#d9a441', '#6f8f3a'][Math.floor(rng() * 4)];
    ctx.save();
    ctx.translate(rng() * ARENA_W, rng() * ARENA_H);
    ctx.rotate(rng() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // edge: low stone border
  ctx.fillStyle = '#7a7262';
  ctx.fillRect(-12, -12, ARENA_W + 24, 12);
  ctx.fillRect(-12, ARENA_H, ARENA_W + 24, 12);
  ctx.fillRect(-12, -12, 12, ARENA_H + 24);
  ctx.fillRect(ARENA_W, -12, 12, ARENA_H + 24);
  ctx.strokeStyle = 'rgba(40,35,28,0.6)';
  ctx.lineWidth = 1;
  for (let x = 0; x < ARENA_W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, -12);
    ctx.lineTo(x, 0);
    ctx.moveTo(x + 15, ARENA_H);
    ctx.lineTo(x + 15, ARENA_H + 12);
    ctx.stroke();
  }
}

function paintDesert(ctx, rng, walls) {
  ctx.fillStyle = '#c99a5b';
  ctx.fillRect(-MARGIN, -MARGIN, ARENA_W + MARGIN * 2, ARENA_H + MARGIN * 2);
  // base sand with gentle tone variation
  ctx.fillStyle = '#dcb67a';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  for (let i = 0; i < 40; i += 1) {
    if (rng() < 0.5) {
      ctx.fillStyle = 'rgba(170,120,60,0.12)';
    } else {
      ctx.fillStyle = 'rgba(255,230,180,0.14)';
    }
    blob(ctx, rng() * ARENA_W, rng() * ARENA_H, 80 + rng() * 160, 40 + rng() * 90, rng, 0.5);
    ctx.fill();
  }
  // wind ripples
  ctx.lineWidth = 1.2;
  for (let y = -20; y < ARENA_H + 20; y += 9) {
    ctx.strokeStyle = 'rgba(150,105,55,' + (0.12 + rng() * 0.12) + ')';
    ctx.beginPath();
    const phase = rng() * 10;
    for (let x = 0; x <= ARENA_W; x += 12) {
      const yy = y + Math.sin(x / 70 + phase) * 6 + Math.sin(x / 23 + y) * 1.5;
      if (x === 0) {
        ctx.moveTo(x, yy);
      } else {
        ctx.lineTo(x, yy);
      }
    }
    ctx.stroke();
  }
  speckle(ctx, rng, 0, 0, ARENA_W, ARENA_H, 9000, ['#b88a4f', '#f0d39c', '#a3763f'], 1, 2, 0.5);

  // tire tracks crossing the yard
  function track(x1, y1, x2, y2) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    for (const off of [-14, 14]) {
      ctx.strokeStyle = 'rgba(120,85,45,0.32)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x1 + nx * off, y1 + ny * off);
      ctx.lineTo(x2 + nx * off, y2 + ny * off);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(90,60,30,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  track(-40, 120, ARENA_W + 40, 780);
  track(300, ARENA_H + 40, 1300, -40);

  // oil stains
  for (let i = 0; i < 8; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    const g = ctx.createRadialGradient(x, y, 2, x, y, 40);
    g.addColorStop(0, 'rgba(40,30,20,0.45)');
    g.addColorStop(1, 'rgba(40,30,20,0)');
    ctx.fillStyle = g;
    blob(ctx, x, y, 30 + rng() * 20, 18 + rng() * 14, rng, 0.6);
    ctx.fill();
  }
  // painted landing marker in the middle
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(ARENA_W / 2, ARENA_H / 2, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.arc(ARENA_W / 2, ARENA_H / 2, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  speckle(ctx, rng, ARENA_W / 2 - 120, ARENA_H / 2 - 120, 240, 240, 600, ['#dcb67a', '#c99a5b'], 2, 4, 0.7);

  // rocks
  for (let i = 0; i < 60; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    if (!inOpenFloor(x, y, walls, 10)) {
      continue;
    }
    const s = 4 + rng() * 9;
    ctx.fillStyle = 'rgba(80,50,20,0.3)';
    ctx.beginPath();
    ctx.ellipse(x + s * 0.6, y + s * 0.5, s, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ['#8a6a48', '#a3825b', '#6f5338'][Math.floor(rng() * 3)];
    blob(ctx, x, y, s, s * 0.75, rng, 0.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,210,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - s * 0.3, y - s * 0.3, s * 0.35, s * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // bones and scrub
  for (let i = 0; i < 26; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    ctx.strokeStyle = 'rgba(110,90,40,0.85)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 9; k += 1) {
      const a = rng() * Math.PI * 2;
      const l = 4 + rng() * 8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.translate(rng() * ARENA_W, rng() * ARENA_H);
    ctx.rotate(rng() * Math.PI);
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(-9, -1.5, 18, 3);
    ctx.beginPath();
    ctx.arc(-9, -2, 2.4, 0, Math.PI * 2);
    ctx.arc(-9, 2, 2.4, 0, Math.PI * 2);
    ctx.arc(9, -2, 2.4, 0, Math.PI * 2);
    ctx.arc(9, 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // perimeter: chain link fence posts and wire
  ctx.strokeStyle = 'rgba(80,80,80,0.6)';
  ctx.lineWidth = 1;
  for (let x = -MARGIN; x < ARENA_W + MARGIN; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.lineTo(x + 8, -2);
    ctx.moveTo(x + 8, -10);
    ctx.lineTo(x, -2);
    ctx.moveTo(x, ARENA_H + 2);
    ctx.lineTo(x + 8, ARENA_H + 10);
    ctx.moveTo(x + 8, ARENA_H + 2);
    ctx.lineTo(x, ARENA_H + 10);
    ctx.stroke();
  }
  for (let y = -MARGIN; y < ARENA_H + MARGIN; y += 8) {
    ctx.beginPath();
    ctx.moveTo(-10, y);
    ctx.lineTo(-2, y + 8);
    ctx.moveTo(-2, y);
    ctx.lineTo(-10, y + 8);
    ctx.moveTo(ARENA_W + 2, y);
    ctx.lineTo(ARENA_W + 10, y + 8);
    ctx.moveTo(ARENA_W + 10, y);
    ctx.lineTo(ARENA_W + 2, y + 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#5a5a5a';
  for (let x = -6; x <= ARENA_W + 6; x += 100) {
    ctx.fillRect(x - 3, -12, 6, 12);
    ctx.fillRect(x - 3, ARENA_H, 6, 12);
  }
  for (let y = -6; y <= ARENA_H + 6; y += 100) {
    ctx.fillRect(-12, y - 3, 12, 6);
    ctx.fillRect(ARENA_W, y - 3, 12, 6);
  }
  // cacti outside the fence
  for (let i = 0; i < 18; i += 1) {
    let x = rng() * ARENA_W;
    let y = -30;
    if (i % 2 === 1) {
      y = ARENA_H + 30;
    }
    if (i > 12) {
      if (i % 2 === 0) {
        x = -30;
      } else {
        x = ARENA_W + 30;
      }
      y = rng() * ARENA_H;
    }
    ctx.fillStyle = '#4f7a3a';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a9a4c';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // heat: warm overall sunlight
  glow(ctx, ARENA_W * 0.3, ARENA_H * 0.2, 700, '#ffb347', 0.12);
}

function paintDocks(ctx, rng, walls) {
  // Icy harbor water
  const water = ctx.createLinearGradient(0, -MARGIN, 0, ARENA_H + MARGIN);
  water.addColorStop(0, '#0d2233');
  water.addColorStop(1, '#0a1a28');
  ctx.fillStyle = water;
  ctx.fillRect(-MARGIN, -MARGIN, ARENA_W + MARGIN * 2, ARENA_H + MARGIN * 2);
  ctx.strokeStyle = 'rgba(160,210,240,0.18)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 260; i += 1) {
    const x = -MARGIN + rng() * (ARENA_W + MARGIN * 2);
    const y = -MARGIN + rng() * (ARENA_H + MARGIN * 2);
    ctx.beginPath();
    ctx.arc(x, y, 6 + rng() * 8, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  for (let i = 0; i < 26; i += 1) {
    let x = rng() * ARENA_W;
    let y = -28;
    if (i % 2 === 1) {
      y = ARENA_H + 28;
    }
    ctx.fillStyle = 'rgba(220,238,250,0.85)';
    blob(ctx, x, y, 8 + rng() * 14, 5 + rng() * 8, rng, 0.6);
    ctx.fill();
  }

  // Plank deck
  ctx.fillStyle = '#5b4632';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const plankH = 26;
  for (let y = 0; y < ARENA_H; y += plankH) {
    let x = -rng() * 200;
    while (x < ARENA_W) {
      const len = 140 + rng() * 220;
      const shade = 88 + Math.floor(rng() * 30);
      ctx.fillStyle = 'rgb(' + shade + ',' + Math.floor(shade * 0.76) + ',' + Math.floor(shade * 0.55) + ')';
      ctx.fillRect(x + 1, y + 1, len - 2, plankH - 2);
      // grain
      ctx.strokeStyle = 'rgba(50,35,20,0.35)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g += 1) {
        const gy = y + 5 + rng() * (plankH - 10);
        ctx.beginPath();
        ctx.moveTo(x + 4, gy);
        ctx.bezierCurveTo(x + len * 0.3, gy - 2, x + len * 0.6, gy + 2, x + len - 4, gy);
        ctx.stroke();
      }
      if (rng() < 0.25) {
        ctx.fillStyle = 'rgba(40,28,15,0.5)';
        ctx.beginPath();
        ctx.ellipse(x + rng() * len, y + plankH / 2, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // nails
      ctx.fillStyle = 'rgba(30,30,30,0.7)';
      ctx.fillRect(x + 6, y + 6, 2, 2);
      ctx.fillRect(x + 6, y + plankH - 8, 2, 2);
      ctx.fillRect(x + len - 8, y + 6, 2, 2);
      ctx.fillRect(x + len - 8, y + plankH - 8, 2, 2);
      x += len;
    }
  }
  // wet dark seams
  ctx.fillStyle = 'rgba(20,14,8,0.6)';
  for (let y = 0; y < ARENA_H; y += plankH) {
    ctx.fillRect(0, y, ARENA_W, 1.5);
  }

  // Ice sheets
  for (let i = 0; i < 9; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90);
    g.addColorStop(0, 'rgba(210,240,255,0.55)');
    g.addColorStop(1, 'rgba(170,215,240,0.2)');
    ctx.fillStyle = g;
    blob(ctx, x, y, 50 + rng() * 60, 30 + rng() * 40, rng, 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k += 1) {
      ctx.beginPath();
      let cx = x;
      let cy = y;
      ctx.moveTo(cx, cy);
      const a = rng() * Math.PI * 2;
      for (let s = 0; s < 4; s += 1) {
        cx += Math.cos(a + (rng() - 0.5)) * 12;
        cy += Math.sin(a + (rng() - 0.5)) * 12;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  // Snow drifts: soft piles banked against the edges, light dusting elsewhere
  function drift(x, y, rx, ry, strength) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(244,250,255,' + strength + ')');
    g.addColorStop(0.55, 'rgba(236,246,255,' + strength * 0.7 + ')');
    g.addColorStop(1, 'rgba(230,242,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (let i = 0; i < 90; i += 1) {
    const side = Math.floor(rng() * 4);
    let x = rng() * ARENA_W;
    let y = rng() * ARENA_H;
    if (side === 0) {
      y = rng() * 30;
    } else if (side === 1) {
      y = ARENA_H - rng() * 30;
    } else if (side === 2) {
      x = rng() * 30;
    } else {
      x = ARENA_W - rng() * 30;
    }
    drift(x, y, 40 + rng() * 70, 20 + rng() * 30, 0.75 + rng() * 0.2);
  }
  for (const w of walls) {
    // snow piles up against the north side of cover
    drift(w.x + w.w / 2, w.y - wallHeight(w.k) - 4, w.w * 0.6 + 10, 14, 0.6);
  }
  for (let i = 0; i < 40; i += 1) {
    drift(rng() * ARENA_W, rng() * ARENA_H, 30 + rng() * 60, 14 + rng() * 26, 0.22 + rng() * 0.2);
  }
  speckle(ctx, rng, 0, 0, ARENA_W, ARENA_H, 3000, ['#ffffff', '#dbeefa'], 1, 2, 0.35);
  // footprints across the deck
  ctx.fillStyle = 'rgba(70,55,40,0.35)';
  for (let t = 0; t < 2; t += 1) {
    let fx = 120 + rng() * 300;
    let fy = 120 + rng() * 600;
    const fa = rng() * 0.6 - 0.3;
    for (let s = 0; s < 40; s += 1) {
      let side = 1;
      if (s % 2 === 0) {
        side = -1;
      }
      ctx.save();
      ctx.translate(fx - Math.sin(fa) * side * 6, fy + Math.cos(fa) * side * 6);
      ctx.rotate(fa);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      fx += Math.cos(fa) * 24;
      fy += Math.sin(fa) * 24;
    }
  }

  // Yellow safety line around the deck
  ctx.strokeStyle = '#e8c547';
  ctx.lineWidth = 5;
  ctx.setLineDash([30, 18]);
  ctx.strokeRect(22, 22, ARENA_W - 44, ARENA_H - 44);
  ctx.setLineDash([]);

  // Rope coils and chains
  for (let i = 0; i < 6; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    if (!inOpenFloor(x, y, walls, 30)) {
      continue;
    }
    for (let r = 14; r > 3; r -= 3) {
      if (r % 2 === 0) {
        ctx.strokeStyle = '#b89463';
      } else {
        ctx.strokeStyle = '#9c7a4d';
      }
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 4; i += 1) {
    let x = rng() * ARENA_W;
    let y = rng() * ARENA_H;
    ctx.strokeStyle = '#5a5f66';
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k += 1) {
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 3, k * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      x += 7;
      y += Math.sin(k) * 3;
    }
  }
  // Dock edge timber and pilings
  ctx.fillStyle = '#3d2e20';
  ctx.fillRect(-14, -14, ARENA_W + 28, 14);
  ctx.fillRect(-14, ARENA_H, ARENA_W + 28, 14);
  ctx.fillRect(-14, -14, 14, ARENA_H + 28);
  ctx.fillRect(ARENA_W, -14, 14, ARENA_H + 28);
  for (let x = 0; x <= ARENA_W; x += 120) {
    for (const y of [-20, ARENA_H + 20]) {
      ctx.fillStyle = '#2f241a';
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240,248,255,0.9)';
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Cold light and warm dock lamps
  ctx.fillStyle = 'rgba(80,140,200,0.10)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  const lamps = [
    [40, 40],
    [ARENA_W - 40, ARENA_H - 40],
    [ARENA_W - 40, 40],
    [40, ARENA_H - 40]
  ];
  for (const l of lamps) {
    glow(ctx, l[0], l[1], 280, '#ffb75e', 0.32);
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(l[0], l[1], 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff1c2';
    ctx.beginPath();
    ctx.arc(l[0], l[1], 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

const THEMES = {
  rooftop: {
    paint: paintRooftop,
    light: { dx: 0.5, dy: 0.7, shadowAlpha: 0.55, blur: 4 },
    vignette: 0.55
  },
  ruins: {
    paint: paintRuins,
    light: { dx: 0.9, dy: 0.9, shadowAlpha: 0.38, blur: 3 },
    vignette: 0.4
  },
  desert: {
    paint: paintDesert,
    light: { dx: 1.6, dy: 1.1, shadowAlpha: 0.32, blur: 2 },
    vignette: 0.3
  },
  docks: {
    paint: paintDocks,
    light: { dx: 0.6, dy: 0.8, shadowAlpha: 0.45, blur: 3 },
    vignette: 0.5
  }
};

// Canopy shade for the ruins: soft dappled light over everything.
function dapple(ctx, rng) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let i = 0; i < 40; i += 1) {
    const x = rng() * ARENA_W;
    const y = rng() * ARENA_H;
    const r = 60 + rng() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(60,80,50,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  for (let i = 0; i < 18; i += 1) {
    glow(ctx, rng() * ARENA_W, rng() * ARENA_H, 50 + rng() * 80, '#fff2c0', 0.12);
  }
}

const cache = new Map();

export function buildMapLayer(mapIndex, scale) {
  const key = mapIndex + ':' + scale;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const map = MAPS[mapIndex];
  const theme = THEMES[map.id];
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((ARENA_W + MARGIN * 2) * scale);
  canvas.height = Math.round((ARENA_H + MARGIN * 2) * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(MARGIN, MARGIN);
  const rng = mulberry32(9001 + mapIndex * 77);

  theme.paint(ctx, rng, map.walls);
  if (map.id === 'ruins') {
    dapple(ctx, rng);
  }
  for (const w of map.walls) {
    shadowFor(ctx, w, theme.light);
  }
  const sorted = map.walls.slice().sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const w of sorted) {
    drawWall(ctx, w, rng, map.id);
  }
  vignette(ctx, theme.vignette);
  cache.set(key, canvas);
  return canvas;
}

export function clearMapCache() {
  cache.clear();
}
