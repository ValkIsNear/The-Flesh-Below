import { useEffect, useRef, useState } from "react";

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
    const INF_Z = 15.5; // world depth of the infection
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

    function proj(x: number, y: number, z: number) {
      const d = Math.max(0.05, z);
      return { sx: CX + (x / d) * F, sy: CY - (y / d) * F, s: F / d };
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

    function drawInfection(sway: number) {
      if (!ctx) return;
      const z = INF_Z - camZ;
      if (z <= 0.35) return;
      const near = Math.max(0, Math.min(1, (10 - z) / 8)); // 0 far, 1 close
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const alive = t > 7.4 ? 1 : 0; // the moment it answers the lamp
      // mass clinging to the right wall
      const cx0 = 1.35 + sway;
      const cy0 = -0.15;
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

    function update(dt: number) {
      t += dt;
      // approach, stop, then retreat
      if (t < 7.2) camZ += 1.35 * dt; // walking in
      else if (t < 9.6) camZ += 0.12 * dt; // frozen, watching it move
      else camZ -= 1.9 * dt; // backing out, faster than she came

      let idx = -1;
      for (let i = 0; i < BEATS.length; i++) if (t >= BEATS[i].at) idx = i;
      if (idx !== shownBeat) {
        shownBeat = idx;
        setBeat(idx >= 0 ? BEATS[idx] : null);
      }

      if (t > TOTAL && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }

    function render() {
      if (!ctx) return;
      const walking = t < 7.2 || t > 9.6;
      const sway = Math.sin(t * (walking ? 5.2 : 1.1)) * (walking ? 0.045 : 0.02);
      ctx.fillStyle = "#040507";
      ctx.fillRect(0, 0, W, H);
      drawCorridor(sway);
      drawInfection(sway);
      drawMotes(sway);
      drawAtmosphere();
      if (t < 1) {
        ctx.fillStyle = `rgba(0,0,0,${1 - t})`;
        ctx.fillRect(0, 0, W, H);
      }
      if (t > TOTAL - 1.4) {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (t - (TOTAL - 1.4)) / 1.4)})`;
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

    return () => cancelAnimationFrame(raf);
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
