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
      const near = Math.max(0, Math.min(1, (10 - z) / 8)); // 0 far, 1 close
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const alive = z < 5.5 ? 1 : 0; // the moment it answers the lamp
      // mass clinging to the right wall
      const cx0 = tg.x + sway;
      const cy0 = tg.y;
      const R = 0.62 + pulse * 0.05 + alive * 0.05;

      const c = proj(cx0, cy0, z);
      const rp = (R / Math.max(0.05, z)) * F;

      // wet halo on the wall
      const g = ctx.createRadialGradient(c.sx, c.sy, 1, c.sx, c.sy, rp * 2.1);
      g.addColorStop(0, `rgba(70,10,18,${0.5 * (1 - fog(z))})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(c.sx - rp * 2.2, c.sy - rp * 2.2, rp * 4.4, rp * 4.4);

      // lobed body
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + Math.sin(t * 0.7 + i) * 0.2;
        const lr = rp * (0.42 + 0.22 * Math.sin(t * 2.1 + i * 1.7));
        const lx = c.sx + Math.cos(ang) * rp * 0.5;
        const ly = c.sy + Math.sin(ang) * rp * 0.5;
        ctx.fillStyle = shade([132, 26, 40], z, 0.95);
        ctx.beginPath();
        ctx.arc(lx, ly, Math.max(1, lr), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = shade([48, 8, 14], z, 0.95);
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, Math.max(1, rp * 0.55), 0, Math.PI * 2);
      ctx.fill();

      // black tendrils crawling out over the plating
      ctx.strokeStyle = `rgba(6,4,6,${0.85 * (1 - fog(z))})`;
      ctx.lineWidth = Math.max(1, rp * 0.09);
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        let px = c.sx;
        let py = c.sy;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (let k = 1; k <= 4; k++) {
          const wob = Math.sin(t * (1.4 + alive * 1.6) + i * 2 + k) * rp * 0.16 * (1 + alive);
          px += Math.cos(ang) * rp * 0.42 + wob * 0.4;
          py += Math.sin(ang) * rp * 0.42 + wob;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        // sparse yellow node, brighter once it wakes
        if (i % 3 === 0) {
          const glow = (0.25 + 0.75 * pulse) * (0.3 + near) * (0.4 + alive * 0.6);
          ctx.fillStyle = `rgba(214,190,80,${Math.min(0.95, glow)})`;
          const nr = Math.max(1, rp * 0.07);
          ctx.fillRect(px - nr, py - nr, nr * 2, nr * 2);
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
    let phase: "walk" | "aim" | "dead" | "leave" = "walk";
    let phaseT = 0;
    let aiming = false;
    let aimK = 0;
    let mx = CX, my = CY;
    let hits = 0;
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
      const blink = 0.75 + 0.25 * Math.sin(t * 3.1);
      ctx.fillStyle = `rgba(${Math.round(200 * (1 - dk) + 40 * dk)},${Math.round(20 + hitFx * 120)},28,${0.95 * (1 - fog(z))})`;
      ctx.beginPath();
      ctx.ellipse(c.sx, c.sy, rp, rp * blink * (1 - dk * 0.8), 0, 0, Math.PI * 2);
      ctx.fill();
      // iris ring + slit pupil that follows the player
      ctx.strokeStyle = `rgba(255,120,110,${0.6 * (1 - dk)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.sx, c.sy, rp * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(8,2,4,0.95)";
      ctx.fillRect(c.sx - rp * 0.08 + (mx - CX) * 0.01, c.sy - rp * 0.5, Math.max(1, rp * 0.16), rp);
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
        if (phaseT > 3 && !doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }
    }

    function render() {
      if (!ctx) return;
      const walking = phase === "walk" || phase === "leave";
      const sway = Math.sin(t * (walking ? 5.2 : 1.1)) * (walking ? 0.045 : 0.02) * (1 - aimK * 0.8);
      ctx.fillStyle = "#040507";
      ctx.fillRect(0, 0, W, H);
      drawCorridor(sway);
      for (let i = targets.length - 1; i >= 0; i--) {
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
      drawGun();
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
      if (phase === "leave" && phaseT > 1.6) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (phaseT - 1.6) / 1.4)})`;
        ctx.fillRect(0, 0, W, H);
      }
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
