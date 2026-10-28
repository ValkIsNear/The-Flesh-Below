import { useEffect, useRef, useState } from "react";
import { clang, heartbeat } from "./audio";

// Non-interactive scene: the same flooded first-person tunnel as the dive,
// but here Tamara walks up to a growth on the wall that is clearly still
// alive — it answers her light — and she decides to back out for her own good.
type Props = { onDone: () => void };

const W = 320;
const H = 180;
const F = 150; // focal length
const CX = W / 2;
const CY = H / 2;

type Beat = { at: number; sr: string; en: string };
const BEATS: Beat[] = [
  { at: 1.2, sr: "Ovaj hodnik nije na mapi.", en: "This corridor isn't on the map." },
  { at: 5.0, sr: "Nešto raste na zidu.", en: "Something is growing on the wall." },
  { at: 8.4, sr: "Diše. Još je aktivno.", en: "It breathes. It's still active." },
  { at: 11.6, sr: "Nazad. Odmah nazad.", en: "Back. Back away, now." },
];

export default function ChaseCutscene({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  const [beat, setBeat] = useState<Beat | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const TOTAL = 15.0;
    // growths along the tunnel; the player must shoot each eye
    type Tgt = { x: number; y: number; z: number; hits: number; deadAt: number };
    const targets: Tgt[] = [
      { x: 1.35, y: -0.15, z: 15.5, hits: 0, deadAt: -1 },
      { x: -1.35, y: 0.1, z: 25.5, hits: 0, deadAt: -1 },
      { x: 1.3, y: 0.45, z: 35.5, hits: 0, deadAt: -1 },
    ];
    let cur = 0;
    let t = 0;
    let camZ = 0;
    let raf = 0;
    let last = performance.now();
    let shownBeat = -1;

    // floating debris/particles in the flooded water
    const motes = Array.from({ length: 90 }, () => ({
      x: (Math.random() * 2 - 1) * 2.2,
      y: (Math.random() * 2 - 1) * 1.6,
      z: Math.random() * 26,
      ph: Math.random() * Math.PI * 2,
    }));

    // view offset: while aiming, the world pans so the crosshair stays centered
    let offX = 0;
    let offY = 0;
    function proj(x: number, y: number, z: number) {
      const d = Math.max(0.05, z);
      return { sx: CX + offX + (x / d) * F, sy: CY + offY - (y / d) * F, s: F / d };
    }

    function fog(z: number) {
      // how much the mist has eaten this depth (0 = clear, 1 = gone)
      return Math.min(1, Math.max(0, (z - 1.2) / 9.5));
    }

    function shade(base: [number, number, number], z: number, a = 1) {
      const f = 1 - fog(z);
      const lamp = Math.min(1, 2.2 / (1 + z * z * 0.18));
      const k = f * (0.18 + lamp * 0.9);
      return `rgba(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)},${a})`;
    }

    function drawCorridor(sway: number) {
      if (!ctx) return;
      const HW = 1.7; // half width
      const HH = 1.25; // half height
      const SLICE = 0.55;
      // far -> near so nearer slices overdraw
      for (let i = 40; i >= 0; i--) {
        const z = i * SLICE + 0.3 - (camZ % SLICE);
        if (z <= 0.2) continue;
        const a = proj(-HW + sway, HH, z);
        const b = proj(HW + sway, -HH, z);
        const wpx = b.sx - a.sx;
        const hpx = b.sy - a.sy;
        const worldZ = camZ + z;
        const band = Math.floor(worldZ / SLICE);
        // wall ring
        ctx.strokeStyle = shade(band % 2 === 0 ? [86, 74, 70] : [58, 50, 50], z, 0.9);
        ctx.lineWidth = 1;
        ctx.strokeRect(a.sx, a.sy, wpx, hpx);
        // ribbed frames every few slices
        if (band % 4 === 0) {
          ctx.strokeStyle = shade([120, 96, 82], z, 0.85);
          ctx.lineWidth = Math.max(1, 3 / z);
          ctx.strokeRect(a.sx, a.sy, wpx, hpx);
        }
        // waterline shimmer across the floor
        const wl = proj(0, -HH + 0.06 + Math.sin(worldZ * 1.3 + t * 1.4) * 0.02, z);
        ctx.fillStyle = shade([70, 90, 92], z, 0.35);
        ctx.fillRect(a.sx, wl.sy, wpx, Math.max(1, 1.5 / z));
        // ceiling conduit
        const cd = proj(0.5, HH - 0.12, z);
        ctx.fillStyle = shade([48, 42, 40], z, 0.9);
        ctx.fillRect(cd.sx - 3 / z, cd.sy, 6 / z + 1, Math.max(1, 2 / z));
      }
    }

    function drawInfection(sway: number, tg: Tgt) {
      if (!ctx) return;
      const z = tg.z - camZ;
      if (z <= 0.35) return;
      const vis = 1 - fog(z);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const alive = z < 5.5 ? 1 : 0;
      const seed = tg.z * 7.13;
      const c = proj(tg.x + sway, tg.y, z);
      const rp = ((0.6 + pulse * 0.05) / Math.max(0.05, z)) * F;
      const side = tg.x > 0 ? 1 : -1; // grows out of the wall toward the corridor

      // tar stain soaking into the plating
      const g = ctx.createRadialGradient(c.sx, c.sy, 1, c.sx, c.sy, rp * 2.4);
      g.addColorStop(0, `rgba(10,4,10,${0.9 * vis})`);
      g.addColorStop(0.6, `rgba(30,8,22,${0.4 * vis})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(c.sx - rp * 2.5, c.sy - rp * 2.5, rp * 5, rp * 5);

      // thick trunk sliding down the wall into the water, like a tar worm
      ctx.strokeStyle = `rgba(6,3,7,${0.95 * vis})`;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1, rp * 0.45);
      ctx.beginPath();
      ctx.moveTo(c.sx, c.sy);
      ctx.bezierCurveTo(
        c.sx + side * rp * 0.6, c.sy + rp * 0.9,
        c.sx - side * rp * 0.5 + Math.sin(t * 0.8 + seed) * rp * 0.1, c.sy + rp * 1.5,
        c.sx + side * rp * 0.2, c.sy + rp * 2.6,
      );
      ctx.stroke();

      // glossy lobed body, black with a purple sheen
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2 + Math.sin(t * 0.6 + i + seed) * 0.25;
        const lr = rp * (0.32 + 0.14 * Math.sin(t * 1.8 + i * 1.9 + seed));
        const lx = c.sx + Math.cos(ang) * rp * 0.45;
        const ly = c.sy + Math.sin(ang) * rp * 0.4;
        ctx.fillStyle = `rgba(${14 + (i % 3) * 6},6,${18 + (i % 2) * 10},${0.97 * vis})`;
        ctx.beginPath();
        ctx.arc(lx, ly, Math.max(1, lr), 0, Math.PI * 2);
        ctx.fill();
        // wet highlight
        ctx.fillStyle = `rgba(150,110,170,${0.22 * vis})`;
        ctx.fillRect(lx - lr * 0.4, ly - lr * 0.6, Math.max(1, lr * 0.35), Math.max(1, lr * 0.12));
      }

      // long clawed limbs reaching off the wall, curling and grasping
      for (let i = 0; i < 7; i++) {
        const base = (i / 7) * Math.PI * 2 + seed;
        const reach = rp * (1.1 + 0.4 * Math.sin(i * 3.1 + seed));
        let px = c.sx + Math.cos(base) * rp * 0.4;
        let py = c.sy + Math.sin(base) * rp * 0.35;
        let ang = base;
        let w = Math.max(1, rp * 0.16);
        for (let k = 0; k < 5; k++) {
          ang += (0.35 + Math.sin(t * (0.9 + alive * 1.4) + i * 1.7 + k) * 0.25) * (i % 2 ? 1 : -1);
          const nx = px + Math.cos(ang) * reach * 0.22;
          const ny = py + Math.sin(ang) * reach * 0.22;
          ctx.strokeStyle = `rgba(8,4,9,${0.95 * vis})`;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
          px = nx; py = ny;
          w = Math.max(1, w * 0.72);
        }
        // three hooked claws at the tip
        ctx.lineWidth = 1;
        for (let f = -1; f <= 1; f++) {
          const fa = ang + f * 0.55;
          ctx.beginPath();
          ctx.moveTo(px, py);
          const fx = px + Math.cos(fa) * rp * 0.18;
          const fy = py + Math.sin(fa) * rp * 0.18;
          ctx.quadraticCurveTo(fx, fy, fx + Math.cos(fa + 1.2) * rp * 0.08, fy + Math.sin(fa + 1.2) * rp * 0.08);
          ctx.stroke();
        }
      }

      // tar drips hanging in the water
      ctx.fillStyle = `rgba(6,3,7,${0.9 * vis})`;
      for (let i = 0; i < 6; i++) {
        const dx = c.sx + (i - 2.5) * rp * 0.28;
        const len = rp * (0.4 + 0.5 * ((Math.sin(t * 0.7 + i * 2.2 + seed) + 1) / 2));
        ctx.fillRect(dx, c.sy + rp * 0.3, Math.max(1, rp * 0.05), len);
        ctx.beginPath();
        ctx.arc(dx, c.sy + rp * 0.3 + len, Math.max(1, rp * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }

      // raw red flesh rim where the growth meets the main eye
      const throb = 0.5 + 0.5 * Math.sin(t * 3.2 + seed);
      ctx.fillStyle = `rgba(${90 + throb * 50},14,18,${0.85 * vis})`;
      ctx.beginPath();
      ctx.ellipse(c.sx, c.sy, rp * 0.42, rp * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();

      // pulsing veins crawling outward over the tar
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        let vx = c.sx, vy = c.sy;
        let va = (i / 10) * Math.PI * 2 + seed;
        ctx.strokeStyle = `rgba(${120 + throb * 70},20,30,${(0.35 + throb * 0.35) * vis})`;
        ctx.beginPath();
        ctx.moveTo(vx, vy);
        for (let k = 0; k < 4; k++) {
          va += Math.sin(i * 2.7 + k * 1.3 + seed) * 0.6;
          vx += Math.cos(va) * rp * 0.28;
          vy += Math.sin(va) * rp * 0.24;
          ctx.lineTo(vx, vy);
        }
        ctx.stroke();
      }

      // cluster of tiny eyes huddled around the main one, all tracking her
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + seed * 0.7;
        const d = rp * (0.32 + (i % 2) * 0.1);
        const ex = c.sx + Math.cos(a) * d;
        const ey = c.sy + Math.sin(a) * d * 0.85;
        const er = Math.max(1, rp * (0.05 + (i % 3) * 0.015));
        const open = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.1 + i * 0.9 + seed));
        ctx.fillStyle = `rgba(225,190,110,${0.9 * vis})`;
        ctx.beginPath();
        ctx.ellipse(ex, ey, er, er * open, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(0,0,0,${vis})`;
        ctx.fillRect(ex - er * 0.25 + (mx - CX) * 0.003, ey - er * 0.25, Math.max(1, er * 0.5), Math.max(1, er * 0.5));
      }

      // small wet eyes scattered over the mass, opening when it wakes
      for (let i = 0; i < 5; i++) {
        const a = seed * 1.3 + i * 2.4;
        const ex = c.sx + Math.cos(a) * rp * 0.55;
        const ey = c.sy + Math.sin(a) * rp * 0.45;
        const open = Math.max(0, Math.sin(t * 1.3 + i * 1.9)) * (0.3 + alive * 0.7);
        const er = Math.max(1, rp * 0.08);
        ctx.fillStyle = `rgba(210,200,170,${0.85 * vis * open})`;
        ctx.beginPath();
        ctx.ellipse(ex, ey, er, er * open, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(0,0,0,${vis * open})`;
        ctx.fillRect(ex - er * 0.3 + (mx - CX) * 0.004, ey - er * 0.3, Math.max(1, er * 0.6), Math.max(1, er * 0.6));
      }
    }

    // Textured tunnel like the opening dive: solid walls, plank floor, hazard band, crates.
    function drawRunCorridor(sway: number) {
      if (!ctx) return;
      const HW = 1.7, HH = 1.25, SL = 0.6;
      const quad = (pts: { sx: number; sy: number }[], fill: string) => {
        ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0].sx, pts[0].sy);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].sx, pts[k].sy);
        ctx.closePath(); ctx.fill();
      };
      for (let i = 34; i >= 0; i--) {
        const z0 = i * SL + 0.25 - (camZ % SL), z1 = z0 + SL;
        if (z0 <= 0.15) continue;
        const band = Math.floor((camZ + z0) / SL);
        const v = band % 3 === 0 ? 0.82 : band % 2 ? 1 : 0.92;
        const P = (x: number, y: number, z: number) => proj(x + sway, y, z);
        const col = (c: [number, number, number], z: number) => shade([c[0] * v, c[1] * v, c[2] * v], z);
        quad([P(-HW, HH, z0), P(HW, HH, z0), P(HW, HH, z1), P(-HW, HH, z1)], col([70, 48, 46], z0));
        quad([P(-HW, -HH, z0), P(HW, -HH, z0), P(HW, -HH, z1), P(-HW, -HH, z1)], col([96, 66, 54], z0));
        for (const sd of [-1, 1]) {
          const x = sd * HW;
          quad([P(x, HH, z0), P(x, -HH, z0), P(x, -HH, z1), P(x, HH, z1)], col([88, 60, 56], z0));
          // hazard stripe band
          quad([P(x, -0.05, z0), P(x, -0.25, z0), P(x, -0.25, z1), P(x, -0.05, z1)], col(band % 2 ? [150, 110, 30] : [40, 30, 20], z0));
          // rivets
          if (band % 2 === 0) { const r = P(x * 0.98, 0.5, z0 + 0.1); ctx.fillStyle = shade([130, 100, 90], z0); ctx.fillRect(r.sx, r.sy, Math.max(1, 1.5 / z0), Math.max(1, 1.5 / z0)); }
        }
        // plank seams and wall frames
        ctx.strokeStyle = shade([30, 20, 20], z0, 0.8); ctx.lineWidth = 1;
        const a = P(-HW, HH, z0), b = P(HW, -HH, z0);
        if (band % 4 === 0) ctx.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy);
        const fl = P(0, -HH, z0), fr = P(0, -HH, z1);
        ctx.beginPath(); ctx.moveTo(fl.sx, fl.sy); ctx.lineTo(fr.sx, fr.sy); ctx.stroke();
        // crates
        if (band % 9 === 4) {
          const cx = band % 2 ? 1.0 : -1.0, s2 = 0.55;
          const f0 = [P(cx - s2 / 2, -HH + s2, z0), P(cx + s2 / 2, -HH + s2, z0), P(cx + s2 / 2, -HH, z0), P(cx - s2 / 2, -HH, z0)];
          quad([P(cx - s2 / 2, -HH + s2, z0), P(cx + s2 / 2, -HH + s2, z0), P(cx + s2 / 2, -HH + s2, z0 + s2), P(cx - s2 / 2, -HH + s2, z0 + s2)], shade([150, 100, 50], z0));
          quad(f0, shade([170, 112, 52], z0));
          ctx.strokeStyle = shade([90, 55, 25], z0); ctx.lineWidth = Math.max(1, 2 / z0);
          ctx.strokeRect(f0[0].sx, f0[0].sy, f0[1].sx - f0[0].sx, f0[2].sy - f0[0].sy);
        }
      }
    }

    function drawMotes(sway: number) {
      if (!ctx) return;
      for (const m of motes) {
        const z = m.z - (camZ % 26);
        const zz = z <= 0.3 ? z + 26 : z;
        if (zz > 16) continue;
        const p = proj(m.x + sway + Math.sin(t * 0.5 + m.ph) * 0.05, m.y + Math.sin(t * 0.35 + m.ph) * 0.06, zz);
        const a = (1 - fog(zz)) * 0.5;
        if (a <= 0.02) continue;
        ctx.fillStyle = `rgba(180,170,165,${a})`;
        const s = Math.max(1, 1.6 / zz);
        ctx.fillRect(p.sx, p.sy, s, s);
      }
    }

    function drawAtmosphere() {
      if (!ctx) return;
      // helmet lamp pool
      const lamp = ctx.createRadialGradient(CX, CY, 6, CX, CY, H * 0.95);
      lamp.addColorStop(0, "rgba(190,170,150,0.10)");
      lamp.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, W, H);
      // depth mist veil
      ctx.fillStyle = "rgba(14,16,18,0.30)";
      ctx.fillRect(0, 0, W, H);
      // scanlines
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
      // vignette
      const vg = ctx.createRadialGradient(CX, CY, H * 0.28, CX, CY, H * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      // visor frame
      ctx.fillStyle = "rgba(10,6,8,0.85)";
      ctx.fillRect(0, 0, W, 6);
      ctx.fillRect(0, H - 8, W, 8);
      ctx.strokeStyle = "rgba(190,120,110,0.13)";
      ctx.lineWidth = 1;
      ctx.strokeRect(6, 10, W - 12, H - 24);
    }

    // ---- interactive kill: the first time the player fires ----
    let phase: "walk" | "aim" | "dead" | "leave" | "run" = "walk";
    let runDist = 0, runSpeed = 0, sprint = false, wHeld = false, lastW = -9, stepT = 0, chaserT = 0, shake = 0, runFade = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "KeyW") return;
      if (e.type === "keydown") {
        if (!e.repeat) { if (t - lastW < 0.32) sprint = true; lastW = t; }
        wHeld = true;
      } else { wHeld = false; sprint = false; }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    let phaseT = 0;
    let aiming = false;
    let aimK = 0;
    let mx = CX, my = CY;
    let flash = 0;
    let recoil = 0;
    let hitFx = 0;
    const AIM_BEAT: Beat = { at: 0, sr: "Neće me pustiti. Pucaj u oko.", en: "It won't let me go. Shoot the eye." };
    const DEAD_BEATS: Beat[] = [
      { at: 0.4, sr: "Gotovo.", en: "It's done." },
      { at: 2.6, sr: "Ali ih ima još. Nazad.", en: "But there are more. Back away." },
    ];
    const MORE_BEATS: Beat[] = [
      { at: 0, sr: "Još jedno. Na levom zidu.", en: "Another one. On the left wall." },
      { at: 0, sr: "Gore. I ovo me gleda.", en: "Up there. This one is watching too." },
    ];
    const MID_BEATS: Beat[] = [
      { at: 0, sr: "Dalje.", en: "Keep going." },
      { at: 0, sr: "Ima ih sve više.", en: "There are more of them." },
    ];
    let eyeScr = { x: -999, y: -999, r: 0 };

    const toCanvas = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * W;
      my = ((e.clientY - r.top) / r.height) * H;
    };
    const onMove = (e: MouseEvent) => {
      toCanvas(e);
      if (phase === "run") { shake = Math.min(1, shake + Math.abs(e.movementX) * 0.02); return; }
      if (aiming && phase === "aim") {
        const r = canvas.getBoundingClientRect();
        const k = W / r.width;
        offX = Math.max(-140, Math.min(140, offX - e.movementX * k * 0.6));
        offY = Math.max(-80, Math.min(80, offY - e.movementY * k * 0.6));
      }
    };
    const onDown = (e: MouseEvent) => {
      toCanvas(e);
      if (e.button === 2) {
        aiming = true;
        try { canvas.requestPointerLock?.(); } catch { /* ignore */ }
      }
      if (e.button === 0 && phase === "aim") {
        flash = 0.08;
        recoil = 1;
        clang("hydraulic");
        if (Math.hypot(CX - eyeScr.x, CY - eyeScr.y) < eyeScr.r * 1.25) {
          const tg = targets[cur];
          tg.hits++;
          hitFx = 0.4;
          heartbeat();
          if (tg.hits >= 3) {
            tg.deadAt = t;
            phase = "dead"; phaseT = 0; shownBeat = -1; aiming = false;
            if (document.pointerLockElement) document.exitPointerLock();
          }
        }
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 2) {
        aiming = false;
        if (document.pointerLockElement) document.exitPointerLock();
      }
    };
    const onCtx = (e: Event) => e.preventDefault();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("contextmenu", onCtx);

    const deadK = (tg: Tgt) => (tg.deadAt >= 0 ? Math.min(1, (t - tg.deadAt) / 1.5) : 0);

    function drawEye(sway: number, tg: Tgt, isCur: boolean) {
      if (!ctx) return;
      const z = tg.z - camZ;
      if (z <= 0.35) return;
      const c = proj(tg.x + sway, tg.y, z);
      const dk = deadK(tg);
      const hits = tg.hits;
      const rp = ((0.2 * (1 - dk * 0.5)) / z) * F;
      if (isCur) eyeScr = { x: c.sx, y: c.sy, r: rp };
      const blink = 0.8 + 0.2 * Math.sin(t * 3.1);
      const vis = 0.95 * (1 - fog(z));
      const ry = rp * blink * (1 - dk * 0.8);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(c.sx, c.sy, rp, ry, 0, 0, Math.PI * 2);
      ctx.clip();
      // pale fleshy sclera ring
      const sg = ctx.createRadialGradient(c.sx, c.sy, rp * 0.2, c.sx, c.sy, rp);
      sg.addColorStop(0, `rgba(${Math.round(230 - dk * 150)},${Math.round(190 - dk * 150 + hitFx * 40)},120,${vis})`);
      sg.addColorStop(0.55, `rgba(${Math.round(170 - dk * 120)},${Math.round(120 - dk * 90)},90,${vis})`);
      sg.addColorStop(1, `rgba(${Math.round(90 + hitFx * 140)},30,30,${vis})`);
      ctx.fillStyle = sg;
      ctx.fillRect(c.sx - rp, c.sy - rp, rp * 2, rp * 2);
      // radial ridges like teeth around the iris
      ctx.strokeStyle = `rgba(60,30,20,${0.7 * vis})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + Math.sin(t * 0.5) * 0.05;
        ctx.beginPath();
        ctx.moveTo(c.sx + Math.cos(a) * rp * 0.4, c.sy + Math.sin(a) * rp * 0.4);
        ctx.lineTo(c.sx + Math.cos(a) * rp * 0.92, c.sy + Math.sin(a) * rp * 0.92);
        ctx.stroke();
      }
      // yellow iris
      const look = (mx - CX) * 0.01;
      ctx.fillStyle = `rgba(${Math.round(220 - dk * 160)},${Math.round(170 - dk * 140)},60,${vis})`;
      ctx.beginPath();
      ctx.arc(c.sx + look, c.sy, rp * 0.4, 0, Math.PI * 2);
      ctx.fill();
      // dilating black pupil that follows the player
      ctx.fillStyle = "rgba(4,1,2,0.97)";
      ctx.beginPath();
      ctx.arc(c.sx + look, c.sy, rp * (0.14 + 0.06 * Math.sin(t * 2)) * (1 - dk * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // dark lid rim
      ctx.strokeStyle = `rgba(10,4,8,${vis})`;
      ctx.lineWidth = Math.max(1, rp * 0.12);
      ctx.beginPath();
      ctx.ellipse(c.sx, c.sy, rp, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      // wounds
      for (let i = 0; i < hits; i++) {
        ctx.fillStyle = "rgba(20,4,6,0.9)";
        ctx.fillRect(c.sx + Math.cos(i * 2.3) * rp * 0.5 - 1, c.sy + Math.sin(i * 2.3) * rp * 0.4 - 1, 2, 2);
      }
    }

    function drawGun() {
      if (!ctx) return;
      const walking = phase === "walk" || phase === "leave";
      const wp = t * 5.2;
      const sway = (walking ? 1 : 0.25) * (1 - aimK * 0.75);
      const sx = Math.sin(wp * 0.5) * 2 * sway;
      const sy = (Math.abs(Math.cos(wp * 0.5)) * 2 + Math.sin(t * 1.1) * 0.7) * sway + recoil * 4;
      const lerp = (a: number, b: number) => a + (b - a) * aimK;
      ctx.save();
      ctx.translate(lerp(W * 0.68, W * 0.5) + sx, lerp(H * 0.95, H * 1.08) + sy);
      ctx.rotate(lerp(0.42, Math.PI / 2) - recoil * 0.06);
      const sc = lerp(1.05, 1.18);
      ctx.scale(sc, sc);
      const poly = (pts: number[][], fill: string) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
      };
      poly([[-10, 6], [60, -2], [70, 14], [-4, 30]], "#0c120e");
      poly([[-10, 6], [60, -2], [61, 2], [-9, 10]], "#1a241d");
      poly([[14, 22], [26, 20], [30, 44], [18, 46]], "#080c0a");
      poly([[-46, -4], [10, -10], [14, 6], [-44, 10]], "#121a15");
      poly([[-46, -4], [10, -10], [10, -6], [-46, 0]], "#1e2a22");
      for (let k = 0; k < 6; k++) poly([[-40 + k * 8, 1], [-35 + k * 8, 0], [-35 + k * 8, 4], [-40 + k * 8, 5]], "#050806");
      poly([[-58, -3], [-46, -5], [-45, 9], [-57, 7]], "#070a08");
      poly([[-64, -1], [-58, -2], [-57, 6], [-63, 5]], "#141c17");
      for (let k = 0; k < 8; k++) poly([[-34 + k * 7, -11], [-29 + k * 7, -12], [-29 + k * 7, -8], [-34 + k * 7, -7]], "#26322a");
      poly([[-10, -12], [16, -15], [17, -22], [-9, -20]], "#0e1511");
      poly([[-11, -17], [-9, -17], [-9, -14], [-11, -14]], "rgba(110,170,120,0.55)");
      poly([[-40, 3], [6, -1], [6, 1], [-40, 5]], "rgba(90,140,100,0.35)");
      poly([[30, 10], [42, 8], [48, 34], [34, 36]], "#0a0f0c");
      poly([[-30, 6], [-14, 4], [-10, 22], [-22, 40], [-34, 30]], "#1a1614");
      poly([[26, 14], [48, 12], [56, 36], [30, 44]], "#1c1816");
      poly([[30, 44], [56, 36], [70, 70], [36, 80]], "#120e0d");
      if (flash > 0) {
        const g = ctx.createRadialGradient(-66, 2, 0, -66, 2, 22);
        g.addColorStop(0, "rgba(255,220,160,0.95)");
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-90, -22, 48, 48);
      }
      ctx.restore();
      if (aimK > 0.6 && phase === "aim") {
        ctx.strokeStyle = `rgba(220,200,190,${(aimK - 0.6) * 1.6})`;
        ctx.lineWidth = 1;
        const x = CX + 0.5, y = CY + 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 4, y); ctx.lineTo(x + 5, y);
        ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 5);
        ctx.stroke();
      }
    }

    function update(dt: number) {
      t += dt;
      phaseT += dt;
      aimK += ((aiming && phase === "aim" ? 1 : 0) - aimK) * Math.min(1, dt * 12);
      flash = Math.max(0, flash - dt);
      recoil = Math.max(0, recoil - dt * 6);
      hitFx = Math.max(0, hitFx - dt);
      if (!aiming) { const d = Math.min(1, dt * 4); offX -= offX * d; offY -= offY * d; }

      if (phase === "walk") {
        camZ += 1.35 * dt;
        if (camZ >= targets[cur].z - 3.9) { phase = "aim"; phaseT = 0; setBeat(cur === 0 ? AIM_BEAT : MORE_BEATS[cur - 1]); }
        let idx = -1;
        for (let i = 0; i < BEATS.length - 1; i++) if (t >= BEATS[i].at) idx = i;
        if (cur === 0 && idx !== shownBeat && phase === "walk") {
          shownBeat = idx;
          setBeat(idx >= 0 ? BEATS[idx] : null);
        }
      } else if (phase === "dead" && cur < targets.length - 1) {
        if (phaseT > 0.4 && shownBeat !== 99) { shownBeat = 99; setBeat(MID_BEATS[cur]); }
        if (phaseT > 2.4) { cur++; phase = "walk"; phaseT = 0; setBeat(null); }
      } else if (phase === "dead") {
        let idx = -1;
        for (let i = 0; i < DEAD_BEATS.length; i++) if (phaseT >= DEAD_BEATS[i].at) idx = i;
        if (idx !== shownBeat) { shownBeat = idx; setBeat(idx >= 0 ? DEAD_BEATS[idx] : null); }
        if (phaseT > 4.2) { phase = "leave"; phaseT = 0; }
      } else if (phase === "leave") {
        camZ -= 1.9 * dt;
        if (phaseT > 2.2) {
          phase = "run"; phaseT = 0; camZ = 200; aiming = false;
          setBeat({ at: 0, sr: "Ne gledaj nazad. Beži.", en: "Don't look back. Run." });
        }
      } else if (phase === "run") {
        const want = wHeld ? (sprint ? 3.4 : 1.4) : 0;
        runSpeed += (want - runSpeed) * Math.min(1, dt * 5);
        camZ += runSpeed * dt; runDist += runSpeed * dt;
        shake = Math.max(0, shake - dt * 1.5);
        offX = Math.sin(t * 40) * shake * 6; offY = Math.cos(t * 33) * shake * 3;
        if (runSpeed > 0.3) { stepT -= dt * runSpeed; if (stepT <= 0) { stepT = 0.9; clang("step"); } }
        // something wet and heavy is running behind her
        chaserT -= dt;
        if (chaserT <= 0) { chaserT = sprint ? 0.42 : 0.3; clang("hydraulic"); if (Math.random() < 0.3) heartbeat(); }
        if (phaseT > 3 && phaseT < 3.2) setBeat(null);
        if (runDist > 32) {
          runFade += dt / 1.4;
          if (runFade >= 1 && !doneRef.current) { doneRef.current = true; onDone(); }
        }
      }
    }

    function render() {
      if (!ctx) return;
      const walking = phase === "walk" || phase === "leave" || (phase === "run" && runSpeed > 0.3);
      const sway = (phase === "run" ? Math.sin(t * (sprint ? 11 : 6)) * runSpeed * 0.03 : 0) + Math.sin(t * (walking ? 5.2 : 1.1)) * (walking ? 0.045 : 0.02) * (1 - aimK * 0.8);
      ctx.fillStyle = "#040507";
      ctx.fillRect(0, 0, W, H);
      if (phase === "run") drawRunCorridor(sway); else drawCorridor(sway);
      for (let i = targets.length - 1; i >= 0 && phase !== "run"; i--) {
        const tg = targets[i];
        ctx.save();
        ctx.globalAlpha = 1 - deadK(tg) * 0.55;
        drawInfection(sway, tg);
        ctx.restore();
        drawEye(sway, tg, i === cur);
      }
      drawMotes(sway);
      drawAtmosphere();
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,200,150,${flash * 2})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (phase === "run") {
        ctx.fillStyle = `rgba(90,0,0,${0.14 + Math.sin(t * 3) * 0.04})`;
        ctx.fillRect(0, 0, W, H);
      }
      drawGun();
      if (phase === "run" && runDist < 32) {
        ctx.textAlign = "center";
        ctx.font = "bold 9px monospace";
        ctx.fillStyle = `rgba(255,70,60,${0.6 + Math.sin(t * 9) * 0.4})`;
        ctx.fillText("HITNO BEŽI ODAVDE!", CX, 20);
        ctx.font = "6px monospace";
        ctx.fillStyle = "rgba(230,200,190,0.75)";
        ctx.fillText("[ W W ] dvaput pritisni W za trčanje", CX, 30);
      }
      if (runFade > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, runFade)})`; ctx.fillRect(0, 0, W, H); }
      if (phase === "aim") {
        ctx.fillStyle = "rgba(220,200,190,0.55)";
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillText("[ desni klik ] nišani  ·  [ levi klik ] pucaj", CX, 18);
      }
      if (t < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - t})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (phase === "leave" && phaseT > 1.2) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (phaseT - 1.2) / 0.8)})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (phase === "run" && phaseT < 0.6) { ctx.fillStyle = `rgba(0,0,0,${1 - phaseT / 0.6})`; ctx.fillRect(0, 0, W, H); }
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      render();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [onDone]);

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: "min(100vw, calc(100vh * 16 / 9))" }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          style={{
            width: "100%",
            height: "min(100vh, calc(100vw * 9 / 16))",
            imageRendering: "pixelated",
            display: "block",
            background: "#000",
          }}
        />
        {beat && (
          <div
            style={{
              position: "absolute",
              right: "4%",
              bottom: "12%",
              width: "38%",
              padding: "10px 12px",
              background: "rgba(6,6,8,0.82)",
              border: "1px solid rgba(190,120,110,0.28)",
              color: "#e6dcd6",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              lineHeight: 1.45,
              transition: "opacity 1.2s ease",
            }}
          >
            <div style={{ color: "#e8c9a0" }}>{beat.sr}</div>
            <div style={{ opacity: 0.62, fontSize: "0.75rem", marginTop: 4 }}>{beat.en}</div>
          </div>
        )}
      </div>
    </div>
  );
}
