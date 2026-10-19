import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../lib/sim.js';
import { MAPS } from '../lib/maps.js';
import { CARDS, statsFromCards, rollOffer } from '../lib/cards.js';
import { moveBody, copyBody, pointInRect } from '../lib/physics.js';
import { PLAYER_R, TICK, ARENA_W, ARENA_H } from '../lib/constants.js';
import { mulberry32 } from '../lib/rng.js';

test('every spawn is clear of cover on every map', () => {
  for (const map of MAPS) {
    for (const sp of map.spawns) {
      for (const w of map.walls) {
        assert.equal(pointInRect(sp.x, sp.y, w, PLAYER_R + 2), false, `${map.id} spawn ${sp.x},${sp.y} hits wall`);
      }
    }
  }
});

test('walls sit inside the arena and do not overlap', () => {
  for (const map of MAPS) {
    for (const w of map.walls) {
      assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.w <= ARENA_W && w.y + w.h <= ARENA_H, `${map.id} wall out of bounds`);
    }
    for (let i = 0; i < map.walls.length; i += 1) {
      for (let j = i + 1; j < map.walls.length; j += 1) {
        const a = map.walls[i];
        const b = map.walls[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        assert.equal(overlap, false, `${map.id} walls ${i} and ${j} overlap`);
      }
    }
  }
});

test('every card applies and stays within limits', () => {
  const all = CARDS.map((c) => c.id);
  const stacked = statsFromCards([...all, ...all, ...all]);
  for (const [key, value] of Object.entries(stacked)) {
    assert.ok(Number.isFinite(value), `${key} not finite`);
  }
  assert.ok(stacked.fireDelay >= 0.05);
  assert.ok(stacked.magSize >= 1);
});

test('offers are three distinct cards', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i += 1) {
    const offer = rollOffer(rng, i % 2 === 0, []);
    assert.equal(offer.length, 3);
    assert.equal(new Set(offer).size, 3);
  }
});

test('movement is deterministic so client prediction can replay it', () => {
  const walls = MAPS[0].walls;
  const stats = statsFromCards([]);
  const a = { x: 100, y: 100, kvx: 50, kvy: 0, dashT: 0, dashVx: 0, dashVy: 0, dashCd: 0 };
  const b = copyBody(a);
  const inputs = [];
  for (let i = 0; i < 240; i += 1) {
    inputs.push({ mx: Math.cos(i / 20), my: Math.sin(i / 30), a: i / 10, d: i % 50 === 0 });
  }
  for (const inp of inputs) {
    moveBody(a, inp, stats, TICK, walls, true);
  }
  for (const inp of inputs) {
    moveBody(b, inp, stats, TICK, walls, true);
  }
  assert.deepEqual(a, b);
});

test('players never end up inside cover', () => {
  const walls = MAPS[1].walls;
  const stats = statsFromCards(['sneakers', 'adrenaline']);
  const body = { x: 90, y: 90, kvx: 0, kvy: 0, dashT: 0, dashVx: 0, dashVy: 0, dashCd: 0 };
  const rng = mulberry32(3);
  for (let i = 0; i < 6000; i += 1) {
    moveBody(body, { mx: rng() * 2 - 1, my: rng() * 2 - 1, a: 0, d: rng() < 0.05 }, stats, TICK, walls, true);
    for (const w of walls) {
      const cx = Math.max(w.x, Math.min(body.x, w.x + w.w));
      const cy = Math.max(w.y, Math.min(body.y, w.y + w.h));
      const gap = Math.hypot(body.x - cx, body.y - cy);
      assert.ok(gap > PLAYER_R - 1.5, `inside wall at tick ${i}`);
    }
  }
});

test('bullets bounce off cover when they have bounces', () => {
  const m = new Match(5);
  m.addPlayer('a', 'A', '#ff4d6d', false);
  m.addPlayer('b', 'B', '#4dabff', false);
  m.startMatch();
  const wall = m.walls[0];
  m.phase = 'fight';
  m.bullets.push({
    id: 1, owner: 'a', slot: 0, x: wall.x - 30, y: wall.y + wall.h / 2, vx: 900, vy: 0, r: 5, life: 1,
    dmg: 10, bounces: 1, pierce: 0, homing: 0, explode: 0, ghost: false, knock: 0, hits: [], dead: false
  });
  for (const p of m.players.values()) {
    p.body.x = 50;
    p.body.y = 50;
    if (p.id === 'b') {
      p.body.x = 1550;
      p.body.y = 850;
    }
  }
  for (let i = 0; i < 6; i += 1) {
    m.updateBullets(TICK);
  }
  assert.equal(m.bullets.length, 1);
  assert.ok(m.bullets[0].vx < 0, 'bullet should be travelling back');
});

test('a full bot match reaches a winner and every round offers upgrades', () => {
  const m = new Match(42);
  for (let i = 0; i < 4; i += 1) {
    m.addPlayer('bot' + i, 'Bot' + i, '', true);
  }
  m.setSetting('roundsToWin', 3);
  assert.ok(m.startMatch());
  let sawUpgrade = false;
  let ticks = 0;
  const limit = 60 * 60 * 25;
  while (m.phase !== 'matchEnd' && ticks < limit) {
    m.step();
    m.drainEvents();
    if (m.phase === 'upgrade') {
      sawUpgrade = true;
      for (const p of m.players.values()) {
        assert.equal(p.offer.length, 3);
      }
    }
    ticks += 1;
  }
  assert.equal(m.phase, 'matchEnd', 'match did not finish');
  assert.ok(sawUpgrade);
  const winner = m.players.get(m.matchWinner);
  assert.equal(winner.score, 3);
  for (const p of m.players.values()) {
    assert.ok(p.cards.length >= 1, 'everyone should have picked cards');
  }
  const snap = m.snapshot();
  assert.ok(JSON.stringify(snap).length < 20000);
});

test('players can pick only from their own offer', () => {
  const m = new Match(9);
  m.addPlayer('a', 'A', '', false);
  m.addPlayer('b', 'B', '', false);
  m.startMatch();
  m.roundWinner = 'a';
  m.beginUpgrades();
  const a = m.players.get('a');
  const notOffered = CARDS.find((c) => !a.offer.includes(c.id)).id;
  assert.equal(m.pick('a', notOffered), false);
  assert.equal(m.pick('a', a.offer[1]), true);
  assert.equal(m.pick('a', a.offer[0]), false);
  assert.deepEqual(a.cards, [a.offer[1]]);
});
