// Shared tuning values. Everything the host simulation and the client
// prediction both rely on lives here so they never drift apart.

export const ARENA_W = 1600;
export const ARENA_H = 900;
export const TICK = 1 / 60;
export const SNAPSHOT_EVERY = 2; // ticks between network snapshots (30 per second)
export const PLAYER_R = 18;
export const MAX_PLAYERS = 8;

export const DASH_TIME = 0.14;
export const DASH_SPEED = 980;
export const KNOCKBACK_DECAY = 9;

export const COUNTDOWN_TIME = 3;
export const ROUND_END_TIME = 2.6;
export const UPGRADE_TIME = 22;
export const ZONE_START = 22; // seconds into a round before the zone shrinks
export const ZONE_SHRINK_TIME = 32;
export const ZONE_MIN_RADIUS = 150;
export const ZONE_DPS = 18;

export const PLAYER_COLORS = [
  '#ff4d6d',
  '#4dabff',
  '#ffd84d',
  '#5cff8a',
  '#c77dff',
  '#ff9f43',
  '#3ee6e0',
  '#ff7ad9'
];

export const BOT_NAMES = [
  'Mushroom',
  'Pickle',
  'Gravy',
  'Noodle',
  'Biscuit',
  'Turbo',
  'Waffles',
  'Meatball',
  'Chungus',
  'Dorito'
];

export function baseStats() {
  return {
    maxHp: 100,
    moveSpeed: 270,
    damage: 20,
    fireDelay: 0.28,
    magSize: 6,
    reloadTime: 1.5,
    bulletSpeed: 950,
    bulletRadius: 5,
    bulletLife: 1.1,
    spread: 3,
    multishot: 1,
    bounces: 0,
    pierce: 0,
    lifesteal: 0,
    homing: 0,
    explosionRadius: 0,
    knockback: 170,
    dashCooldown: 2.4,
    dashInvuln: 0,
    regen: 0,
    armor: 0,
    ghost: 0,
    extraLives: 0
  };
}

// Hard limits so stacked cards stay fun instead of broken.
export function clampStats(s) {
  s.maxHp = Math.max(20, Math.min(600, s.maxHp));
  s.moveSpeed = Math.max(140, Math.min(540, s.moveSpeed));
  s.damage = Math.max(3, Math.min(400, s.damage));
  s.fireDelay = Math.max(0.05, Math.min(2.5, s.fireDelay));
  s.magSize = Math.max(1, Math.min(60, Math.round(s.magSize)));
  s.reloadTime = Math.max(0.3, Math.min(5, s.reloadTime));
  s.bulletSpeed = Math.max(300, Math.min(3200, s.bulletSpeed));
  s.bulletRadius = Math.max(2, Math.min(26, s.bulletRadius));
  s.bulletLife = Math.max(0.3, Math.min(3.5, s.bulletLife));
  s.spread = Math.max(0, Math.min(40, s.spread));
  s.multishot = Math.max(1, Math.min(15, Math.round(s.multishot)));
  s.bounces = Math.max(0, Math.min(8, Math.round(s.bounces)));
  s.pierce = Math.max(0, Math.min(6, Math.round(s.pierce)));
  s.lifesteal = Math.max(0, Math.min(0.8, s.lifesteal));
  s.homing = Math.max(0, Math.min(12, s.homing));
  s.explosionRadius = Math.max(0, Math.min(220, s.explosionRadius));
  s.knockback = Math.max(0, Math.min(900, s.knockback));
  s.dashCooldown = Math.max(0.45, Math.min(6, s.dashCooldown));
  s.dashInvuln = Math.max(0, Math.min(0.8, s.dashInvuln));
  s.regen = Math.max(0, Math.min(25, s.regen));
  s.armor = Math.max(0, Math.min(0.7, s.armor));
  s.extraLives = Math.max(0, Math.min(3, Math.round(s.extraLives)));
  return s;
}
