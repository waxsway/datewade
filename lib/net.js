// Network transport. "trystero" is the real one (WebRTC peer-to-peer, signaling
// through public Nostr relays, no server to pay for). "local" uses a
// BroadcastChannel so two tabs on one machine can test multiplayer offline.
// "offline" is practice mode with bots and no networking at all.

const APP_ID = 'com.datewade.arena.v3';

function randomId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function makeHub() {
  return {
    handlers: {},
    onPeerJoin: null,
    onPeerLeave: null,
    dispatch(action, data, peerId) {
      const fn = this.handlers[action];
      if (fn) {
        try {
          fn(data, peerId);
        } catch (err) {
          console.error('net handler failed', action, err);
        }
      }
    }
  };
}

async function createTrystero(code) {
  const mod = await import('trystero');
  const room = mod.joinRoom({ appId: APP_ID }, code);
  const hub = makeHub();
  const actions = {};
  function action(name) {
    if (!actions[name]) {
      const a = room.makeAction(name);
      a.onMessage = (data, ctx) => {
        hub.dispatch(name, data, ctx.peerId);
      };
      actions[name] = a;
    }
    return actions[name];
  }
  room.onPeerJoin = (peerId) => {
    if (hub.onPeerJoin) {
      hub.onPeerJoin(peerId);
    }
  };
  room.onPeerLeave = (peerId) => {
    if (hub.onPeerLeave) {
      hub.onPeerLeave(peerId);
    }
  };
  return {
    selfId: mod.selfId,
    on(name, fn) {
      action(name);
      hub.handlers[name] = fn;
    },
    send(name, data, target) {
      const opts = {};
      if (target) {
        opts.target = target;
      }
      Promise.resolve(action(name).send(data, opts)).catch(() => {});
    },
    set onPeerJoin(fn) {
      hub.onPeerJoin = fn;
    },
    set onPeerLeave(fn) {
      hub.onPeerLeave = fn;
    },
    leave() {
      try {
        room.leave();
      } catch (err) {
        // already gone
      }
    }
  };
}

function createLocal(code) {
  const selfId = randomId();
  const channel = new BroadcastChannel('datewade-' + code);
  const hub = makeHub();
  const peers = new Set();
  function post(msg) {
    channel.postMessage({ ...msg, from: selfId });
  }
  channel.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.from === selfId) {
      return;
    }
    if (msg.to && msg.to !== selfId) {
      return;
    }
    if (msg.type === 'join' || msg.type === 'here') {
      if (!peers.has(msg.from)) {
        peers.add(msg.from);
        if (msg.type === 'join') {
          post({ type: 'here', to: msg.from });
        }
        if (hub.onPeerJoin) {
          hub.onPeerJoin(msg.from);
        }
      }
      return;
    }
    if (msg.type === 'leave') {
      if (peers.delete(msg.from) && hub.onPeerLeave) {
        hub.onPeerLeave(msg.from);
      }
      return;
    }
    if (msg.type === 'data') {
      hub.dispatch(msg.action, msg.data, msg.from);
    }
  };
  const onUnload = () => post({ type: 'leave' });
  window.addEventListener('beforeunload', onUnload);
  setTimeout(() => post({ type: 'join' }), 50);
  return {
    selfId,
    on(name, fn) {
      hub.handlers[name] = fn;
    },
    send(name, data, target) {
      // Clone through JSON so local tests behave like the real wire.
      post({ type: 'data', action: name, data: JSON.parse(JSON.stringify(data)), to: target || null });
    },
    set onPeerJoin(fn) {
      hub.onPeerJoin = fn;
    },
    set onPeerLeave(fn) {
      hub.onPeerLeave = fn;
    },
    leave() {
      post({ type: 'leave' });
      window.removeEventListener('beforeunload', onUnload);
      channel.close();
    }
  };
}

function createOffline() {
  return {
    selfId: 'me-' + randomId(),
    on() {},
    send() {},
    set onPeerJoin(fn) {},
    set onPeerLeave(fn) {},
    leave() {}
  };
}

export async function createNet(kind, code) {
  if (kind === 'offline') {
    return createOffline();
  }
  if (kind === 'local') {
    return createLocal(code);
  }
  return createTrystero(code);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function isRoomCode(value) {
  return /^[A-Z2-9]{5}$/.test(value);
}
