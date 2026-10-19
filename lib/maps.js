import { ARENA_W, ARENA_H } from './constants.js';

// Wall layouts are point-symmetric around the arena center so no spawn is
// better than another. Only the first half is written out; mirror() adds the rest.

function mirror(list) {
  const out = [];
  for (const w of list) {
    out.push(w);
    if (w.center === true) {
      continue;
    }
    out.push({
      x: ARENA_W - w.x - w.w,
      y: ARENA_H - w.y - w.h,
      w: w.w,
      h: w.h,
      k: w.k
    });
  }
  return out;
}

const DEFAULT_SPAWNS = [
  { x: 90, y: 90 },
  { x: 1510, y: 810 },
  { x: 1510, y: 90 },
  { x: 90, y: 810 },
  { x: 800, y: 66 },
  { x: 800, y: 834 },
  { x: 90, y: 450 },
  { x: 1510, y: 450 }
];

export const MAPS = [
  {
    id: 'rooftop',
    name: 'Neon Rooftop',
    weather: 'rain',
    walls: mirror([
      { x: 210, y: 160, w: 130, h: 76, k: 'ac' },
      { x: 210, y: 664, w: 130, h: 76, k: 'ac' },
      { x: 520, y: 370, w: 56, h: 160, k: 'vent' },
      { x: 735, y: 120, w: 130, h: 52, k: 'ac' },
      { x: 420, y: 110, w: 46, h: 46, k: 'crate' },
      { x: 420, y: 744, w: 46, h: 46, k: 'crate' }
    ]),
    spawns: DEFAULT_SPAWNS
  },
  {
    id: 'ruins',
    name: 'Overgrown Ruins',
    weather: 'leaves',
    walls: mirror([
      { x: 300, y: 190, w: 62, h: 62, k: 'pillar' },
      { x: 300, y: 648, w: 62, h: 62, k: 'pillar' },
      { x: 769, y: 419, w: 62, h: 62, k: 'pillar', center: true },
      { x: 530, y: 110, w: 42, h: 230, k: 'ruin' },
      { x: 640, y: 255, w: 150, h: 36, k: 'ruin' }
    ]),
    spawns: DEFAULT_SPAWNS
  },
  {
    id: 'desert',
    name: 'Desert Outpost',
    weather: 'dust',
    walls: mirror([
      { x: 350, y: 240, w: 190, h: 42, k: 'sandbag' },
      { x: 350, y: 618, w: 190, h: 42, k: 'sandbag' },
      { x: 760, y: 190, w: 80, h: 80, k: 'crate' },
      { x: 600, y: 428, w: 44, h: 44, k: 'barrel' },
      { x: 170, y: 420, w: 60, h: 60, k: 'crate' }
    ]),
    spawns: DEFAULT_SPAWNS
  },
  {
    id: 'docks',
    name: 'Frozen Docks',
    weather: 'snow',
    walls: mirror([
      { x: 240, y: 170, w: 210, h: 72, k: 'container' },
      { x: 520, y: 520, w: 72, h: 210, k: 'container' },
      { x: 700, y: 110, w: 200, h: 70, k: 'container' },
      { x: 150, y: 300, w: 30, h: 30, k: 'bollard' },
      { x: 390, y: 420, w: 60, h: 60, k: 'crate' }
    ]),
    spawns: DEFAULT_SPAWNS
  }
];
