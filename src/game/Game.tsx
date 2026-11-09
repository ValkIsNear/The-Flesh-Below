import { Button } from "@/components/ui/button";
import { devSceneTarget, type DevScene } from "./dev-scenes";
import { TitleTumors } from "./TitleTumors";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  AIRLOCK_LINES,
  CREDITS,
  HUSK_LINES,
  INTRO_EPIGRAPH,
  INTRO_PROSE,
  MORGUE_LINES,
  type Line,
} from "./dialogue";
import { clang, heartbeat, setMasterVolume, startDrone, startMusic, stopDrone, stopMusic, unlockAudio } from "./audio";
import { postMorgueState, recordPraviGlas, type DiveLogEntry } from "./pravi-glas-flow";

const DiveScene = lazy(() => import("./DiveScene"));
const ChaseCutscene = lazy(() => import("./ChaseCutscene"));
const PraviGlas = lazy(() => import("./PraviGlas"));
const SignalScene = lazy(() => import("./SignalScene"));
const SignalEnter = lazy(() => import("./SignalEnter"));

type Scene = "title" | "intro" | "airlock" | "dive" | "husk" | "chase" | "return" | "morgue" | "credits" | "pravi-glas" | "signal" | "signal-enter" | "signal-relay" | "dev-unbuilt";

export default function Game({ devScene }: { devScene?: DevScene }) {
  const [scene, setScene] = useState<Scene>(devSceneTarget(devScene));
  const [volume, setVolume] = useState(0.6);
  const [diveLog, setDiveLog] = useState<DiveLogEntry[]>([]);
  const [progress, setProgress] = useState({ morgueCompleted: false, creditsCompleted: false });
  const musicStarted = useRef(false);

  useEffect(() => {
    if (devScene) {
      const state = postMorgueState(new Date());
      setDiveLog(state.entries); setProgress(state);
    }
  }, [devScene]);

  useEffect(() => setMasterVolume(volume), [volume]);

  useEffect(() => {
    if (scene === "dive" || scene === "return") startDrone(0.8);
    else if (scene === "husk") startDrone(1);
    else if (scene === "airlock" || scene === "pravi-glas") startDrone(0.3);
    else stopDrone();
    // ambient music: starts after title, persists across scenes, stops on credits
    if (scene !== "title" && scene !== "credits" && !musicStarted.current) {
      startMusic();
      musicStarted.current = true;
    }
    if (scene === "credits" && musicStarted.current) {
      stopMusic();
      musicStarted.current = false;
    }
  }, [scene]);

  useEffect(() => () => { stopDrone(); stopMusic(); }, []);


  return (
    <div className="sy-root">
      <Crt />
      {scene === "title" && (
        <Title
          onStart={() => {
            unlockAudio();
            setScene("intro");
          }}
          volume={volume}
          setVolume={setVolume}
        />
      )}
      {scene === "intro" && <Reader title="Introduction" lines={INTRO_PROSE} onDone={() => setScene("airlock")} />}
      {scene === "airlock" && (
        <Reader
          title="Airlock 4 — Pressure 800 atm"
          lines={AIRLOCK_LINES}
          onDone={() => setScene("dive")}
          onLine={(l) => {
            if (l.kind === "sfx") clang("hydraulic");
          }}
        />
      )}
      {scene === "dive" && (
        <DiveFrame>
          <Suspense fallback={<LoadingPanel />}>
            <DiveScene onReach={() => setScene("husk")} />
          </Suspense>
          <DiveHud />
        </DiveFrame>
      )}
      {scene === "husk" && (
        <Reader
          title="Sector Gamma-7"
          lines={HUSK_LINES}
          onDone={() => setScene("chase")}
          onLine={(l) => {
            if (l.kind === "radio" && l.speaker === "ABYSS") heartbeat();
          }}
        />
      )}
      {scene === "chase" && (
        <Suspense fallback={<LoadingPanel />}>
          <ChaseCutscene onDone={() => setScene("return")} />
        </Suspense>
      )}
      {scene === "return" && (
        <DiveFrame>
          <Suspense fallback={<LoadingPanel />}>
            <DiveScene direction="return" onReach={() => setScene("morgue")} />
          </Suspense>
          <DiveHud />
        </DiveFrame>
      )}
      {scene === "morgue" && <Reader title="The Morgue" lines={MORGUE_LINES} onDone={() => {
        const state = postMorgueState(new Date()); setDiveLog(state.entries);
        setProgress({ morgueCompleted: true, creditsCompleted: false }); setScene("credits");
      }} />}
      {scene === "credits" && <Credits onRestart={() => { setProgress(p => ({ ...p, creditsCompleted: true })); setScene("pravi-glas"); }} />}
      {scene === "pravi-glas" && progress.morgueCompleted && progress.creditsCompleted && <Suspense fallback={<LoadingPanel />}><PraviGlas initialLogOpen={devScene === "divelog"} entries={diveLog} onComplete={() => setDiveLog(entries => recordPraviGlas(entries, new Date()))} onContinue={() => setScene("signal-enter")} /></Suspense>}
      {scene === "signal-enter" && <Suspense fallback={null}><SignalEnter onDone={() => setScene("signal")} /></Suspense>}
      {scene === "signal" && progress.morgueCompleted && <Suspense fallback={<LoadingPanel />}><SignalScene onDone={() => setScene("signal-relay")} /></Suspense>}
      {scene === "signal-relay" && <section className="pg-log" aria-label="Relay room"><header><h2>RELAY ROOM</h2></header><p>The bulkhead seals behind me.</p><p>DEV · Next room not built yet.</p><Button className="pg-btn" onClick={() => setScene("signal")}>Replay corridor</Button></section>}
      {scene === "dev-unbuilt" && <section className="pg-log" aria-label="Developer scene unavailable"><header><h2>DEV / {devScene?.toUpperCase()}</h2></header><p>This scene has not been built yet.</p><p>Post-morgue state initialized. No story events have been added.</p><Button className="pg-btn" onClick={() => setScene("pravi-glas")}>Comms</Button></section>}
      <Styles />
    </div>
  );
}

function Title({ onStart, volume, setVolume }: { onStart: () => void; volume: number; setVolume: (n: number) => void }) {
  const lightRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = lightRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      el.style.setProperty("--mx", `${e.clientX}px`);
      el.style.setProperty("--my", `${e.clientY}px`);
    };
    window.addEventListener("mousemove", onMove);
    // initial center
    el.style.setProperty("--mx", `${window.innerWidth / 2}px`);
    el.style.setProperty("--my", `${window.innerHeight / 2}px`);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return (
    <div className="sy-screen sy-title">
      <div ref={lightRef} className="sy-title-light" aria-hidden />
      <TitleTumors />
      <div className="sy-title-inner">
        <div className="sy-sub sy-above">The Heavy</div>
        <div className="sy-mark">Flesh Below</div>
        <div className="sy-epigraph">
          {INTRO_EPIGRAPH.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
        <Button variant="ghost" className="sy-btn" onClick={onStart}>
          BEGIN DIVE
        </Button>
        <div className="sy-controls">
          <div>Arrows / WASD — move</div>
          <div>Space / Enter — continue</div>
        </div>
        <label className="sy-vol">
          Vol
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
          />
        </label>
        <div className="sy-warning">Headphones recommended. Themes of grief and loss.</div>
      </div>
    </div>
  );
}

function Reader({
  title,
  lines,
  onDone,
  onLine,
}: {
  title: string;
  lines: Line[];
  onDone: () => void;
  onLine?: (l: Line) => void;
}) {
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const lineRef = useRef<Line | null>(null);

  const current = lines[i];
  const fullText =
    current.kind === "radio"
      ? `${current.speaker}: ${current.text}`
      : current.text;

  useEffect(() => {
    setRevealed(0);
    if (lineRef.current !== current) {
      lineRef.current = current;
      onLine?.(current);
    }
    const speed = current.kind === "narration" ? 18 : 28;
    const id = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= fullText.length) {
          window.clearInterval(id);
          return r;
        }
        return r + 1;
      });
    }, 1000 / speed);
    return () => window.clearInterval(id);
  }, [current, fullText, onLine]);

  useEffect(() => {
    const advance = () => {
      if (revealed < fullText.length) {
        setRevealed(fullText.length);
        return;
      }
      if (i < lines.length - 1) setI(i + 1);
      else onDone();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key.toLowerCase() === "e") {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, fullText.length, i, lines.length, onDone]);

  return (
    <div className="sy-screen sy-reader">
      <div className="sy-page">
        <div className="sy-page-num">{String(i + 1).padStart(2, "0")} / {String(lines.length).padStart(2, "0")}</div>
        <div className="sy-chapter">{title}</div>
        <div className={`sy-text sy-text-${current.kind}`}>
          {current.kind === "radio" && (
            <>
              <span className={`sy-speaker sy-${current.speaker.toLowerCase()}`}>{current.speaker}</span>
              <span className="sy-en">
                {fullText.slice(current.speaker.length + 2, revealed)}
              </span>
            </>
          )}
          {current.kind !== "radio" && <span>{fullText.slice(0, revealed)}</span>}
          <span className="sy-cursor">▌</span>
        </div>
        <div className="sy-hint">[ space ] continue</div>
        <Button
          variant="ghost"
          aria-label="Continue"
          className="sy-skip"
          onClick={() => {
            if (revealed < fullText.length) setRevealed(fullText.length);
            else if (i < lines.length - 1) setI(i + 1);
            else onDone();
          }}
        >
          ▸
        </Button>
      </div>
    </div>
  );
}

function DiveFrame({ children }: { children: React.ReactNode }) {
  return <div className="sy-screen sy-dive">{children}</div>;
}

function DiveHud() {
  return (
    <div className="sy-hud">
      <div className="sy-hud-row">
        <span>ASSET 77-T</span>
        <span>DEPTH 3000m</span>
        <span>PRESSURE 800 atm</span>
        <span>O₂ 47%</span>
      </div>
      <div className="sy-hud-hint">WASD — move · mouse — look · right click — aim</div>
    </div>
  );
}

function LoadingPanel() {
  return <div className="sy-loading">…loading the depths…</div>;
}

function Credits({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="sy-screen sy-credits">
      <div className="sy-credits-inner">
        <div className="sy-mark sy-small">{CREDITS.title}</div>
        <div className="sy-sub">{CREDITS.subtitle}</div>
        <div className="sy-creditlines">
          {CREDITS.lines.map((l, i) => (
            <div key={i}>{l || "\u00a0"}</div>
          ))}
        </div>
        <Button variant="ghost" className="sy-btn" onClick={onRestart}>
          CONTINUE
        </Button>
      </div>
    </div>
  );
}

function Crt() {
  return <div className="sy-crt" aria-hidden />;
}

function Styles() {
  return (
    <style>{`
      .sy-root {
        position: fixed; inset: 0; background: #050306; color: #e6dccf;
        font-family: ui-monospace, "Courier New", monospace;
        overflow: hidden;
      }
      .sy-crt {
        pointer-events: none; position: fixed; inset: 0; z-index: 50;
        background:
          repeating-linear-gradient(to bottom, rgba(0,0,0,0.25) 0 1px, transparent 1px 3px),
          radial-gradient(ellipse at center, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%);
        mix-blend-mode: multiply;
      }
      .sy-screen { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
      .sy-title { background: radial-gradient(circle at 50% 40%, #0d0309 0%, #020103 70%); overflow: hidden; }
      .sy-title-light {
        pointer-events: none; position: absolute; inset: 0; z-index: 1;
        background: radial-gradient(
          640px circle at var(--mx, 50%) var(--my, 50%),
          rgba(255, 210, 170, 0.06) 0%,
          rgba(200, 80, 90, 0.05) 45%,
          rgba(0,0,0,0) 80%
        );
        mix-blend-mode: screen;
        transition: background 80ms linear;
      }
      .sy-title-inner { position: relative; z-index: 2; text-align: center; width: min(620px, 100%); padding: 24px; }
      .sy-mark {
        font-family: "Times New Roman", serif; font-size: 88px; letter-spacing: 0; overflow-wrap: normal;
        color: #f1e6d6; text-shadow: 0 0 30px rgba(180, 40, 60, 0.4);
      }
      @media (max-width: 600px) { .sy-mark { font-size: 56px; } .sy-mark.sy-small { font-size: 48px; } }
      .sy-mark.sy-small { font-size: 64px; }
      .sy-sub { font-size: 13px; letter-spacing: 0.4em; color: #a08a78; margin-bottom: 28px; }
      .sy-above { margin-bottom: 6px; }
      .sy-epigraph {
        font-style: italic; color: #8a7464; font-size: 14px; line-height: 1.8; margin: 18px 0 28px;
      }
      .sy-btn {
        background: transparent; border: 1px solid #5a3a30; color: #e6dccf;
        padding: 12px 28px; letter-spacing: 0.25em; font-size: 12px; cursor: pointer;
        transition: all 0.2s;
      }
      .sy-btn:hover { background: rgba(120, 30, 40, 0.2); border-color: #a8504a; color: #fff; }
      .sy-controls { margin-top: 28px; font-size: 10px; color: #5a4a40; letter-spacing: 0.15em; line-height: 2; }
      .sy-vol { display: inline-flex; gap: 8px; align-items: center; margin-top: 18px; font-size: 10px; color: #6a5a50; }
      .sy-warning { margin-top: 24px; font-size: 9px; color: #4a3a35; letter-spacing: 0.2em; }

      .sy-reader { background: #0a0608; }
      .sy-page {
        position: relative;
        width: min(720px, 92vw); max-height: 86vh; overflow: hidden;
        padding: 56px 64px 80px;
        background: linear-gradient(180deg, #110a0c 0%, #0a0608 100%);
        border: 1px solid #2a1820;
        box-shadow: 0 0 60px rgba(120, 20, 40, 0.15);
      }
      .sy-page-num { position: absolute; top: 16px; right: 24px; font-size: 10px; color: #4a3a35; letter-spacing: 0.2em; }
      .sy-chapter {
        text-align: center; font-family: "Times New Roman", serif; font-size: 22px; color: #d6c4b0;
        margin-bottom: 32px; letter-spacing: 0.1em;
      }
      .sy-text { font-family: Georgia, "Times New Roman", serif; font-size: 16px; line-height: 1.75; color: #c8b8a4; min-height: 200px; }
      .sy-text-narration { color: #c8b8a4; }
      .sy-text-sfx { font-style: italic; color: #6a5a50; text-align: center; }
      .sy-text-radio { color: #d6c4b0; }
      .sy-speaker { display: inline-block; padding: 2px 6px; margin-right: 8px; border: 1px solid currentColor; font-family: ui-monospace, monospace; font-size: 11px; letter-spacing: 0.15em; }
      .sy-kayla { color: #c46a78; }
      .sy-system { color: #6aa898; }
      .sy-abyss { color: #a84858; font-weight: bold; text-shadow: 0 0 4px rgba(200, 40, 60, 0.6); }
      .sy-en { color: #8a7a6a; }
      .sy-cursor { animation: sy-blink 1s steps(2) infinite; color: #a85a60; margin-left: 2px; }
      @keyframes sy-blink { 50% { opacity: 0; } }
      .sy-hint { position: absolute; bottom: 24px; left: 64px; font-size: 10px; color: #4a3a35; letter-spacing: 0.2em; }
      .sy-skip { position: absolute; bottom: 16px; right: 24px; background: transparent; border: 1px solid #3a2a25; color: #8a7060; padding: 4px 14px; cursor: pointer; font-size: 14px; }
      .sy-skip:hover { color: #fff; border-color: #a8504a; }

      .sy-dive { background: #000; flex-direction: column; }
      .sy-hud { position: absolute; left: 0; right: 0; bottom: 0; padding: 12px 18px; pointer-events: none; font-size: 11px; letter-spacing: 0.18em; color: #a85a60; text-shadow: 0 0 4px rgba(168, 90, 96, 0.6); }
      .sy-hud-row { display: flex; justify-content: space-between; gap: 24px; }
      .sy-hud-hint { text-align: center; margin-top: 6px; color: #6a4a45; font-size: 9px; }
      .sy-loading { color: #6a4a45; font-size: 12px; letter-spacing: 0.3em; }

      .sy-credits { background: #050306; }
      .sy-credits-inner { text-align: center; max-width: 560px; padding: 24px; }
      .sy-creditlines { margin: 32px 0; line-height: 2; color: #8a7464; font-size: 13px; font-style: italic; }
    `}</style>
  );
}
