// Minimal procedural audio: deep drone + footstep clangs. No external assets.

let ctx: AudioContext | null = null;
let droneGain: GainNode | null = null;
let droneNodes: { osc: OscillatorNode; noise: AudioBufferSourceNode; filter: BiquadFilterNode } | null = null;
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
  const o = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = kind === "hydraulic" ? 180 : 520;
  f.Q.value = 6;
  o.type = "square";
  o.frequency.value = kind === "hydraulic" ? 90 : 240;
  const now = c.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.35 * masterVolume, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "hydraulic" ? 0.35 : 0.12));
  o.connect(f).connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + 0.4);
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
