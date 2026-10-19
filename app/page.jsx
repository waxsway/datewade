'use client';

import { useEffect, useState } from 'react';
import Game from '../components/Game.jsx';
import { PLAYER_COLORS } from '../lib/constants.js';
import { makeRoomCode, isRoomCode } from '../lib/net.js';
import { CARDS, RARITY_COLORS } from '../lib/cards.js';
import { unlockAudio } from '../components/sfx.js';

function cleanName(value) {
  const trimmed = String(value || '').trim().slice(0, 14);
  if (trimmed.length === 0) {
    return 'Player';
  }
  return trimmed;
}

function swatchClass(c, selected) {
  if (c === selected) {
    return 'swatch on';
  }
  return 'swatch';
}

export default function Home() {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PLAYER_COLORS[1]);
  const [joinCode, setJoinCode] = useState('');
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [netKind, setNetKind] = useState('trystero');

  useEffect(() => {
    try {
      const savedName = localStorage.getItem('dw-name');
      if (savedName) {
        setName(savedName);
      }
      const savedColor = localStorage.getItem('dw-color');
      if (savedColor && PLAYER_COLORS.includes(savedColor)) {
        setColor(savedColor);
      }
    } catch (err) {
      // storage blocked, fine
    }
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('r') || '').toUpperCase();
    if (isRoomCode(code)) {
      setJoinCode(code);
    }
    if (params.get('net') === 'local') {
      setNetKind('local');
    }
  }, []);

  function remember() {
    try {
      localStorage.setItem('dw-name', cleanName(name));
      localStorage.setItem('dw-color', color);
    } catch (err) {
      // ignore
    }
  }

  function launch(kind, code) {
    unlockAudio();
    remember();
    let net = netKind;
    if (kind === 'practice') {
      net = 'offline';
    }
    setConfig({ kind, code, name: cleanName(name), color, netKind: net });
    if (kind !== 'practice') {
      let url = window.location.pathname + '?r=' + code;
      if (netKind === 'local') {
        url += '&net=local';
      }
      window.history.replaceState({}, '', url);
    }
  }

  function host() {
    launch('host', makeRoomCode());
  }

  function join() {
    const code = joinCode.trim().toUpperCase();
    if (!isRoomCode(code)) {
      setError('Room codes are 5 letters or numbers.');
      return;
    }
    setError('');
    launch('join', code);
  }

  function exit() {
    setConfig(null);
    let url = window.location.pathname;
    if (netKind === 'local') {
      url += '?net=local';
    }
    window.history.replaceState({}, '', url);
  }

  if (config) {
    return <Game config={config} onExit={exit} />;
  }

  const showcase = ['ricochet', 'payload', 'minigun', 'vampire', 'railgun', 'secondwind'];

  return (
    <main className="home">
      <div className="home-bg" />
      <section className="home-card">
        <h1 className="logo">
          <span>DATEWADE</span>
          <span className="logo-sub">ARENA</span>
        </h1>
        <p className="tagline">Top-down shootouts for 2 to 8 friends. Win the round, everybody grabs an upgrade, builds get stupid.</p>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            maxLength={14}
            placeholder="Player"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isRoomCode(joinCode.trim().toUpperCase())) {
                join();
              }
            }}
          />
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                className={swatchClass(c, color)}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={'color ' + c}
              />
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn primary big" onClick={host}>Create room</button>
          <div className="join">
            <input
              value={joinCode}
              maxLength={5}
              placeholder="CODE"
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  join();
                }
              }}
            />
            <button className="btn big" onClick={join}>Join</button>
          </div>
          <button className="btn ghost" onClick={() => launch('practice', 'PRACTICE')}>Practice against bots</button>
          {error && <p className="error">{error}</p>}
          {netKind === 'local' && <p className="muted small">Local test mode: rooms only work between tabs on this computer.</p>}
        </div>

        <div className="how">
          <div>
            <b>1.</b> One person creates a room and sends the link.
          </div>
          <div>
            <b>2.</b> Last one standing wins the round. Zone closes in after 22 seconds.
          </div>
          <div>
            <b>3.</b> After every round, everyone picks 1 of 3 random stat cards. Losers get better odds.
          </div>
        </div>
      </section>

      <aside className="home-cards">
        <div className="eyebrow">{CARDS.length} upgrades, a few of them:</div>
        {showcase.map((id) => {
          const card = CARDS.find((c) => c.id === id);
          return (
            <div key={id} className="mini-card" style={{ '--rc': RARITY_COLORS[card.rarity] }}>
              <b>{card.name}</b>
              <span>{card.lines.map((l) => l.replace(/^!/, '')).join(' · ')}</span>
            </div>
          );
        })}
        <div className="controls-help vertical">
          <span><b>WASD</b> move</span>
          <span><b>Mouse</b> aim, <b>click</b> shoot</span>
          <span><b>Space</b> or <b>right click</b> dash</span>
          <span><b>R</b> reload, <b>1 2 3</b> pick cards</span>
        </div>
      </aside>
    </main>
  );
}
