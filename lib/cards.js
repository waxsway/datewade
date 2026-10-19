import { baseStats, clampStats } from './constants.js';

// Every card changes stats. Some are pure upgrades, some trade one thing for another.
// "tag" drives the icon and color accent on the card UI.

export const CARDS = [
  // ---------- common ----------
  {
    id: 'hollow',
    name: 'Hollow Points',
    rarity: 'common',
    tag: 'damage',
    lines: ['+25% damage'],
    apply(s) {
      s.damage *= 1.25;
    }
  },
  {
    id: 'trigger',
    name: 'Trigger Discipline',
    rarity: 'common',
    tag: 'firerate',
    lines: ['+18% fire rate'],
    apply(s) {
      s.fireDelay *= 0.85;
    }
  },
  {
    id: 'extmag',
    name: 'Extended Mag',
    rarity: 'common',
    tag: 'ammo',
    lines: ['+3 magazine size'],
    apply(s) {
      s.magSize += 3;
    }
  },
  {
    id: 'loader',
    name: 'Speed Loader',
    rarity: 'common',
    tag: 'ammo',
    lines: ['30% faster reload'],
    apply(s) {
      s.reloadTime *= 0.7;
    }
  },
  {
    id: 'sneakers',
    name: 'Fresh Sneakers',
    rarity: 'common',
    tag: 'speed',
    lines: ['+12% move speed'],
    apply(s) {
      s.moveSpeed *= 1.12;
    }
  },
  {
    id: 'thick',
    name: 'Thick Skin',
    rarity: 'common',
    tag: 'health',
    lines: ['+30 max HP'],
    apply(s) {
      s.maxHp += 30;
    }
  },
  {
    id: 'brake',
    name: 'Muzzle Brake',
    rarity: 'common',
    tag: 'accuracy',
    lines: ['+25% bullet speed', '-40% spread'],
    apply(s) {
      s.bulletSpeed *= 1.25;
      s.spread *= 0.6;
    }
  },
  {
    id: 'fat',
    name: 'Fat Rounds',
    rarity: 'common',
    tag: 'damage',
    lines: ['+40% bullet size', '+10% damage'],
    apply(s) {
      s.bulletRadius *= 1.4;
      s.damage *= 1.1;
    }
  },
  {
    id: 'barrel',
    name: 'Long Barrel',
    rarity: 'common',
    tag: 'accuracy',
    lines: ['+35% range', '+10% bullet speed'],
    apply(s) {
      s.bulletLife *= 1.35;
      s.bulletSpeed *= 1.1;
    }
  },
  {
    id: 'battery',
    name: 'Blink Battery',
    rarity: 'common',
    tag: 'speed',
    lines: ['30% faster dash recharge'],
    apply(s) {
      s.dashCooldown *= 0.7;
    }
  },
  {
    id: 'bandages',
    name: 'Bandages',
    rarity: 'common',
    tag: 'health',
    lines: ['+3 HP/sec regen', 'after 3s without damage'],
    apply(s) {
      s.regen += 3;
    }
  },
  {
    id: 'bruiser',
    name: 'Bruiser',
    rarity: 'common',
    tag: 'damage',
    lines: ['+60% knockback', '+10% damage'],
    apply(s) {
      s.knockback *= 1.6;
      s.damage *= 1.1;
    }
  },

  // ---------- rare ----------
  {
    id: 'ricochet',
    name: 'Ricochet',
    rarity: 'rare',
    tag: 'bounce',
    lines: ['Bullets bounce off walls +1'],
    apply(s) {
      s.bounces += 1;
    }
  },
  {
    id: 'buckshot',
    name: 'Buckshot',
    rarity: 'rare',
    tag: 'multishot',
    lines: ['+2 bullets per shot', '-30% damage', '-20% range'],
    apply(s) {
      s.multishot += 2;
      s.damage *= 0.7;
      s.bulletLife *= 0.8;
    }
  },
  {
    id: 'vampire',
    name: 'Vampire',
    rarity: 'rare',
    tag: 'health',
    lines: ['Heal 20% of damage dealt'],
    apply(s) {
      s.lifesteal += 0.2;
    }
  },
  {
    id: 'seeker',
    name: 'Seeker',
    rarity: 'rare',
    tag: 'homing',
    lines: ['Bullets curve toward enemies'],
    apply(s) {
      s.homing += 2.6;
    }
  },
  {
    id: 'drill',
    name: 'Drill Rounds',
    rarity: 'rare',
    tag: 'pierce',
    lines: ['Bullets pierce +1 player', '+10% damage'],
    apply(s) {
      s.pierce += 1;
      s.damage *= 1.1;
    }
  },
  {
    id: 'kevlar',
    name: 'Kevlar',
    rarity: 'rare',
    tag: 'health',
    lines: ['Take 15% less damage', '-7% move speed'],
    apply(s) {
      s.armor += 0.15;
      s.moveSpeed *= 0.93;
    }
  },
  {
    id: 'doubletap',
    name: 'Double Tap',
    rarity: 'rare',
    tag: 'multishot',
    lines: ['+1 bullet per shot', '-15% damage'],
    apply(s) {
      s.multishot += 1;
      s.damage *= 0.85;
    }
  },
  {
    id: 'hair',
    name: 'Hair Trigger',
    rarity: 'rare',
    tag: 'firerate',
    lines: ['+65% fire rate', '-20% damage', '!Less accurate'],
    apply(s) {
      s.fireDelay *= 0.6;
      s.damage *= 0.8;
      s.spread += 3;
    }
  },
  {
    id: 'adrenaline',
    name: 'Adrenaline',
    rarity: 'rare',
    tag: 'speed',
    lines: ['+20% move speed', '20% faster dash', '-10 max HP'],
    apply(s) {
      s.moveSpeed *= 1.2;
      s.dashCooldown *= 0.8;
      s.maxHp -= 10;
    }
  },
  {
    id: 'fullauto',
    name: 'Drum Mag',
    rarity: 'rare',
    tag: 'ammo',
    lines: ['+8 magazine size', '-25% reload speed'],
    apply(s) {
      s.magSize += 8;
      s.reloadTime *= 1.25;
    }
  },

  // ---------- epic ----------
  {
    id: 'glass',
    name: 'Glass Cannon',
    rarity: 'epic',
    tag: 'damage',
    lines: ['+80% damage', '-40% max HP'],
    apply(s) {
      s.damage *= 1.8;
      s.maxHp *= 0.6;
    }
  },
  {
    id: 'payload',
    name: 'Payload',
    rarity: 'epic',
    tag: 'explosive',
    lines: ['Bullets explode on impact', '-20% fire rate'],
    apply(s) {
      if (s.explosionRadius <= 0) {
        s.explosionRadius = 70;
      } else {
        s.explosionRadius += 30;
      }
      s.fireDelay *= 1.2;
    }
  },
  {
    id: 'ghost',
    name: 'Ghost Rounds',
    rarity: 'epic',
    tag: 'pierce',
    lines: ['Bullets pass through cover', '-10% damage'],
    apply(s) {
      s.ghost = 1;
      s.damage *= 0.9;
    }
  },
  {
    id: 'minigun',
    name: 'Minigun',
    rarity: 'epic',
    tag: 'firerate',
    lines: ['Triple fire rate', '+14 magazine', '-45% damage', '!Less accurate'],
    apply(s) {
      s.fireDelay *= 0.35;
      s.magSize += 14;
      s.damage *= 0.55;
      s.spread += 5;
      s.reloadTime *= 1.3;
    }
  },
  {
    id: 'railgun',
    name: 'Railgun',
    rarity: 'epic',
    tag: 'pierce',
    lines: ['+120% bullet speed', '+60% damage', 'Pierce +2', '-38% fire rate', '-2 magazine'],
    apply(s) {
      s.bulletSpeed *= 2.2;
      s.damage *= 1.6;
      s.pierce += 2;
      s.fireDelay *= 1.6;
      s.magSize -= 2;
    }
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut',
    rarity: 'epic',
    tag: 'health',
    lines: ['+80 max HP', 'Take 10% less damage', '-18% move speed'],
    apply(s) {
      s.maxHp += 80;
      s.armor += 0.1;
      s.moveSpeed *= 0.82;
    }
  },
  {
    id: 'hell',
    name: 'Bullet Hell',
    rarity: 'epic',
    tag: 'multishot',
    lines: ['+4 bullets per shot', '+1 bounce', '-40% damage'],
    apply(s) {
      s.multishot += 4;
      s.bounces += 1;
      s.damage *= 0.6;
    }
  },
  {
    id: 'secondwind',
    name: 'Second Wind',
    rarity: 'epic',
    tag: 'health',
    lines: ['Revive once per round', 'at 40% HP'],
    apply(s) {
      s.extraLives += 1;
    }
  },
  {
    id: 'phasedash',
    name: 'Phase Dash',
    rarity: 'epic',
    tag: 'speed',
    lines: ['Dashing makes you untouchable', '40% faster dash recharge'],
    apply(s) {
      s.dashInvuln = 0.35;
      s.dashCooldown *= 0.6;
    }
  }
];

export const CARD_BY_ID = {};
for (const card of CARDS) {
  CARD_BY_ID[card.id] = card;
}

export const RARITY_COLORS = {
  common: '#9fb3c8',
  rare: '#4dabff',
  epic: '#c77dff'
};

export function statsFromCards(cardIds) {
  const s = baseStats();
  for (const id of cardIds) {
    const card = CARD_BY_ID[id];
    if (card) {
      card.apply(s);
    }
  }
  return clampStats(s);
}

// Losers of a round get better odds at rare and epic cards so the leader
// doesn't snowball forever.
export function rarityOdds(wonRound) {
  if (wonRound) {
    return { common: 0.7, rare: 0.25, epic: 0.05 };
  }
  return { common: 0.45, rare: 0.38, epic: 0.17 };
}

export function rollOffer(rng, wonRound, ownedCards) {
  const odds = rarityOdds(wonRound);
  const offer = [];
  let guard = 0;
  while (offer.length < 3 && guard < 200) {
    guard += 1;
    const roll = rng();
    let rarity = 'common';
    if (roll < odds.epic) {
      rarity = 'epic';
    } else if (roll < odds.epic + odds.rare) {
      rarity = 'rare';
    }
    const pool = CARDS.filter((c) => {
      if (c.rarity !== rarity) {
        return false;
      }
      if (offer.includes(c.id)) {
        return false;
      }
      // One-shot cards are pointless twice.
      if (c.id === 'ghost' && ownedCards.includes('ghost')) {
        return false;
      }
      return true;
    });
    if (pool.length === 0) {
      continue;
    }
    const pick = pool[Math.floor(rng() * pool.length)];
    offer.push(pick.id);
  }
  return offer;
}
