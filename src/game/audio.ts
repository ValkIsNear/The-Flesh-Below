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

// Band-limited, broken carrier. Every node is stopped on scene/line change.
export function radioCarrier(seconds = 1.3) {
  const c = getCtx();
  if (!c) return () => {};
  const source = c.createBufferSource();
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    const t = i / c.sampleRate;
    samples[i] = (Math.random() * 2 - 1) * (Math.sin(t * 39) > 0.35 ? 0.08 : 0.28);
  }
  source.buffer = buffer;
  const filter = c.createBiquadFilter(); filter.type = "bandpass"; filter.frequency.value = 1350; filter.Q.value = 0.8;
  const gain = c.createGain(); gain.gain.value = 0.25 * masterVolume;
  source.connect(filter).connect(gain).connect(c.destination); source.start();
  const stop = () => { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); filter.disconnect(); gain.disconnect(); };
  source.onended = stop;
  return stop;
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

// Simple, retro "klang" — square-wave decay reminiscent of early survival-horror
// footsteps. The "hydraulic" variant is a softer, lower thunk used for airlocks.
export function clang(kind: "step" | "hydraulic" = "step") {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "square";
  const baseFreq = kind === "hydraulic" ? 110 : 180;
  const endFreq = kind === "hydraulic" ? 55 : 90;
  o.frequency.setValueAtTime(baseFreq, now);
  o.frequency.exponentialRampToValueAtTime(endFreq, now + 0.14);
  // airlock noticeably softer than before; steps a clean klang
  const amp = (kind === "hydraulic" ? 0.10 : 0.22) * masterVolume;
  const dur = kind === "hydraulic" ? 0.28 : 0.22;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(amp, now + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}

// Soft, non-intrusive notification chime: two quiet sine tones, slow attack,
// long tail — closer to a distant sonar blip than an alert.
export function softChime() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 1500;
  lp.connect(c.destination);
  // Kin to the hull-tap of the footsteps, but higher, softer and ringing.
  [
    { f: 392, t: 0, amp: 0.045, type: "triangle" as OscillatorType },
    { f: 587, t: 0.11, amp: 0.03, type: "sine" as OscillatorType },
    { f: 1174, t: 0.11, amp: 0.012, type: "sine" as OscillatorType },
  ].forEach(({ f, t, amp, type }) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    const s = now + t;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * masterVolume), s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 1.5);
    o.connect(g).connect(lp);
    o.start(s);
    o.stop(s + 1.6);
  });
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

// Distant metallic groan: a slow pitch-bent, filtered sawtooth.
export function metalGroan() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator(); osc.type = "sawtooth";
  osc.frequency.setValueAtTime(70 + Math.random() * 30, t);
  osc.frequency.linearRampToValueAtTime(38 + Math.random() * 12, t + 2.6);
  const filter = c.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 320; filter.Q.value = 6;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.09 * masterVolume, t + 0.8);
  gain.gain.linearRampToValueAtTime(0, t + 2.8);
  osc.connect(filter).connect(gain).connect(c.destination);
  osc.start(t); osc.stop(t + 3);
  osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
}
