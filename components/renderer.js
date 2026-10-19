import { ARENA_W, ARENA_H, PLAYER_R } from '../lib/constants.js';
import { MAPS } from '../lib/maps.js';
import { ZONE_START_RADIUS } from '../lib/sim.js';
import { buildMapLayer, MARGIN } from './mapArt.js';

const VIEW_W = ARENA_W + MARGIN * 2;
const VIEW_H = ARENA_H + MARGIN * 2;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt < 0) {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  } else {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  }
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.k = 1;
    this.ox = 0;
    this.oy = 0;
    this.dpr = 1;
    this.layer = null;
    this.layerKey = '';
    this.mapIndex = -1;
    this.decals = null;
    this.decalCtx = null;
    this.particles = [];
    this.texts = [];
    this.ghosts = [];
    this.weather = [];
    this.flash = new Map(); // player id -> hit flash time
    this.muzzle = new Map(); // player id -> muzzle flash time
    this.shake = 0;
    this.hurt = 0;
    this.time = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.dpr = dpr;
    const fit = Math.min(cw / VIEW_W, ch / VIEW_H);
    this.k = fit * dpr;
    this.ox = (this.canvas.width - VIEW_W * this.k) / 2;
    this.oy = (this.canvas.height - VIEW_H * this.k) / 2;
    this.layerKey = '';
  }

  screenToWorld(clientX, clientY) {
    const px = clientX * this.dpr;
    const py = clientY * this.dpr;
    return {
      x: (px - this.ox) / this.k - MARGIN,
      y: (py - this.oy) / this.k - MARGIN
    };
  }

  ensureLayer(mapIndex) {
    let scale = Math.ceil(this.k * 2) / 2;
    if (scale > 2) {
      scale = 2;
    }
    if (scale < 0.5) {
      scale = 0.5;
    }
    const key = mapIndex + ':' + scale;
    if (key !== this.layerKey) {
      this.layer = buildMapLayer(mapIndex, scale);
      this.layerKey = key;
    }
    if (mapIndex !== this.mapIndex) {
      this.mapIndex = mapIndex;
      this.resetRound();
    }
  }

  resetRound() {
    const c = document.createElement('canvas');
    c.width = VIEW_W;
    c.height = VIEW_H;
    this.decals = c;
    this.decalCtx = c.getContext('2d');
    this.decalCtx.translate(MARGIN, MARGIN);
    this.particles = [];
    this.texts = [];
    this.ghosts = [];
    this.weather = [];
  }

  // ------------------------------------------------------------ effects

  addParticle(p) {
    if (this.particles.length > 900) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  burst(x, y, color, count, speed, life, size, kind) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.addParticle({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.5),
        max: life,
        size: size * (0.5 + Math.random() * 0.8),
        color,
        kind,
        drag: 4
      });
    }
  }

  handleEvent(e, info) {
    const type = e[0];
    if (type === 's') {
      const p = info.byId(e[1]);
      this.muzzle.set(e[1], this.time);
      let color = '#ffffff';
      if (p) {
        color = p.color;
      }
      for (let i = 0; i < 4; i += 1) {
        const a = e[4] + (Math.random() - 0.5) * 0.7;
        const s = 200 + Math.random() * 260;
        this.addParticle({ x: e[2], y: e[3], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.12, max: 0.12, size: 2.5, color: '#ffe8a3', kind: 'spark', drag: 8 });
      }
      this.addParticle({ x: e[2], y: e[3], vx: 0, vy: 0, life: 0.07, max: 0.07, size: 22, color, kind: 'light', drag: 0 });
      // shell casing
      const side = e[4] + Math.PI / 2;
      this.addParticle({ x: e[2] - Math.cos(e[4]) * 20, y: e[3] - Math.sin(e[4]) * 20, vx: Math.cos(side) * 120, vy: Math.sin(side) * 120, life: 0.4, max: 0.4, size: 2, color: '#d4a64a', kind: 'debris', drag: 6 });
      return;
    }
    if (type === 'h') {
      const target = info.byId(e[1]);
      this.flash.set(e[1], this.time);
      let color = '#ffffff';
      if (target) {
        color = target.color;
      }
      this.burst(e[2], e[3], color, 8, 260, 0.35, 3, 'debris');
      this.burst(e[2], e[3], '#ffffff', 5, 380, 0.15, 2, 'spark');
      this.texts.push({
        x: e[2] + (Math.random() - 0.5) * 16,
        y: e[3] - 26,
        text: String(e[4]),
        life: 0.8,
        max: 0.8,
        big: e[4] >= 40,
        mine: e[5] === info.meId,
        zone: e[5] === 'zone'
      });
      if (e[1] === info.meId) {
        this.shake = Math.max(this.shake, Math.min(14, 4 + e[4] * 0.15));
        this.hurt = Math.min(1, this.hurt + 0.25 + e[4] / 120);
      }
      if (this.decalCtx && Math.random() < 0.5) {
        this.decalCtx.fillStyle = rgba(color, 0.25);
        this.decalCtx.beginPath();
        this.decalCtx.arc(e[2] + (Math.random() - 0.5) * 20, e[3] + (Math.random() - 0.5) * 20, 2 + Math.random() * 4, 0, Math.PI * 2);
        this.decalCtx.fill();
      }
      return;
    }
    if (type === 'k') {
      const victim = info.byId(e[1]);
      let color = '#ffffff';
      if (victim) {
        color = victim.color;
      }
      this.burst(e[3], e[4], color, 40, 520, 0.9, 5, 'debris');
      this.burst(e[3], e[4], '#ffffff', 16, 700, 0.3, 3, 'spark');
      this.addParticle({ x: e[3], y: e[4], vx: 0, vy: 0, life: 0.5, max: 0.5, size: 90, color, kind: 'ring', drag: 0 });
      this.addParticle({ x: e[3], y: e[4], vx: 0, vy: 0, life: 0.25, max: 0.25, size: 120, color, kind: 'light', drag: 0 });
      this.shake = Math.max(this.shake, 10);
      if (this.decalCtx) {
        const d = this.decalCtx;
        for (let i = 0; i < 14; i += 1) {
          d.fillStyle = rgba(color, 0.35 + Math.random() * 0.3);
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 46;
          d.beginPath();
          d.arc(e[3] + Math.cos(a) * r, e[4] + Math.sin(a) * r, 3 + Math.random() * 9, 0, Math.PI * 2);
          d.fill();
        }
        d.fillStyle = rgba(color, 0.5);
        d.beginPath();
        d.arc(e[3], e[4], 16, 0, Math.PI * 2);
        d.fill();
      }
      return;
    }
    if (type === 'x') {
      const r = e[3];
      this.addParticle({ x: e[1], y: e[2], vx: 0, vy: 0, life: 0.35, max: 0.35, size: r, color: '#ffb347', kind: 'ring', drag: 0 });
      this.addParticle({ x: e[1], y: e[2], vx: 0, vy: 0, life: 0.2, max: 0.2, size: r * 1.6, color: '#ffcf70', kind: 'light', drag: 0 });
      this.burst(e[1], e[2], '#ff7b29', 22, r * 5, 0.5, 5, 'spark');
      this.burst(e[1], e[2], '#555555', 10, r * 1.5, 1.1, 14, 'smoke');
      this.shake = Math.max(this.shake, 6 + r / 20);
      if (this.decalCtx) {
        const g = this.decalCtx.createRadialGradient(e[1], e[2], 2, e[1], e[2], r * 0.8);
        g.addColorStop(0, 'rgba(20,15,10,0.55)');
        g.addColorStop(1, 'rgba(20,15,10,0)');
        this.decalCtx.fillStyle = g;
        this.decalCtx.fillRect(e[1] - r, e[2] - r, r * 2, r * 2);
      }
      return;
    }
    if (type === 'w') {
      this.burst(e[1], e[2], '#ffe8a3', 5, 240, 0.18, 2, 'spark');
      this.burst(e[1], e[2], '#b8b0a0', 3, 90, 0.5, 3, 'debris');
      if (this.decalCtx && Math.random() < 0.6) {
        this.decalCtx.fillStyle = 'rgba(20,20,20,0.45)';
        this.decalCtx.beginPath();
        this.decalCtx.arc(e[1], e[2], 1.8, 0, Math.PI * 2);
        this.decalCtx.fill();
      }
      return;
    }
    if (type === 'd') {
      const p = info.byId(e[1]);
      if (p) {
        this.burst(p.x, p.y, '#ffffff', 10, 200, 0.35, 6, 'smoke');
      }
      return;
    }
    if (type === 'rv') {
      const p = info.byId(e[1]);
      if (p) {
        this.addParticle({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 70, color: '#5cff8a', kind: 'ring', drag: 0 });
        this.burst(p.x, p.y, '#5cff8a', 24, 300, 0.6, 3, 'spark');
      }
    }
  }

  // ------------------------------------------------------------ weather

  updateWeather(dt, kind) {
    const target = 160;
    while (this.weather.length < target) {
      this.weather.push(this.spawnWeather(kind, true));
    }
    for (let i = 0; i < this.weather.length; i += 1) {
      const w = this.weather[i];
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.t += dt;
      if (kind === 'leaves') {
        w.vx += Math.sin(w.t * 1.7 + w.seed) * 20 * dt;
      }
      if (w.y > ARENA_H + 60 || w.x > ARENA_W + 60 || w.x < -60 || w.t > w.life) {
        this.weather[i] = this.spawnWeather(kind, false);
      }
    }
  }

  spawnWeather(kind, anywhere) {
    let x = Math.random() * (ARENA_W + 200) - 100;
    let y = -40;
    if (anywhere) {
      y = Math.random() * ARENA_H;
    }
    const seed = Math.random() * 10;
    if (kind === 'rain') {
      return { x, y, vx: -120, vy: 900 + Math.random() * 300, t: 0, life: 3, seed };
    }
    if (kind === 'snow') {
      return { x, y, vx: -20 + Math.random() * 40, vy: 40 + Math.random() * 50, t: 0, life: 30, seed, size: 1 + Math.random() * 2.4 };
    }
    if (kind === 'leaves') {
      return { x, y, vx: 30 + Math.random() * 30, vy: 30 + Math.random() * 40, t: 0, life: 40, seed, size: 3 + Math.random() * 2 };
    }
    // dust
    x = -60;
    if (anywhere) {
      x = Math.random() * ARENA_W;
    }
    y = Math.random() * ARENA_H;
    return { x, y, vx: 80 + Math.random() * 120, vy: -10 + Math.random() * 20, t: 0, life: 30, seed, size: 1 + Math.random() * 2 };
  }

  drawWeather(ctx, kind) {
    if (kind === 'rain') {
      ctx.strokeStyle = 'rgba(170,200,255,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const w of this.weather) {
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + w.vx * 0.02, w.y + w.vy * 0.02);
      }
      ctx.stroke();
      return;
    }
    if (kind === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const w of this.weather) {
        ctx.beginPath();
        ctx.arc(w.x + Math.sin(w.t + w.seed) * 6, w.y, w.size, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    if (kind === 'leaves') {
      for (const w of this.weather) {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.t * 2 + w.seed);
        ctx.scale(1, Math.abs(Math.sin(w.t * 3 + w.seed)) * 0.8 + 0.2);
        if (w.seed > 5) {
          ctx.fillStyle = 'rgba(214,140,50,0.85)';
        } else {
          ctx.fillStyle = 'rgba(120,170,70,0.85)';
        }
        ctx.beginPath();
        ctx.ellipse(0, 0, w.size, w.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    ctx.fillStyle = 'rgba(255,230,190,0.35)';
    for (const w of this.weather) {
      ctx.fillRect(w.x, w.y + Math.sin(w.t * 2 + w.seed) * 4, w.size * 2, w.size);
    }
  }

  // ------------------------------------------------------------ frame

  render(view, dt) {
    this.time += dt;
    const ctx = this.ctx;
    const map = MAPS[view.mapIndex];
    this.ensureLayer(view.mapIndex);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    let sx = 0;
    let sy = 0;
    if (this.shake > 0.1) {
      sx = (Math.random() - 0.5) * this.shake;
      sy = (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-10 * dt);
    } else {
      this.shake = 0;
    }
    const k = this.k;
    ctx.setTransform(k, 0, 0, k, this.ox + sx * k, this.oy + sy * k);
    ctx.drawImage(this.layer, 0, 0, VIEW_W, VIEW_H);
    ctx.translate(MARGIN, MARGIN);
    if (this.decals) {
      ctx.drawImage(this.decals, -MARGIN, -MARGIN);
    }

    this.drawZone(ctx, view);

    // Dash afterimages
    for (const p of view.players) {
      if (p.alive && p.dashing) {
        this.ghosts.push({ x: p.x, y: p.y, color: p.color, life: 0.22 });
      }
    }
    for (const g of this.ghosts) {
      g.life -= dt;
      if (g.life > 0) {
        ctx.fillStyle = rgba(g.color, g.life * 1.6);
        ctx.beginPath();
        ctx.arc(g.x, g.y, PLAYER_R * (0.7 + g.life), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.ghosts = this.ghosts.filter((g) => g.life > 0);

    // Player shadows
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const p of view.players) {
      if (!p.alive) {
        continue;
      }
      ctx.beginPath();
      ctx.ellipse(p.x + 4, p.y + PLAYER_R * 0.75, PLAYER_R * 0.95, PLAYER_R * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawBullets(ctx, view);

    const sorted = view.players.slice().sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      if (p.alive) {
        this.drawPlayer(ctx, p, view);
      }
    }

    this.drawParticles(ctx, dt);
    this.updateWeather(dt, map.weather);
    this.drawWeather(ctx, map.weather);
    this.drawTexts(ctx, dt);

    // Hurt vignette in screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.hurt > 0.01) {
      const cw = this.canvas.width;
      const ch = this.canvas.height;
      const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, 'rgba(255,0,40,' + this.hurt * 0.45 + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cw, ch);
      this.hurt *= Math.exp(-3 * dt);
    }
    if (view.mouse && view.showCrosshair) {
      this.drawCrosshair(ctx, view);
    }
  }

  drawZone(ctx, view) {
    if (view.zoneR >= ZONE_START_RADIUS - 1) {
      return;
    }
    const cx = ARENA_W / 2;
    const cy = ARENA_H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-MARGIN, -MARGIN, VIEW_W, VIEW_H);
    ctx.arc(cx, cy, view.zoneR, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(160,0,40,0.28)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,60,90,0.9)';
    ctx.lineWidth = 4;
    ctx.setLineDash([18, 10]);
    ctx.lineDashOffset = -this.time * 40;
    ctx.shadowColor = '#ff3c5a';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, view.zoneR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawBullets(ctx, view) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of view.bullets) {
      const color = view.slotColor(b.slot);
      const speed = Math.hypot(b.vx, b.vy);
      const tail = Math.min(70, speed * 0.035);
      const tx = b.x - (b.vx / Math.max(1, speed)) * tail;
      const ty = b.y - (b.vy / Math.max(1, speed)) * tail;
      const g = ctx.createLinearGradient(tx, ty, b.x, b.y);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(1, rgba(color, 0.9));
      ctx.strokeStyle = g;
      ctx.lineWidth = b.r * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = rgba(color, 0.35);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    for (const b of view.bullets) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawPlayer(ctx, p, view) {
    const r = PLAYER_R;
    const isMe = p.id === view.meId;
    let aim = p.aim;
    if (isMe && view.myAim !== undefined) {
      aim = view.myAim;
    }

    if (isMe) {
      ctx.strokeStyle = rgba(p.color, 0.8);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -this.time * 20;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + r * 0.7, r * 1.35, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gun
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(aim);
    const mt = this.muzzle.get(p.id);
    let kick = 0;
    if (mt !== undefined && this.time - mt < 0.08) {
      kick = 4 * (1 - (this.time - mt) / 0.08);
    }
    ctx.fillStyle = '#1b1d22';
    ctx.fillRect(r * 0.3 - kick, -5, r + 12, 10);
    ctx.fillStyle = '#3a3e47';
    ctx.fillRect(r * 0.3 - kick, -3, r + 10, 6);
    ctx.fillStyle = p.color;
    ctx.fillRect(r * 0.5 - kick, -5, 6, 10);
    if (mt !== undefined && this.time - mt < 0.05) {
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(r + 22 - kick, 0);
      ctx.lineTo(r + 12 - kick, -6);
      ctx.lineTo(r + 34 - kick, 0);
      ctx.lineTo(r + 12 - kick, 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Body
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.45, 2, p.x, p.y, r);
    g.addColorStop(0, shade(p.color, 0.45));
    g.addColorStop(0.6, p.color);
    g.addColorStop(1, shade(p.color, -0.35));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(p.color, -0.6);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Eyes look where you aim
    const ex = Math.cos(aim);
    const ey = Math.sin(aim);
    const px = -ey;
    const py = ex;
    for (const side of [-1, 1]) {
      const cx = p.x + ex * r * 0.38 + px * side * r * 0.32;
      const cy = p.y + ey * r * 0.38 + py * side * r * 0.32 - 2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(cx + ex * 1.8, cy + ey * 1.8, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit flash
    const ft = this.flash.get(p.id);
    if (ft !== undefined && this.time - ft < 0.12) {
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - (this.time - ft) / 0.12) * 0.85 + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Untouchable shimmer
    if (p.invuln) {
      ctx.strokeStyle = 'rgba(160,255,255,' + (0.5 + Math.sin(this.time * 30) * 0.3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Reload ring
    if (p.reload >= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.reload);
      ctx.stroke();
    }

    // Name and health
    const barW = 46;
    const hpFrac = Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxHp)));
    const by = p.y - r - 16;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - barW / 2 - 1, by - 1, barW + 2, 7);
    let barColor = '#5cff8a';
    if (hpFrac < 0.35) {
      barColor = '#ff4d6d';
    } else if (hpFrac < 0.65) {
      barColor = '#ffd84d';
    }
    ctx.fillStyle = barColor;
    ctx.fillRect(p.x - barW / 2, by, barW * hpFrac, 5);
    ctx.font = '600 12px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(p.name, p.x + 1, by - 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(p.name, p.x, by - 3);
  }

  drawParticles(ctx, dt) {
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) {
        continue;
      }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.max;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = t;
        ctx.lineWidth = p.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === 'debris') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, t * 1.5);
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.kind === 'smoke') {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - t), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = t;
        ctx.lineWidth = 4 * t + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - t * 0.8), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'light') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        g.addColorStop(0, rgba(p.color, 0.55 * t));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  drawTexts(ctx, dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
      const a = Math.max(0, Math.min(1, t.life / t.max * 1.5));
      let size = 15;
      if (t.big) {
        size = 21;
      }
      const pop = 1 + Math.max(0, (t.life - t.max + 0.12) / 0.12) * 0.5;
      ctx.font = '700 ' + Math.round(size * pop) + 'px "Bungee", "Chakra Petch", system-ui, sans-serif';
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillText(t.text, t.x + 1.5, t.y + 1.5);
      let color = '#ffffff';
      if (t.zone) {
        color = '#ff6b81';
      } else if (t.mine) {
        color = '#ffd84d';
      }
      ctx.fillStyle = color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  drawCrosshair(ctx, view) {
    const k = this.k;
    const x = this.ox + (view.mouse.x + MARGIN) * k;
    const y = this.oy + (view.mouse.y + MARGIN) * k;
    const s = this.dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4 * s;
    this.crossPath(ctx, x, y, s);
    ctx.stroke();
    ctx.strokeStyle = view.crossColor || '#ffffff';
    ctx.lineWidth = 2 * s;
    this.crossPath(ctx, x, y, s);
    ctx.stroke();
    if (view.reload >= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(x, y, 16 * s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * view.reload);
      ctx.stroke();
    }
  }

  crossPath(ctx, x, y, s) {
    const gap = 5 * s;
    const len = 9 * s;
    ctx.beginPath();
    ctx.moveTo(x - gap - len, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + len, y);
    ctx.moveTo(x, y - gap - len);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + len);
    ctx.moveTo(x + 1.5 * s, y);
    ctx.arc(x, y, 1.5 * s, 0, Math.PI * 2);
  }
}
