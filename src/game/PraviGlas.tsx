import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { radioCarrier, unlockAudio } from "./audio";
import { RECEPTION, confessionBranch, deathLogSlot, type ConfessionChoice, type DiveLogEntry, type RadioBeat } from "./pravi-glas-flow";

const DiveScene = lazy(() => import("./DiveScene"));

// Retro 8-bit "talk" blips instead of speech; the echo stays faint and unattributed.
let blipCtx: AudioContext | null = null;
function transmit(beat: RadioBeat) {
  const stopNoise = radioCarrier(beat.echo ? 2 : 1.3);
  let timer = 0;
  const oscs: OscillatorNode[] = [];
  if (beat.speaker && typeof window !== "undefined") {
    timer = window.setTimeout(() => {
      blipCtx ??= new AudioContext();
      const c = blipCtx; const t0 = c.currentTime;
      const base = beat.speaker === "FRIEND" ? 150 : 260;
      const gain = c.createGain(); gain.gain.value = beat.echo ? 0.02 : 0.05; gain.connect(c.destination);
      const chars = beat.text.replace(/[^\p{L}]/gu, "").length;
      const n = Math.min(60, Math.ceil(chars / 2));
      for (let i = 0; i < n; i++) {
        const o = c.createOscillator(); o.type = "square";
        o.frequency.value = base * (1 + ((i * 7) % 5) * 0.12);
        o.connect(gain); const t = t0 + i * 0.07;
        o.start(t); o.stop(t + 0.045); oscs.push(o);
      }
    }, beat.pause ?? 250);
  }
  return () => { window.clearTimeout(timer); stopNoise(); oscs.forEach(o => { try { o.stop(); } catch { /* done */ } }); };
}

export default function PraviGlas({ entries, onComplete, initialLogOpen = false }: { entries: DiveLogEntry[]; onComplete: () => void; initialLogOpen?: boolean }) {
  const [near, setNear] = useState(false);
  const [started, setStarted] = useState(false);
  const [choice, setChoice] = useState<ConfessionChoice | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [echo, setEcho] = useState(false);
  const [done, setDone] = useState(false);
  const [logOpen, setLogOpen] = useState(initialLogOpen);
  const beats = choice ? [...RECEPTION, ...confessionBranch(choice)] : RECEPTION;
  const current = beats[index];
  const choose = started && !choice && index >= RECEPTION.length;
  const onNear = useCallback((value: boolean) => setNear(value), []);
  const start = useCallback(() => {
    if (!near || started) return;
    unlockAudio(); document.exitPointerLock?.(); setStarted(true);
  }, [near, started]);
  const advance = useCallback(() => {
    if (!visible || choose || done || !current) return;
    const next = index + (current.id === "advice" ? 2 : 1);
    if (choice && next >= beats.length) { setDone(true); onComplete(); }
    else setIndex(next);
  }, [visible, choose, done, current, index, choice, beats.length, onComplete]);

  useEffect(() => {
    const trigger: RadioBeat = { id: "trigger", speaker: "FRIEND", text: "T-77… relay here. Do you read me?", pause: 1400 };
    return transmit(trigger);
  }, []);
  useEffect(() => {
    if (!started || !current || done) return;
    setVisible(false); setEcho(false);
    const stop = current.speaker ? transmit(current) : () => {};
    const timer = window.setTimeout(() => setVisible(true), current.pause ?? 180);
    // Advice and the single secondary-channel echo occupy the same moment.
    let stopEcho = () => {};
    const echoTimer = current.id === "advice" ? window.setTimeout(() => {
      setEcho(true);
      const echoBeat = beats[index + 1];
      if (echoBeat) stopEcho = transmit(echoBeat);
    }, current.pause ?? 700) : undefined;
    return () => { stop(); stopEcho(); window.clearTimeout(timer); window.clearTimeout(echoTimer); };
  // Beat identity comes from the stable choice and index, not the rebuilt array.
  }, [started, index, choice, done]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || logOpen) return;
      if (e.code === "KeyE" && !started) { e.preventDefault(); start(); }
      else if (started && ["Space", "Enter"].includes(e.code)) { e.preventDefault(); advance(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [logOpen, start, advance, started]);

  return <div className="pg-root">
    <Suspense fallback={<div className="sy-loading">…relay…</div>}>
      <div className="pg-world"><DiveScene comms paused={started || logOpen} onCommsNear={onNear} /></div>
    </Suspense>
    <div className="pg-status">T-77 · A REAL VOICE<br />RELAY 01 / SHARED CHANNEL</div>
    <div className="pg-tools"><Button className="pg-btn" size="icon" title="Dive Log" aria-label="Dive Log" onClick={() => { document.exitPointerLock?.(); setLogOpen(true); }}><BookOpen /></Button></div>
    {!started && <div className="pg-panel"><div className="pg-speaker">FRIEND · RX / SIGNAL LOSS</div><div className="pg-line">T-77… relay here. Do you read me?</div><div className="pg-narration">Not the voice I was waiting for. Too much hiss. A syllable arrives after the carrier has closed.</div></div>}
    {!started && near && <Button className="pg-btn pg-start" onClick={start}>E · Engage transmitter</Button>}
    {started && !done && <section className="pg-panel" aria-label="A Real Voice conversation" aria-live="polite">
      {choose ? <><div className="pg-narration pg-line">I have kept the sentence behind my teeth all the way here.</div><div className="pg-options">
        <Button className="pg-btn" onClick={() => setChoice("direct")}>I need to say something.</Button>
        <Button className="pg-btn" onClick={() => setChoice("present")}>She's with me. Can't you hear her?</Button>
        <Button className="pg-btn" onClick={() => setChoice("deflect")}>Can we just check the signal?</Button>
      </div></> : current && <>
        <div className="pg-speaker">{current.speaker ?? "T-77 / INTERNAL"}{current.speaker === "FRIEND" ? " · RX / SIGNAL LOSS" : ""}</div>
        <div className={`pg-line ${current.speaker ? "" : "pg-narration"}`}>{visible ? current.text : "…"}</div>
        {echo && <div className="pg-echo">CHANNEL 02 · Come home.</div>}
        <div className="pg-options"><Button className="pg-btn" size="icon" aria-label="Continue conversation" title="Continue" disabled={!visible} onClick={advance}><ArrowRight /></Button></div>
      </>}
    </section>}
    {done && <section className="pg-panel"><div className="pg-speaker">RELAY 01 · TRANSMISSION CLOSED</div><div className="pg-narration pg-line">The relay clicks back into its rhythm. I keep my hand on the switch a little longer.</div><Button className="pg-btn" onClick={() => setLogOpen(true)}><BookOpen /> Dive Log</Button></section>}
    {logOpen && <section className="pg-log" aria-label="Dive Log"><header><h2>DIVE LOG / T-77</h2><Button className="pg-btn" size="icon" aria-label="Close Dive Log" onClick={() => setLogOpen(false)}><X /></Button></header>
      {[...entries, deathLogSlot()].map(entry => <article key={entry.id} className="pg-entry"><time>{entry.date}</time><p>{entry.record}</p></article>)}
    </section>}
  </div>;
}