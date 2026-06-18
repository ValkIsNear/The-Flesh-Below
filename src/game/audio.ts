// Minimal procedural audio: deep drone, footstep clangs, and a slow Duster-like
// ambient music bed (slow detuned chord pad in a minor key with a soft pulse).

let ctx: AudioContext | null = null;
let droneGain: GainNode | null = null;
let droneNodes: { osc: OscillatorNode; noise: AudioBufferSourceNode; filter: BiquadFilterNode } | null = null;
let musicGain: GainNode | null = null;
let musicNodes: { oscs: OscillatorNode[]; lfo: OscillatorNode; lfoGain: GainNode; timer: number } | null = null;
let masterVolume = 0.6;


function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

export function setMasterVolume(v: number) {
  masterVolume = Math.max(0, Math.min(1, v));
  if (droneGain) droneGain.gain.value = 0.18 * masterVolume;
  if (musicGain) musicGain.gain.value = 0.14 * masterVolume;
}


export function startDrone(intensity = 0.5) {
  const c = getCtx();
  if (!c) return;
  stopDrone();
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 42 + intensity * 12;

  const noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 220 + intensity * 200;

  const g = c.createGain();
  g.gain.value = 0.18 * masterVolume;

  osc.connect(g);
  noise.connect(filter).connect(g);
  g.connect(c.destination);

  osc.start();
  noise.start();
  droneGain = g;
  droneNodes = { osc, noise, filter };
}

export function stopDrone() {
  if (droneNodes && droneGain && ctx) {
    try {
      droneNodes.osc.stop();
      droneNodes.noise.stop();
    } catch {
      // ignore
    }
    droneGain.disconnect();
    droneGain = null;
    droneNodes = null;
  }
}

export function clang(kind: "step" | "hydraulic" = "step") {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.9 * masterVolume;
  out.connect(c.destination);

  // Inharmonic partials of a struck metal bar / pipe.
  const partials =
    kind === "hydraulic"
      ? [
          { f: 180, a: 0.45, d: 0.55 },
          { f: 412, a: 0.22, d: 0.40 },
          { f: 870, a: 0.10, d: 0.22 },
          { f: 1530, a: 0.05, d: 0.14 },
        ]
      : [
          { f: 380, a: 0.40, d: 0.32 },
          { f: 932, a: 0.28, d: 0.22 },
          { f: 1720, a: 0.18, d: 0.16 },
          { f: 2640, a: 0.10, d: 0.10 },
          { f: 3870, a: 0.06, d: 0.07 },
        ];

  for (const p of partials) {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = p.f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.a * 0.5, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.d);
    o.connect(g).connect(out);
    o.start(now);
    o.stop(now + p.d + 0.02);
  }

  // Low thump body — weight of the boot on deck plate
  const thump = c.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(kind === "hydraulic" ? 95 : 140, now);
  thump.frequency.exponentialRampToValueAtTime(40, now + 0.12);
  const tg = c.createGain();
  tg.gain.setValueAtTime(0.0001, now);
  tg.gain.exponentialRampToValueAtTime(0.45, now + 0.004);
  tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  thump.connect(tg).connect(out);
  thump.start(now);
  thump.stop(now + 0.22);

  // Short bright noise transient — the strike itself
  const nBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.08), c.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / nd.length, 3);
  const n = c.createBufferSource();
  n.buffer = nBuf;
  const nf = c.createBiquadFilter();
  nf.type = "highpass";
  nf.frequency.value = kind === "hydraulic" ? 800 : 2200;
  const ng = c.createGain();
  ng.gain.value = kind === "hydraulic" ? 0.18 : 0.28;
  n.connect(nf).connect(ng).connect(out);
  n.start(now);

  if (kind === "hydraulic") {
    // Pneumatic hiss tail
    const hBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.35), c.sampleRate);
    const hd = hBuf.getChannelData(0);
    for (let i = 0; i < hd.length; i++) hd[i] = (Math.random() * 2 - 1) * (1 - i / hd.length);
    const h = c.createBufferSource();
    h.buffer = hBuf;
    const hf = c.createBiquadFilter();
    hf.type = "bandpass";
    hf.frequency.value = 2800;
    hf.Q.value = 0.7;
    const hg = c.createGain();
    hg.gain.value = 0.18;
    h.connect(hf).connect(hg).connect(out);
    h.start(now + 0.04);
  }

  setTimeout(() => { try { out.disconnect(); } catch { /* noop */ } }, 900);
}

export function heartbeat() {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.value = 60;
  const now = c.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.4 * masterVolume, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + 0.4);
}

// ---- Ambient music (Duster "Letting Go" vibe: slow, low, melancholic) ----
// A drifting chord progression in F# minor: F#m – D – A – E (vi – IV – I – V).
// Each chord sustains ~9s. Detuned sines + soft noise bed + slow LFO swell.

const CHORDS: number[][] = [
  // F#m: F#2 A2 C#3 F#3
  [92.5, 110.0, 138.59, 185.0],
  // D:   D2  A2  F#3 D3
  [73.42, 110.0, 185.0, 146.83],
  // A:   A2  C#3 E3  A3
  [110.0, 138.59, 164.81, 220.0],
  // E:   E2  B2  G#3 E3
  [82.41, 123.47, 207.65, 164.81],
];

const CHORD_SECONDS = 9;

export function startMusic() {
  const c = getCtx();
  if (!c) return;
  stopMusic();

  const master = c.createGain();
  master.gain.value = 0.14 * masterVolume;
  master.connect(c.destination);

  // soft tape-hiss bed
  const noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.06;
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nf = c.createBiquadFilter();
  nf.type = "lowpass";
  nf.frequency.value = 1200;
  const ng = c.createGain();
  ng.gain.value = 0.5;
  noise.connect(nf).connect(ng).connect(master);
  noise.start();

  // slow LFO swelling the bus
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.06 * masterVolume;
  lfo.connect(lfoGain).connect(master.gain);
  lfo.start();

  // 4 voices, kept alive and re-tuned per chord change
  const oscs: OscillatorNode[] = [];
  const voiceGains: GainNode[] = [];
  for (let i = 0; i < 4; i++) {
    const o = c.createOscillator();
    o.type = i === 0 ? "triangle" : "sine";
    o.detune.value = (i - 1.5) * 6; // slight chorus
    const g = c.createGain();
    g.gain.value = 0;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 900;
    o.connect(f).connect(g).connect(master);
    o.start();
    oscs.push(o);
    voiceGains.push(g);
  }

  let chordIdx = 0;
  const setChord = (idx: number) => {
    const chord = CHORDS[idx % CHORDS.length];
    const now = c.currentTime;
    chord.forEach((freq, i) => {
      oscs[i].frequency.cancelScheduledValues(now);
      oscs[i].frequency.linearRampToValueAtTime(freq, now + 2.0);
      voiceGains[i].gain.cancelScheduledValues(now);
      // fade in, hold, fade out within chord window
      voiceGains[i].gain.linearRampToValueAtTime(0.22, now + 2.5);
      voiceGains[i].gain.linearRampToValueAtTime(0.18, now + CHORD_SECONDS - 1);
    });
  };
  setChord(chordIdx);
  const timer = window.setInterval(() => {
    chordIdx++;
    setChord(chordIdx);
  }, CHORD_SECONDS * 1000);

  musicGain = master;
  musicNodes = { oscs: [...oscs, noise as unknown as OscillatorNode], lfo, lfoGain, timer };
}

export function stopMusic() {
  if (musicNodes && musicGain && ctx) {
    window.clearInterval(musicNodes.timer);
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.linearRampToValueAtTime(0, now + 1.2);
    const oscs = musicNodes.oscs;
    const lfo = musicNodes.lfo;
    const g = musicGain;
    window.setTimeout(() => {
      oscs.forEach((o) => { try { o.stop(); } catch { /* noop */ } });
      try { lfo.stop(); } catch { /* noop */ }
      try { g.disconnect(); } catch { /* noop */ }
    }, 1400);
    musicGain = null;
    musicNodes = null;
  }
}
