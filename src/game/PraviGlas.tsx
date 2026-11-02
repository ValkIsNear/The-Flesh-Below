import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { radioCarrier } from "./audio";
import { RECEPTION, confessionBranch, deathLogSlot, type ConfessionChoice, type DiveLogEntry, type RadioBeat } from "./pravi-glas-flow";

const DiveScene = lazy(() => import("./DiveScene"));

// Speech remains browser-only and the unattributed echo is never a speaker character.
function transmit(beat: RadioBeat) {
  const stopNoise = radioCarrier(beat.echo ? 2 : 1.3);
  let timer = 0;
  if (beat.speaker && "speechSynthesis" in window) {
    timer = window.setTimeout(() => {
      const speech = new SpeechSynthesisUtterance(beat.text);
      speech.lang = "sr-RS"; speech.rate = beat.echo ? 0.72 : 0.82; speech.volume = beat.echo ? 0.18 : 0.38;
      const voice = window.speechSynthesis.getVoices().find(v => v.lang.startsWith("sr"));
      if (voice) speech.voice = voice;
      window.speechSynthesis.speak(speech);
    }, beat.pause ?? 250);
  }
  return () => { window.clearTimeout(timer); stopNoise(); if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
}

export default function PraviGlas({ entries, onComplete }: { entries: DiveLogEntry[]; onComplete: () => void }) {
  const [near, setNear] = useState(false);
  const [started, setStarted] = useState(false);
  const [choice, setChoice] = useState<ConfessionChoice | null>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [echo, setEcho] = useState(false);
  const [done, setDone] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const beats = choice ? [...RECEPTION, ...confessionBranch(choice)] : RECEPTION;
  const current = beats[index];
  const choose = started && !choice && index >= RECEPTION.length;
  const onNear = useCallback((value: boolean) => setNear(value), []);
  const start = useCallback(() => {
    if (!near || started) return;
    document.exitPointerLock?.(); setStarted(true);
  }, [near, started]);
  const advance = useCallback(() => {
    if (!visible || choose || done || !current) return;
    const next = index + (current.id === "advice" ? 2 : 1);
    if (choice && next >= beats.length) { setDone(true); onComplete(); }
    else setIndex(next);
  }, [visible, choose, done, current, index, choice, beats.length, onComplete]);

  useEffect(() => {
    const trigger: RadioBeat = { id: "trigger", speaker: "PRIJATELJ", text: "T-77… ovde relej. Čuješ li me?", pause: 1400 };
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
    <Suspense fallback={<div className="sy-loading">…relej…</div>}>
      <DiveScene comms paused={started || logOpen} onCommsNear={onNear} />
    </Suspense>
    <div className="pg-status">T-77 · PRAVI GLAS<br />RELEJ 01 / DELJENI KANAL</div>
    <div className="pg-tools"><Button className="pg-btn" size="icon" title="Dive Log" aria-label="Dive Log" onClick={() => { document.exitPointerLock?.(); setLogOpen(true); }}><BookOpen /></Button></div>
    {!started && <div className="pg-panel"><div className="pg-speaker">PRIJATELJ · RX / PREKID</div><div className="pg-line">T-77… ovde relej. Čuješ li me?</div><div className="pg-narration">Not the voice I was waiting for. Too much hiss. A syllable arrives after the carrier has closed.</div></div>}
    {!started && near && <Button className="pg-btn pg-start" onClick={start}>E · Uključi predajnik</Button>}
    {started && !done && <section className="pg-panel" aria-label="Pravi glas razgovor" aria-live="polite">
      {choose ? <><div className="pg-narration pg-line">I have kept the sentence behind my teeth all the way here.</div><div className="pg-options">
        <Button className="pg-btn" onClick={() => setChoice("direct")}>Moram nešto da kažem.</Button>
        <Button className="pg-btn" onClick={() => setChoice("present")}>Ona je sa mnom. Zar je ne čuješ?</Button>
        <Button className="pg-btn" onClick={() => setChoice("deflect")}>Možemo li samo da proverimo signal?</Button>
      </div></> : current && <>
        <div className="pg-speaker">{current.speaker ?? "T-77 / INTERNAL"}{current.speaker === "PRIJATELJ" ? " · RX / PREKID" : ""}</div>
        <div className={`pg-line ${current.speaker ? "" : "pg-narration"}`}>{visible ? current.text : "…"}</div>
        {echo && <div className="pg-echo">KANAL 02 · …Vrati se kući.</div>}
        <div className="pg-options"><Button className="pg-btn" size="icon" aria-label="Nastavi razgovor" title="Nastavi" disabled={!visible} onClick={advance}><ArrowRight /></Button></div>
      </>}
    </section>}
    {done && <section className="pg-panel"><div className="pg-speaker">RELEJ 01 · VEZA ZATVORENA</div><div className="pg-narration pg-line">The relay clicks back into its rhythm. I keep my hand on the switch a little longer.</div><Button className="pg-btn" onClick={() => setLogOpen(true)}><BookOpen /> Dive Log</Button></section>}
    {logOpen && <section className="pg-log" aria-label="Dive Log"><header><h2>DIVE LOG / T-77</h2><Button className="pg-btn" size="icon" aria-label="Zatvori Dive Log" onClick={() => setLogOpen(false)}><X /></Button></header>
      {[...entries, deathLogSlot()].map(entry => <article key={entry.id} className="pg-entry"><time>{entry.date}</time><p>{entry.record}</p></article>)}
    </section>}
  </div>;
}