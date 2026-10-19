// Tiny synthesized sound kit. No audio files to download.

let ctx = null;
let master = null;
let noiseBuffer = null;
let volume = 0.5;
let lastPlay = {};

function ensure() {
  if (ctx) {
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return true;
  } catch (err) {
    ctx = null;
    return false;
  }
}

export function unlockAudio() {
  if (!ensure()) {
    return;
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function setVolume(v) {
  volume = v;
  if (master) {
    master.gain.value = v;
  }
}

export function getVolume() {
  return volume;
}

function throttle(name, ms) {
  const now = performance.now();
  const prev = lastPlay[name] || 0;
  if (now - prev < ms) {
    return true;
  }
  lastPlay[name] = now;
  return false;
}

function tone(type, f0, f1, dur, gain, delay) {
  const t = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, gain, filterType, freq, delay) {
  const t = ctx.currentTime + (delay || 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export function play(name, opts) {
  if (!ctx || volume <= 0) {
    return;
  }
  const o = opts || {};
  switch (name) {
    case 'shoot': {
      if (throttle('shoot', 28)) {
        return;
      }
      const heavy = Math.min(1, (o.damage || 20) / 60);
      let g = 0.12;
      if (o.mine !== true) {
        g = 0.06;
      }
      tone('square', 900 - heavy * 500, 140, 0.07 + heavy * 0.06, g);
      noise(0.05 + heavy * 0.05, g * 0.9, 'highpass', 1800 - heavy * 1200);
      break;
    }
    case 'hit': {
      if (throttle('hit', 30)) {
        return;
      }
      noise(0.08, 0.22, 'bandpass', 900);
      tone('sine', 220, 90, 0.08, 0.12);
      break;
    }
    case 'hurt': {
      noise(0.12, 0.3, 'lowpass', 600);
      tone('sawtooth', 160, 60, 0.15, 0.12);
      break;
    }
    case 'wall': {
      if (throttle('wall', 40)) {
        return;
      }
      tone('triangle', 1600, 700, 0.04, 0.03);
      break;
    }
    case 'kill': {
      tone('square', 520, 60, 0.4, 0.12);
      noise(0.35, 0.18, 'lowpass', 1200);
      break;
    }
    case 'boom': {
      if (throttle('boom', 50)) {
        return;
      }
      noise(0.5, 0.4, 'lowpass', 500);
      tone('sine', 120, 30, 0.45, 0.35);
      break;
    }
    case 'dash': {
      noise(0.16, 0.12, 'bandpass', 2400);
      tone('sine', 300, 900, 0.12, 0.05);
      break;
    }
    case 'reload': {
      tone('square', 260, 240, 0.04, 0.05);
      tone('square', 420, 400, 0.04, 0.05, 0.08);
      break;
    }
    case 'beep': {
      tone('square', 660, 660, 0.12, 0.08);
      break;
    }
    case 'go': {
      tone('square', 990, 990, 0.25, 0.1);
      tone('square', 1320, 1320, 0.25, 0.06, 0.05);
      break;
    }
    case 'card': {
      tone('triangle', 660, 660, 0.08, 0.1);
      tone('triangle', 880, 880, 0.08, 0.1, 0.07);
      tone('triangle', 1320, 1320, 0.16, 0.1, 0.14);
      break;
    }
    case 'win': {
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < notes.length; i += 1) {
        tone('square', notes[i], notes[i], 0.18, 0.08, i * 0.12);
      }
      break;
    }
    case 'revive': {
      tone('sine', 300, 1200, 0.4, 0.12);
      break;
    }
    case 'click': {
      tone('square', 700, 700, 0.03, 0.05);
      break;
    }
    default:
      break;
  }
}
