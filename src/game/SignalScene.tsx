import { useEffect, useRef, useState } from "react";
import { createTunnelSurfaces } from "./tunnel-surfaces";
import { drawHeldRifle } from "./held-rifle";
import { Button } from "@/components/ui/button";
import { clang, metalGroan, startDrone, unlockAudio } from "./audio";
import { SIGNAL_DOOR_Z, SIGNAL_MONOLOGUE, canOpenSignalDoor, monologueDue, waterLevel, signalMovement } from "./signal-flow";

const W = 480, H = 270, F = 255;
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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    const surfaces = createTunnelSurfaces(true);
    startDrone(0.9);
    const keys = new Set<string>();
    let lastW = 0, sprint = false;
    const cam = { x: 0, z: 0.5, yaw: 0, bob: 0 };
    let back = false, blink = 0;
    const mdown = (e: MouseEvent) => { if (e.button === 2) { back = true; blink = 0.18; } };
    const mup = (e: MouseEvent) => { if (e.button === 2) { back = false; blink = 0.18; } };
    const ctx = (e: Event) => e.preventDefault();
    const clearInput = () => { keys.clear(); sprint = false; back = false; };
    let played = 0, lineTimer = 0, groanTimer = 3, stepAcc = 0, raf = 0, last = performance.now();
    const down = (e: KeyboardEvent) => {
      unlockAudio();
      if (e.code.startsWith("Arrow")) e.preventDefault();
      if (e.code === "KeyW" && !e.repeat) { const now = performance.now(); sprint = now - lastW < 280; lastW = now; }
      if (e.code === "KeyE") exitRef.current();
      keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.code); if (e.code === "KeyW") sprint = false; };
    const move = (e: MouseEvent) => { if (document.pointerLockElement === canvas) cam.yaw += e.movementX * 0.0022; };
    const click = () => { unlockAudio(); canvas.requestPointerLock?.(); };
    window.addEventListener("blur", clearInput);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move); canvas.addEventListener("click", click);
    window.addEventListener("mousedown", mdown); window.addEventListener("mouseup", mup); window.addEventListener("contextmenu", ctx);

    type Point = readonly [number, number, number];
    const proj = (x: number, y: number, dz: number): Point => {
      const yaw = cam.yaw + (back ? Math.PI : 0);
      const dx = x - cam.x;
      return [dx * Math.cos(yaw) - dz * Math.sin(yaw), y - Math.sin(cam.bob) * 0.03, dx * Math.sin(yaw) + dz * Math.cos(yaw)];
    };
    const screen = (p: Point) => [W / 2 + p[0] / p[2] * F, H / 2 - p[1] / p[2] * F] as const;
    type Vertex = { p: Point; u: number; v: number };
    const clip = (vertices: Vertex[]) => {
      const result: Vertex[] = [];
      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        if (a.p[2] >= 0.06) result.push(a);
        if ((a.p[2] >= 0.06) !== (b.p[2] >= 0.06)) {
          const k = (0.06 - a.p[2]) / (b.p[2] - a.p[2]);
          result.push({ p: [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, 0.06], u: a.u + (b.u - a.u) * k, v: a.v + (b.v - a.v) * k });
        }
      }
      return result;
    };
    const quad = (pts: Point[], fill: string) => {
      const polygon = clip(pts.map(p => ({ p, u: 0, v: 0 })));
      if (polygon.length < 3) return;
      g.beginPath(); polygon.forEach((v, i) => { const p = screen(v.p); if (i === 0) g.moveTo(...p); else g.lineTo(...p); });
      g.closePath(); g.fillStyle = fill; g.fill();
    };
    const shade = (base: [number, number, number], dz: number, flick = 1) => {
      const k = Math.max(0, 1 - dz / 18) * flick;
      return `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
    };

    const textured = (pts: Point[], tex: HTMLCanvasElement, distance: number, light = 1) => {
      const uv = [[0, 0], [64, 0], [64, 64], [0, 64]];
      for (const indices of [[0, 1, 2], [0, 2, 3]]) {
        const polygon = clip(indices.map(i => ({ p: pts[i], u: uv[i][0], v: uv[i][1] })));
        for (let j = 1; j + 1 < polygon.length; j++) {
          const vertices = [polygon[0], polygon[j], polygon[j + 1]];
          const [a, b, c] = vertices.map(v => screen(v.p));
          const [u, v, w] = vertices;
          const du1 = v.u - u.u, dv1 = v.v - u.v, du2 = w.u - u.u, dv2 = w.v - u.v;
          const det = du1 * dv2 - du2 * dv1;
          if (Math.abs(det) < 1e-8) continue;
          const m11 = ((b[0] - a[0]) * dv2 - (c[0] - a[0]) * dv1) / det;
          const m12 = ((b[1] - a[1]) * dv2 - (c[1] - a[1]) * dv1) / det;
          const m21 = ((c[0] - a[0]) * du1 - (b[0] - a[0]) * du2) / det;
          const m22 = ((c[1] - a[1]) * du1 - (b[1] - a[1]) * du2) / det;
          g.save(); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.closePath(); g.clip();
          g.transform(m11, m12, m21, m22, a[0] - m11 * u.u - m21 * u.v, a[1] - m12 * u.u - m22 * u.v);
          g.drawImage(tex, 0, 0); g.restore();
        }
      }
      quad(pts, `rgba(0,0,0,${1 - Math.max(0, 1 - distance / 18) * light})`);
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      const fwd = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
      const side = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      if (keys.has("ArrowLeft")) cam.yaw -= dt;
      if (keys.has("ArrowRight")) cam.yaw += dt;
      const speed = (sprint && fwd > 0 ? SPRINT : WALK) * 0.8; // water drags at the shins
      const movement = signalMovement(cam.yaw, fwd, side * 0.7, speed, dt);
      cam.z = Math.max(0.5, Math.min(SIGNAL_DOOR_Z, cam.z + movement.z));
      cam.x = Math.max(-HALF + 0.25, Math.min(HALF - 0.25, cam.x + movement.x));
      if (fwd || side) { cam.bob += dt * (sprint ? 11 : 7); stepAcc += Math.hypot(movement.x, movement.z); if (stepAcc > 0.9) { stepAcc = 0; clang("step"); } }

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
      const seg = (z: number, a: number, b: number) => {
        const za = a;
        const distance = Math.abs(z + 0.5 - cam.z);
        const flick = (Math.sin(t * 13 + z * 7.3) > -0.85 ? 1 : 0.25) * (0.75 + 0.25 * Math.sin(t * 3 + z));
        const rib = z % 4 === 0;
        // ceiling & walls
        textured([proj(-HALF, CEIL, za), proj(HALF, CEIL, za), proj(HALF, CEIL, b), proj(-HALF, CEIL, b)], surfaces.ceiling, distance, 0.85);
        textured([proj(-HALF, CEIL, za), proj(-HALF, water, za), proj(-HALF, water, b), proj(-HALF, CEIL, b)], surfaces.wall, distance, rib ? 0.85 : 1);
        textured([proj(HALF, CEIL, za), proj(HALF, water, za), proj(HALF, water, b), proj(HALF, CEIL, b)], surfaces.wall, distance, rib ? 0.8 : 0.95);
        // amber emergency strips
        if (z % 2 === 0) {
          const amber = shade([230, 150, 40], distance * 0.7, flick);
          quad([proj(-HALF, -0.32, za), proj(-HALF, -0.38, za), proj(-HALF, -0.38, b - 0.3), proj(-HALF, -0.32, b - 0.3)], amber);
          quad([proj(HALF, -0.32, za), proj(HALF, -0.38, za), proj(HALF, -0.38, b - 0.3), proj(HALF, -0.32, b - 0.3)], amber);
        }
        // dark water
        quad([proj(-HALF, water, za), proj(HALF, water, za), proj(HALF, water, b), proj(-HALF, water, b)], shade([10, 22, 26], distance * 0.8));
        const ripple = Math.sin(t * 2 + z * 1.7) * 0.5;
        const r1 = proj(-HALF * 0.8 + ripple * 0.4, water, za + 0.5), r2 = proj(HALF * 0.6 + ripple * 0.3, water, za + 0.5);
        if (r1[2] > 0.06 && r2[2] > 0.06) {
          const [r1x, r1y] = screen(r1), [r2x] = screen(r2);
          g.fillStyle = shade([80, 70, 40], distance, flick * 0.6); g.fillRect(Math.min(r1x, r2x), r1y, Math.abs(r2x - r1x) * 0.3, 1);
        }
      };
      // Both end walls and every segment share the same unrestricted camera transform.
      for (const z of [-0.3, doorZ]) {
        const d = z - cam.z;
        textured([proj(-HALF, CEIL, d), proj(HALF, CEIL, d), proj(HALF, water, d), proj(-HALF, water, d)], surfaces.wall, Math.abs(d), 0.75);
      }
      const segments = Array.from({ length: Math.ceil(doorZ) }, (_, z) => z)
        .sort((a, b) => Math.abs(b + 0.5 - cam.z) - Math.abs(a + 0.5 - cam.z));
      for (const z of segments) seg(z, z - cam.z, z - cam.z + 1);
      const dd = doorZ - cam.z;
      const pulse = 0.6 + 0.4 * Math.sin(t * 4);
      // Door outline stays in world space when looking sideways or behind.
      for (const x of [-0.5, 0.5]) quad([proj(x - 0.008, 0.45, dd - 0.01), proj(x + 0.008, 0.45, dd - 0.01), proj(x + 0.008, water, dd - 0.01), proj(x - 0.008, water, dd - 0.01)], shade([240, 160, 50], Math.abs(dd) * 0.5, pulse));
      quad([proj(-0.5, 0.45, dd - 0.01), proj(0.5, 0.45, dd - 0.01), proj(0.5, 0.43, dd - 0.01), proj(-0.5, 0.43, dd - 0.01)], shade([240, 160, 50], Math.abs(dd) * 0.5, pulse));
      quad([proj(-0.015, 0.12, dd - 0.02), proj(0.015, 0.12, dd - 0.02), proj(0.015, 0.09, dd - 0.02), proj(-0.015, 0.09, dd - 0.02)], shade([255, 60, 30], Math.abs(dd) * 0.4, pulse));
      drawHeldRifle(g, W, H, cam.bob, t);
      if (blink > 0) { blink -= dt; g.fillStyle = `rgba(0,0,0,${Math.min(1, blink * 6)})`; g.fillRect(0, 0, W, H); }
      g.fillStyle = "rgba(0,0,0,0.25)"; for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    canvas.dataset.sceneReady = "1";
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("blur", clearInput);
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
