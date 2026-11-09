import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { clang, metalGroan, startDrone, unlockAudio } from "./audio";
import { SIGNAL_DOOR_Z, SIGNAL_MONOLOGUE, canOpenSignalDoor, monologueDue, waterLevel } from "./signal-flow";

const W = 320, H = 200, F = 170;
const HALF = 0.9, FLOOR = -1.25, CEIL = 0.75;
const WALK = 1.6, SPRINT = 2.8;

export default function SignalScene({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [line, setLine] = useState<string | null>(null);
  const [atDoor, setAtDoor] = useState(false);
  const doneRef = useRef(false);
  const atDoorRef = useRef(false);

  const exit = () => { if (atDoorRef.current && !doneRef.current) { doneRef.current = true; clang("hydraulic"); onDone(); } };
  const exitRef = useRef(exit); exitRef.current = exit;

  useEffect(() => {
    const canvas = canvasRef.current!; const g = canvas.getContext("2d")!;
    startDrone(0.9);
    const keys = new Set<string>();
    let lastW = 0, sprint = false;
    const cam = { x: 0, z: 0.5, yaw: 0, bob: 0 };
    let back = false, blink = 0;
    const mdown = (e: MouseEvent) => { if (e.button === 2) { back = true; blink = 0.18; } };
    const mup = (e: MouseEvent) => { if (e.button === 2) { back = false; blink = 0.18; } };
    const ctx = (e: Event) => e.preventDefault();
    let played = 0, lineTimer = 0, groanTimer = 3, stepAcc = 0, raf = 0, last = performance.now();
    const down = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.code === "KeyW" && !e.repeat) { const now = performance.now(); sprint = now - lastW < 280; lastW = now; }
      if (e.code === "KeyE") exitRef.current();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.code); if (e.code === "KeyW") sprint = false; };
    const move = (e: MouseEvent) => { if (document.pointerLockElement === canvas) cam.yaw = Math.max(-0.5, Math.min(0.5, cam.yaw + e.movementX * 0.002)); };
    const click = () => { unlockAudio(); canvas.requestPointerLock?.(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move); canvas.addEventListener("click", click);
    window.addEventListener("mousedown", mdown); window.addEventListener("mouseup", mup); window.addEventListener("contextmenu", ctx);

    const proj = (x: number, y: number, dz: number) => {
      const d = Math.max(0.05, dz);
      const sx = back ? -1 : 1;
      return [W / 2 + sx * (x - cam.x) / d * F - (back ? 0 : cam.yaw * F), H / 2 - (y - Math.sin(cam.bob) * 0.03) / d * F] as const;
    };
    const quad = (pts: (readonly [number, number])[], fill: string) => {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.closePath(); g.fillStyle = fill; g.fill();
    };
    const shade = (base: [number, number, number], dz: number, flick = 1) => {
      const k = Math.max(0, 1 - dz / 18) * flick;
      return `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      if (keys.has("ArrowLeft")) cam.yaw = Math.max(-0.5, cam.yaw - dt);
      if (keys.has("ArrowRight")) cam.yaw = Math.min(0.5, cam.yaw + dt);
      const speed = (sprint && fwd > 0 ? SPRINT : WALK) * 0.8; // water drags at the shins
      const dz = fwd * speed * dt;
      cam.z = Math.max(0.5, Math.min(SIGNAL_DOOR_Z, cam.z + dz + Math.sin(cam.yaw) * Math.abs(dz) * 0));
      cam.x = Math.max(-HALF + 0.25, Math.min(HALF - 0.25, cam.x + side * 1.1 * dt));
      if (fwd || side) { cam.bob += dt * (sprint ? 11 : 7); stepAcc += Math.abs(dz); if (stepAcc > 0.9) { stepAcc = 0; clang("step"); } }

      const due = monologueDue(cam.z, played);
      if (due !== null) { setLine(SIGNAL_MONOLOGUE[due].text); played++; lineTimer = 5; }
      if (lineTimer > 0 && (lineTimer -= dt) <= 0) setLine(null);
      if ((groanTimer -= dt) <= 0) { metalGroan(); groanTimer = 6 + Math.random() * 7; }
      const near = canOpenSignalDoor(cam.z);
      if (near !== atDoorRef.current) { atDoorRef.current = near; setAtDoor(near); }

      // draw
      g.fillStyle = "#020303"; g.fillRect(0, 0, W, H);
      const water = FLOOR + waterLevel(cam.z) * (CEIL - FLOOR);
      const doorZ = SIGNAL_DOOR_Z + 1.2;
      const startZ = Math.floor(cam.z);
      const seg = (z: number, a: number, b: number) => {
        if (b <= 0.05) return;
        const za = Math.max(0.06, a);
        const flick = (Math.sin(t * 13 + z * 7.3) > -0.85 ? 1 : 0.25) * (0.75 + 0.25 * Math.sin(t * 3 + z));
        const rib = z % 4 === 0;
        // ceiling & walls
        quad([proj(-HALF, CEIL, za), proj(HALF, CEIL, za), proj(HALF, CEIL, b), proj(-HALF, CEIL, b)], shade([34, 36, 32], za));
        quad([proj(-HALF, CEIL, za), proj(-HALF, water, za), proj(-HALF, water, b), proj(-HALF, CEIL, b)], shade(rib ? [52, 48, 40] : [40, 42, 38], za));
        quad([proj(HALF, CEIL, za), proj(HALF, water, za), proj(HALF, water, b), proj(HALF, CEIL, b)], shade(rib ? [50, 46, 38] : [36, 38, 34], za));
        // amber emergency strips
        if (z % 2 === 0) {
          const amber = shade([230, 150, 40], za * 0.7, flick);
          quad([proj(-HALF, -0.32, za), proj(-HALF, -0.38, za), proj(-HALF, -0.38, b - 0.3), proj(-HALF, -0.32, b - 0.3)], amber);
          quad([proj(HALF, -0.32, za), proj(HALF, -0.38, za), proj(HALF, -0.38, b - 0.3), proj(HALF, -0.32, b - 0.3)], amber);
        }
        // dark water
        quad([proj(-HALF, water, za), proj(HALF, water, za), proj(HALF, water, b), proj(-HALF, water, b)], shade([10, 22, 26], za * 0.8));
        const ripple = Math.sin(t * 2 + z * 1.7) * 0.5;
        const [r1x, r1y] = proj(-HALF * 0.8 + ripple * 0.4, water, za + 0.5), [r2x] = proj(HALF * 0.6 + ripple * 0.3, water, za + 0.5);
        g.fillStyle = shade([80, 70, 40], za, flick * 0.6); g.fillRect(r1x, r1y, Math.max(1, r2x - r1x) * 0.3, 1);
      };
      if (back) {
        // looking over the shoulder: the sealed hatch I came through
        const hd = cam.z + 0.3;
        quad([proj(-HALF, CEIL, hd), proj(HALF, CEIL, hd), proj(HALF, water, hd), proj(-HALF, water, hd)], shade([22, 20, 18], hd));
        for (let z = 0; z <= startZ; z++) seg(z, cam.z - (z + 1), cam.z - z + 0.0);
      } else {
        for (let z = Math.min(doorZ - 1, startZ + 20); z >= startZ; z--) seg(z, z - cam.z, z - cam.z + 1);
      }
      // far door
      const dd = doorZ - cam.z;
      if (!back && dd < 22) {
        quad([proj(-HALF, CEIL, dd), proj(HALF, CEIL, dd), proj(HALF, water, dd), proj(-HALF, water, dd)], shade([26, 24, 20], dd));
        const pulse = 0.6 + 0.4 * Math.sin(t * 4);
        const [x0, y0] = proj(-0.5, 0.45, dd), [x1, y1] = proj(0.5, water, dd);
        g.strokeStyle = shade([240, 160, 50], dd * 0.5, pulse); g.lineWidth = 1; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
        const [lx, ly] = proj(0, 0.1, dd); g.fillStyle = shade([255, 60, 30], dd * 0.4, pulse); g.fillRect(lx - 1, ly - 1, 3, 3);
      }
      if (blink > 0) { blink -= dt; g.fillStyle = `rgba(0,0,0,${Math.min(1, blink * 6)})`; g.fillRect(0, 0, W, H); }
      g.fillStyle = "rgba(0,0,0,0.25)"; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    canvas.dataset.sceneReady = "1";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", move); canvas.removeEventListener("click", click);
      window.removeEventListener("mousedown", mdown); window.removeEventListener("mouseup", mup); window.removeEventListener("contextmenu", ctx);
      document.exitPointerLock?.();
    };
  }, []);

  return <div className="pg-root">
    <canvas ref={canvasRef} width={W} height={H} className="sg-canvas" aria-label="Submerged corridor" />
    <div className="pg-status">T-77 · SECTOR UNLISTED<br />RELAY 01 / SIGNAL DEGRADING</div>
    <div className="sg-hint">W/S move · double-W sprint · A/D sidestep · click to look · hold right click — look behind</div>
    {line && <div className="pg-panel"><div className="pg-speaker">T-77 / INTERNAL</div><div className="pg-narration pg-line">{line}</div></div>}
    {atDoor && <Button className="pg-btn pg-start" onClick={exit}>E · Open bulkhead</Button>}
  </div>;
}
