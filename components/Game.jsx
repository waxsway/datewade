'use client';

import { useEffect, useRef, useState } from 'react';
import { Session } from './session.js';
import { CARD_BY_ID, RARITY_COLORS } from '../lib/cards.js';
import { MAPS } from '../lib/maps.js';
import { baseStats, ZONE_START } from '../lib/constants.js';
import { setVolume, getVolume, play } from './sfx.js';

// ---------------------------------------------------------------- small pieces

const TAG_ICON = {
  damage: 'M12 2 L15 9 L22 9 L16.5 13.5 L18.5 21 L12 16.5 L5.5 21 L7.5 13.5 L2 9 L9 9 Z',
  firerate: 'M13 2 L4 14 L11 14 L10 22 L20 9 L13 9 Z',
  ammo: 'M8 3 h8 v4 h-8 Z M7 8 h10 v13 h-10 Z',
  speed: 'M3 12 h11 M3 7 h7 M3 17 h7 M14 5 l7 7 l-7 7',
  health: 'M12 21 C5 15 2 11 2 7.5 A5 5 0 0 1 12 5 A5 5 0 0 1 22 7.5 C22 11 19 15 12 21 Z',
  accuracy: 'M12 2 v5 M12 17 v5 M2 12 h5 M17 12 h5 M12 8 a4 4 0 1 0 0.01 0',
  bounce: 'M3 18 L9 6 L15 18 L21 6',
  multishot: 'M4 12 h10 M4 6 l10 4 M4 18 l10 -4 M16 12 a2 2 0 1 0 0.01 0',
  homing: 'M4 20 C 8 4, 16 4, 20 10 M16 6 l4 4 l-5 2',
  pierce: 'M2 12 h16 M14 7 l6 5 l-6 5 M8 5 v14',
  explosive: 'M12 3 L14 9 L20 7 L16 12 L21 16 L14 15 L12 21 L10 15 L3 16 L8 12 L4 7 L10 9 Z'
};

function TagIcon({ tag, color, size }) {
  const d = TAG_ICON[tag] || TAG_ICON.damage;
  let filled = false;
  if (tag === 'damage' || tag === 'firerate' || tag === 'health' || tag === 'explosive' || tag === 'ammo') {
    filled = true;
  }
  let fill = 'none';
  let strokeWidth = 2.2;
  if (filled) {
    fill = color;
    strokeWidth = 1;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill={fill} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CardView({ cardId, index, onPick, picked, dimmed }) {
  const card = CARD_BY_ID[cardId];
  if (!card) {
    return null;
  }
  const color = RARITY_COLORS[card.rarity];
  let className = 'card rarity-' + card.rarity;
  if (picked) {
    className += ' picked';
  }
  if (dimmed) {
    className += ' dimmed';
  }
  return (
    <button
      className={className}
      style={{ '--rc': color, animationDelay: index * 90 + 'ms' }}
      onClick={() => {
        if (onPick) {
          onPick(cardId);
        }
      }}
      disabled={!onPick}
    >
      <div className="card-key">{index + 1}</div>
      <div className="card-rarity">{card.rarity}</div>
      <div className="card-icon">
        <TagIcon tag={card.tag} color={color} size={54} />
      </div>
      <div className="card-name">{card.name}</div>
      <ul className="card-lines">
        {card.lines.map((line) => {
          let cls = 'up';
          let text = line;
          if (line.startsWith('!')) {
            cls = 'down';
            text = line.slice(1);
          } else if (line.startsWith('-')) {
            cls = 'down';
          }
          return (
            <li key={line} className={cls}>
              {text}
            </li>
          );
        })}
      </ul>
    </button>
  );
}

function CardChip({ cardId }) {
  const card = CARD_BY_ID[cardId];
  if (!card) {
    return null;
  }
  const color = RARITY_COLORS[card.rarity];
  return (
    <span className="chip" style={{ '--rc': color }} title={card.lines.map((l) => l.replace(/^!/, '')).join(', ')}>
      <TagIcon tag={card.tag} color={color} size={12} />
      {card.name}
    </span>
  );
}

function buildRows(stats) {
  const b = baseStats();
  const rows = [];
  function add(label, value, base, fmt, higherIsBetter) {
    const changed = Math.abs(value - base) > 0.0001;
    let tone = '';
    if (changed) {
      let better = value > base;
      if (!higherIsBetter) {
        better = value < base;
      }
      if (better) {
        tone = 'up';
      } else {
        tone = 'down';
      }
    }
    rows.push({ label, text: fmt(value), tone });
  }
  add('Damage', stats.damage, b.damage, (v) => Math.round(v), true);
  add('Shots/sec', 1 / stats.fireDelay, 1 / b.fireDelay, (v) => v.toFixed(1), true);
  add('Magazine', stats.magSize, b.magSize, (v) => Math.round(v), true);
  add('Reload', stats.reloadTime, b.reloadTime, (v) => v.toFixed(2) + 's', false);
  add('Max HP', stats.maxHp, b.maxHp, (v) => Math.round(v), true);
  add('Speed', stats.moveSpeed, b.moveSpeed, (v) => Math.round(v), true);
  add('Bullets', stats.multishot, b.multishot, (v) => v, true);
  add('Bullet speed', stats.bulletSpeed, b.bulletSpeed, (v) => Math.round(v), true);
  add('Dash recharge', stats.dashCooldown, b.dashCooldown, (v) => v.toFixed(2) + 's', false);
  if (stats.bounces > 0) {
    add('Bounces', stats.bounces, 0, (v) => v, true);
  }
  if (stats.pierce > 0) {
    add('Pierce', stats.pierce, 0, (v) => v, true);
  }
  if (stats.lifesteal > 0) {
    add('Lifesteal', stats.lifesteal, 0, (v) => Math.round(v * 100) + '%', true);
  }
  if (stats.armor > 0) {
    add('Armor', stats.armor, 0, (v) => Math.round(v * 100) + '%', true);
  }
  if (stats.regen > 0) {
    add('Regen', stats.regen, 0, (v) => v.toFixed(1) + '/s', true);
  }
  if (stats.homing > 0) {
    add('Homing', stats.homing, 0, (v) => v.toFixed(1), true);
  }
  if (stats.explosionRadius > 0) {
    add('Blast radius', stats.explosionRadius, 0, (v) => Math.round(v), true);
  }
  if (stats.extraLives > 0) {
    add('Extra lives', stats.extraLives, 0, (v) => v, true);
  }
  if (stats.ghost > 0) {
    rows.push({ label: 'Ghost rounds', text: 'on', tone: 'up' });
  }
  return rows;
}

function Pips({ count, total, color }) {
  const out = [];
  for (let i = 0; i < total; i += 1) {
    let cls = 'pip';
    if (i < count) {
      cls += ' on';
    }
    out.push(<span key={i} className={cls} style={{ '--pc': color }} />);
  }
  return <span className="pips">{out}</span>;
}

function killLine(k) {
  if (k.killer) {
    return (
      <>
        <b style={{ color: k.killer.color }}>{k.killer.name}</b>
        <span className="kill-verb">clipped</span>
        <b style={{ color: k.victim.color }}>{k.victim.name}</b>
      </>
    );
  }
  return (
    <>
      <b style={{ color: k.victim.color }}>{k.victim.name}</b>
      <span className="kill-verb">got eaten by the zone</span>
    </>
  );
}

// ---------------------------------------------------------------- main

export default function Game({ config, onExit }) {
  const canvasRef = useRef(null);
  const sessionRef = useRef(null);
  const [ui, setUi] = useState(null);
  const [copied, setCopied] = useState(false);
  const [vol, setVol] = useState(getVolume());

  useEffect(() => {
    const session = new Session({ ...config, onUi: (next) => setUi(next) });
    sessionRef.current = session;
    // Handy for debugging from the browser console.
    window.__dwSession = session;
    session.onKey = (e) => {
      const s = sessionRef.current;
      if (!s || !s.meta) {
        return;
      }
      if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
        const meRow = s.meta.players.find((p) => p.id === s.selfId);
        if (s.meta.phase === 'upgrade' && meRow && meRow.picked === null) {
          const idx = Number(e.code.slice(5)) - 1;
          if (meRow.offer[idx]) {
            s.pick(meRow.offer[idx]);
          }
        }
      }
    };
    session.start(canvasRef.current).catch((err) => {
      console.error(err);
      let reason = 'unknown error';
      if (err && err.message) {
        reason = err.message;
      }
      setUi((prev) => ({ ...(prev || {}), ended: 'Could not connect: ' + reason }));
    });
    return () => {
      session.dispose();
    };
  }, [config]);

  const s = sessionRef.current;
  let meta = null;
  let phase = 'lobby';
  if (ui) {
    meta = ui.meta || null;
    phase = ui.phase;
  }
  let players = [];
  let roundsToWin = 5;
  if (meta) {
    players = meta.players;
    roundsToWin = meta.settings.roundsToWin;
  }
  const me = players.find((p) => ui && p.id === ui.selfId);
  const sortedByScore = players.slice().sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.kills - a.kills;
  });

  function copyInvite() {
    const url = window.location.origin + window.location.pathname + '?r=' + ui.code;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }).catch(() => {});
    }
  }

  function toggleVolume() {
    let next = 0.5;
    if (vol > 0) {
      next = 0;
    }
    setVolume(next);
    setVol(next);
  }

  let mapName = '';
  if (meta) {
    mapName = MAPS[meta.mapIndex].name;
  }

  // ---------------------------------------------------------------- overlays

  let overlay = null;

  if (ui && ui.ended) {
    overlay = (
      <div className="panel center-panel">
        <h2>Game over</h2>
        <p>{ui.ended}</p>
        <button className="btn primary" onClick={onExit}>Back to menu</button>
      </div>
    );
  } else if (!meta) {
    overlay = (
      <div className="panel center-panel">
        <div className="spinner" />
        <p>{(ui && ui.notice) || 'Connecting...'}</p>
        <p className="muted small">Peer to peer can take a few seconds. If it never connects, a strict firewall may be blocking it.</p>
        <button className="btn" onClick={onExit}>Cancel</button>
      </div>
    );
  } else if (phase === 'lobby') {
    let startHint = '';
    if (players.length < 2) {
      startHint = 'Need at least 2 players. Add a bot or invite a friend.';
    }
    let lobbyLabel = 'Room code';
    let lobbyCode = ui.code;
    if (ui.practice) {
      lobbyLabel = 'Practice';
      lobbyCode = 'VS BOTS';
    }
    let copyLabel = 'Copy invite link';
    if (copied) {
      copyLabel = 'Link copied';
    }
    let controls = null;
    if (ui.isHost) {
      controls = (
        <div className="host-controls">
          <div className="row">
            <span className="label">First to</span>
            {[3, 5, 7, 10].map((n) => {
              let cls = 'seg';
              if (roundsToWin === n) {
                cls = 'seg on';
              }
              return <button key={n} className={cls} onClick={() => s.setRounds(n)}>{n}</button>;
            })}
            <span className="label">round wins</span>
          </div>
          <div className="row">
            <button className="btn" onClick={() => s.addBot()} disabled={players.length >= 8}>Add bot</button>
            <button className="btn" onClick={() => s.removeBot()} disabled={!players.some((p) => p.bot)}>Remove bot</button>
            <button className="btn primary grow" onClick={() => { play('click'); s.startMatch(); }} disabled={players.length < 2}>Start match</button>
          </div>
          {startHint && <p className="muted small">{startHint}</p>}
        </div>
      );
    } else {
      controls = <p className="muted">Waiting for the host to start. First to {roundsToWin} round wins.</p>;
    }
    overlay = (
      <div className="panel lobby">
        <div className="lobby-head">
          <div>
            <div className="eyebrow">{lobbyLabel}</div>
            <div className="code">{lobbyCode}</div>
          </div>
          {!ui.practice && (
            <button className="btn" onClick={copyInvite}>{copyLabel}</button>
          )}
        </div>
        <div className="roster">
          {players.map((p) => (
            <div key={p.id} className="roster-row">
              <span className="dot" style={{ background: p.color }} />
              <span className="roster-name">{p.name}</span>
              {p.id === meta.hostId && <span className="tag">host</span>}
              {p.bot && <span className="tag">bot</span>}
              {p.id === ui.selfId && <span className="tag you">you</span>}
              {ui.isHost && p.id !== ui.selfId && (
                <button className="link" onClick={() => s.kick(p.id)}>remove</button>
              )}
            </div>
          ))}
          {players.length < 8 && <div className="roster-row empty">{8 - players.length} open slots</div>}
        </div>
        {controls}
        <div className="controls-help">
          <span><b>WASD</b> move</span>
          <span><b>Mouse</b> aim</span>
          <span><b>Click</b> shoot</span>
          <span><b>Space</b> or <b>right click</b> dash</span>
          <span><b>R</b> reload</span>
        </div>
      </div>
    );
  } else if (phase === 'upgrade' && me) {
    const myPick = me.picked;
    let heading = 'Pick an upgrade';
    if (myPick) {
      heading = 'Locked in';
    }
    let oddsNote = 'You lost the round, so you get better odds at rare and epic cards.';
    if (meta.roundWinner === me.id) {
      oddsNote = 'You won the round, so your odds lean common.';
    }
    const cardViews = me.offer.map((id, i) => {
      let onPick = null;
      if (myPick === null) {
        onPick = (cid) => s.pick(cid);
      }
      return (
        <CardView
          key={id + i}
          cardId={id}
          index={i}
          picked={myPick === id}
          dimmed={myPick !== null && myPick !== id}
          onPick={onPick}
        />
      );
    });
    overlay = (
      <div className="upgrade">
        <div className="upgrade-head">
          <div>
            <div className="eyebrow">Round {meta.round} done</div>
            <h2>{heading}</h2>
          </div>
          <div className="timer">
            <div className="timer-fill" style={{ width: Math.max(0, (ui.phaseT / 22) * 100) + '%' }} />
            <span>{Math.ceil(ui.phaseT)}s</span>
          </div>
        </div>
        <div className="cards">{cardViews}</div>
        <p className="muted small center">{oddsNote}</p>
        <div className="upgrade-bottom">
          <div className="panel build">
            <div className="eyebrow">Your build</div>
            <div className="stat-grid">
              {buildRows(me.stats).map((r) => (
                <div key={r.label} className={'stat ' + r.tone}>
                  <span>{r.label}</span>
                  <b>{r.text}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="panel others">
            <div className="eyebrow">Everyone</div>
            {sortedByScore.map((p) => {
              let stateClass = 'pick-state';
              let stateText = 'choosing';
              if (p.picked) {
                stateClass = 'pick-state done';
                stateText = 'ready';
              }
              return (
                <div key={p.id} className="other-row">
                  <span className="dot" style={{ background: p.color }} />
                  <span className="other-name">{p.name}</span>
                  <Pips count={p.score} total={roundsToWin} color={p.color} />
                  <span className={stateClass}>{stateText}</span>
                  <div className="chips">
                    {p.cards.map((c, i) => <CardChip key={c + i} cardId={c} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  } else if (phase === 'matchEnd') {
    const champ = players.find((p) => p.id === meta.matchWinner);
    let endControls = <p className="muted">Waiting for the host to start a rematch.</p>;
    if (ui.isHost) {
      endControls = (
        <div className="row center">
          <button className="btn primary" onClick={() => s.startMatch()}>Rematch</button>
          <button className="btn" onClick={() => s.backToLobby()}>Back to lobby</button>
        </div>
      );
    }
    overlay = (
      <div className="panel center-panel wide">
        <div className="eyebrow">Match over</div>
        {champ && (
          <h1 className="champ" style={{ color: champ.color }}>{champ.name} wins</h1>
        )}
        <table className="standings">
          <thead>
            <tr><th /><th>Player</th><th>Rounds</th><th>Kills</th><th>Deaths</th><th>Damage</th><th>Build</th></tr>
          </thead>
          <tbody>
            {sortedByScore.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td><span className="dot" style={{ background: p.color }} /> {p.name}</td>
                <td>{p.score}</td>
                <td>{p.kills}</td>
                <td>{p.deaths}</td>
                <td>{p.dmg}</td>
                <td className="chips">{p.cards.map((c, j) => <CardChip key={c + j} cardId={c} />)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {endControls}
      </div>
    );
  }

  // ---------------------------------------------------------------- HUD

  const inRound = phase === 'countdown' || phase === 'fight' || phase === 'roundEnd';
  let zoneWarn = '';
  if (phase === 'fight' && ui) {
    const until = ZONE_START - ui.roundT;
    if (until > 0 && until <= 6) {
      zoneWarn = 'Zone closing in ' + Math.ceil(until);
    } else if (until <= 0 && until > -3) {
      zoneWarn = 'Zone closing';
    }
  }

  let roundBanner = null;
  if (phase === 'roundEnd' && meta) {
    const w = players.find((p) => p.id === meta.roundWinner);
    if (w) {
      let bannerText = w.name + ' takes it';
      if (w.id === ui.selfId) {
        bannerText = 'You take it';
      }
      roundBanner = (
        <div className="banner">
          <div className="banner-sub">Round {meta.round}</div>
          <div className="banner-main" style={{ color: w.color }}>{bannerText}</div>
        </div>
      );
    } else {
      roundBanner = (
        <div className="banner">
          <div className="banner-sub">Round {meta.round}</div>
          <div className="banner-main">Nobody survived</div>
        </div>
      );
    }
  }

  let countdown = null;
  if (phase === 'countdown' && ui) {
    countdown = (
      <div className="countdown" key={Math.ceil(ui.phaseT)}>
        <div className="countdown-map">{mapName}</div>
        <div className="countdown-num">{Math.max(1, Math.ceil(ui.phaseT))}</div>
      </div>
    );
  }

  let spectating = null;
  if (phase === 'fight' && ui && ui.me && !ui.me.alive) {
    spectating = <div className="spectate">You are out. Spectating until the round ends.</div>;
  }
  if (phase === 'fight' && ui && !ui.me && meta && !me) {
    spectating = <div className="spectate">Joined mid-round. You spawn next round.</div>;
  }

  let hud = null;
  if (inRound && ui && ui.me && ui.me.alive) {
    const m = ui.me;
    const hpFrac = Math.max(0, Math.min(1, m.hp / Math.max(1, m.maxHp)));
    let dashFrac = 1;
    if (m.dashMax > 0) {
      dashFrac = 1 - Math.min(1, m.dashCd / m.dashMax);
    }
    const ammoPips = [];
    const showPips = Math.min(m.mag, 30);
    for (let i = 0; i < showPips; i += 1) {
      let cls = 'ammo';
      let filled = i < m.ammo;
      if (m.mag > 30) {
        filled = i < Math.round((m.ammo / m.mag) * 30);
      }
      if (filled && m.reload < 0) {
        cls += ' on';
      }
      ammoPips.push(<span key={i} className={cls} />);
    }
    let hpColor = '#5cff8a';
    if (hpFrac < 0.35) {
      hpColor = '#ff4d6d';
    } else if (hpFrac < 0.65) {
      hpColor = '#ffd84d';
    }
    let ammoContent = ammoPips;
    if (m.reload >= 0) {
      ammoContent = <span className="reloading">Reloading</span>;
    }
    let dashClass = 'dash';
    if (dashFrac >= 1) {
      dashClass = 'dash ready';
    }
    // Fade the HUD when you are standing in the corner it covers.
    let hudClass = 'hud';
    if (m.x < 420 && m.y > 640) {
      hudClass = 'hud faded';
    }
    hud = (
      <div className={hudClass}>
        <div className="hud-hp">
          <div className="hud-hp-fill" style={{ width: hpFrac * 100 + '%', background: hpColor }} />
          <span>{Math.ceil(m.hp)} / {Math.round(m.maxHp)}</span>
        </div>
        <div className="hud-row">
          <div className="ammo-row">
            {ammoContent}
          </div>
          <div className={dashClass}>
            <div className="dash-fill" style={{ height: dashFrac * 100 + '%' }} />
            <span>DASH</span>
          </div>
        </div>
      </div>
    );
  }

  let soundLabel = 'Muted';
  if (vol > 0) {
    soundLabel = 'Sound on';
  }

  return (
    <div className="game">
      <canvas ref={canvasRef} className="stage" />
      <div className="topbar">
        <button className="btn tiny" onClick={onExit}>Leave</button>
        {meta && phase !== 'lobby' && (
          <div className="scores">
            {sortedByScore.map((p) => {
              let cls = 'score';
              if (p.id === ui.selfId) {
                cls = 'score mine';
              }
              return (
                <div key={p.id} className={cls}>
                  <span className="dot" style={{ background: p.color }} />
                  <span className="score-name">{p.name}</span>
                  <Pips count={p.score} total={roundsToWin} color={p.color} />
                </div>
              );
            })}
          </div>
        )}
        <div className="topbar-right">
          {meta && phase !== 'lobby' && <span className="round-tag">Round {meta.round} · {mapName}</span>}
          <button className="btn tiny" onClick={toggleVolume}>{soundLabel}</button>
        </div>
      </div>
      {ui && ui.killfeed.length > 0 && (
        <div className="killfeed">
          {ui.killfeed.map((k) => (
            <div key={k.id} className="kill">
              {killLine(k)}
            </div>
          ))}
        </div>
      )}
      {zoneWarn && <div className="zone-warn">{zoneWarn}</div>}
      {countdown}
      {roundBanner}
      {spectating}
      {hud}
      {overlay && <div className="overlay">{overlay}</div>}
    </div>
  );
}
