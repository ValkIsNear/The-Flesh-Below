import { useEffect, useRef } from "react";

// Non-interactive cutscene with a pseudo-3D, early-2000s survival-horror feel:
// a long corridor that fades into mist, perspective floor grid, a tiny tumor
// forms on the ground, sprouts, then chases Tamara into the fog. She just
// barely escapes before we cut to the morgue.
type Props = { onDone: () => void };

const W = 320;
const H = 180;
const HORIZON = 78; // y of the vanishing point
const VPX = W / 2; // x of the vanishing point

// Convert a world position (x in [-1..1] across the corridor, z = depth 0..1+)
// into screen coords with a cheap perspective projection.
function project(x: number, z: number) {
  // depth scale: 0 = at camera (foreground), 1 = far. Beyond 1 = into the mist.
  const persp = 1 / (0.25 + z * 1.6);
  const sy = HORIZON + (H - HORIZON) * persp;
  const sx = VPX + x * (W * 0.55) * persp;
  const scale = persp; // size scale
  return { sx, sy, scale };
}

export default function ChaseCutscene({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // Tamara runs away from camera, deeper into the corridor.
    // z grows from ~0.05 (right in front of us) toward ~0.85 (far, almost in fog).
    const tam = { x: -0.05, z: 0.08, step: 0 };
    // Tumor seeds slightly further in.
    const tumor = { x: 0.05, z: 0.22, size: 0, alive: false };

    let t = 0;
    let raf = 0;
    let last = performance.now();
    const TOTAL = 9.0;

    // Pre-generate mist puff positions so they're stable per-frame.
    const puffs = Array.from({ length: 14 }, (_, i) => ({
      x: (Math.random() * 2 - 1) * 1.1,
      z: 0.15 + Math.random() * 0.9,
      r: 18 + Math.random() * 26,
      drift: Math.random() * Math.PI * 2,
      seed: i,
    }));

    function drawSky() {
      if (!ctx) return;
      // deep murky gradient — PS2 survival horror sky/ceiling
      const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
      g.addColorStop(0, "#0a0608");
      g.addColorStop(0.6, "#160a10");
      g.addColorStop(1, "#2a1418");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, HORIZON);
    }

    function drawFloor() {
      if (!ctx) return;
      // base floor gradient — darker at camera, lighter (foggier) toward horizon
      const g = ctx.createLinearGradient(0, HORIZON, 0, H);
      g.addColorStop(0, "#3a2024");
      g.addColorStop(0.35, "#1a0e12");
      g.addColorStop(1, "#0a0608");
      ctx.fillStyle = g;
      ctx.fillRect(0, HORIZON, W, H - HORIZON);

      // perspective grid lines — the iconic moving floor
      ctx.strokeStyle = "rgba(180, 60, 70, 0.22)";
      ctx.lineWidth = 1;

      // horizontal lines (depth bands), scrolling toward camera so it feels like
      // Tamara is moving (and the world is endless)
      const scroll = (t * 0.35) % 1;
      for (let i = 0; i < 18; i++) {
        const z = ((i + scroll) / 18) * 1.0;
        const p = project(0, z);
        ctx.globalAlpha = Math.max(0, 1 - z) * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, p.sy);
        ctx.lineTo(W, p.sy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // vanishing-point lines (rails)
      for (let i = -5; i <= 5; i++) {
        const x = i * 0.22;
        ctx.strokeStyle = `rgba(180, 70, 80, ${0.18 + (i === 0 ? 0.15 : 0)})`;
        ctx.beginPath();
        ctx.moveTo(VPX, HORIZON);
        const edge = project(x, 0.02);
        ctx.lineTo(edge.sx, H);
        ctx.stroke();
      }
    }

    function drawWalls() {
      if (!ctx) return;
      // left & right walls projected with the same perspective — segmented panels
      const panels = 10;
      for (let i = 0; i < panels; i++) {
        const z0 = (i / panels) * 1.0;
        const z1 = ((i + 1) / panels) * 1.0;
        // left wall
        const l0 = project(-0.95, z0);
        const l1 = project(-0.95, z1);
        const lt0 = { sx: l0.sx, sy: HORIZON - (HORIZON - 12) * (1 / (0.25 + z0 * 1.6)) };
        const lt1 = { sx: l1.sx, sy: HORIZON - (HORIZON - 12) * (1 / (0.25 + z1 * 1.6)) };
        const alpha = Math.max(0, 1 - z0) * 0.85;
        ctx.fillStyle = `rgba(28, 16, 20, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(l0.sx, l0.sy);
        ctx.lineTo(l1.sx, l1.sy);
        ctx.lineTo(lt1.sx, lt1.sy);
        ctx.lineTo(lt0.sx, lt0.sy);
        ctx.closePath();
        ctx.fill();
        // rivet/seam
        ctx.fillStyle = `rgba(120, 30, 40, ${alpha * 0.4})`;
        ctx.fillRect(l1.sx, lt1.sy, 1, l1.sy - lt1.sy);

        // right wall (mirror)
        const r0 = project(0.95, z0);
        const r1 = project(0.95, z1);
        const rt0 = { sx: r0.sx, sy: HORIZON - (HORIZON - 12) * (1 / (0.25 + z0 * 1.6)) };
        const rt1 = { sx: r1.sx, sy: HORIZON - (HORIZON - 12) * (1 / (0.25 + z1 * 1.6)) };
        ctx.fillStyle = `rgba(28, 16, 20, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(r0.sx, r0.sy);
        ctx.lineTo(r1.sx, r1.sy);
        ctx.lineTo(rt1.sx, rt1.sy);
        ctx.lineTo(rt0.sx, rt0.sy);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(120, 30, 40, ${alpha * 0.4})`;
        ctx.fillRect(r1.sx - 1, rt1.sy, 1, r1.sy - rt1.sy);

        // flickering red sconce every few panels
        if (i % 3 === 1) {
          const flick = 0.5 + 0.5 * Math.sin(t * 11 + i) * (Math.random() > 0.92 ? 0 : 1);
          const sc = project(-0.85, z0 + 0.04);
          const cone = ctx.createRadialGradient(sc.sx, sc.sy - 6, 1, sc.sx, sc.sy - 6, 22 * sc.scale + 6);
          cone.addColorStop(0, `rgba(220, 50, 60, ${0.45 * flick * alpha})`);
          cone.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = cone;
          ctx.fillRect(sc.sx - 30, sc.sy - 30, 60, 60);

          const sc2 = project(0.85, z0 + 0.04);
          const cone2 = ctx.createRadialGradient(sc2.sx, sc2.sy - 6, 1, sc2.sx, sc2.sy - 6, 22 * sc2.scale + 6);
          cone2.addColorStop(0, `rgba(220, 50, 60, ${0.45 * flick * alpha})`);
          cone2.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = cone2;
          ctx.fillRect(sc2.sx - 30, sc2.sy - 30, 60, 60);
        }
      }
    }

    function drawTamara() {
      if (!ctx) return;
      const p = project(tam.x, tam.z);
      const s = Math.max(0.3, p.scale * 2.2); // sprite scale
      const x = Math.floor(p.sx);
      const y = Math.floor(p.sy);
      const bob = Math.sin(tam.step) * (1 * s);

      // ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 6 * s, 1.6 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // back view of Tamara running away — silhouette
      // legs
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - 3 * s, y - 6 * s + bob, 2 * s, 6 * s);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(x + 1 * s, y - 6 * s - bob, 2 * s, 6 * s);
      // torso
      ctx.fillStyle = "#1c1018";
      ctx.fillRect(x - 4 * s, y - 13 * s, 8 * s, 8 * s);
      // backpack (more visible since we see her back)
      ctx.fillStyle = "#241218";
      ctx.fillRect(x - 3 * s, y - 12 * s, 6 * s, 6 * s);
      ctx.fillStyle = "rgba(120,30,40,0.5)";
      ctx.fillRect(x - 3 * s, y - 9 * s, 6 * s, 1);
      // helmet (back of head)
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(x - 4 * s, y - 18 * s, 8 * s, 5 * s);
      // tiny rim light on helmet
      ctx.fillStyle = "rgba(220,80,90,0.4)";
      ctx.fillRect(x - 4 * s, y - 18 * s, 8 * s, 1);
    }

    function drawTumor() {
      if (!ctx) return;
      const p = project(tumor.x, tumor.z);
      const s = Math.max(0.25, p.scale * 1.8);
      const sz = tumor.size * s;
      if (sz <= 0.3) return;
      const x = Math.floor(p.sx);
      const y = Math.floor(p.sy);

      // wet pool
      ctx.fillStyle = `rgba(60,8,16,${Math.min(0.6, 0.15 + tumor.size * 0.05)})`;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, sz * 1.6, sz * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // pulsing body
      const pulse = 0.75 + 0.25 * Math.sin(t * 5);
      ctx.fillStyle = "rgba(150, 22, 40, 0.9)";
      ctx.beginPath();
      ctx.arc(x, y - sz * 0.4, sz * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(60, 6, 14, 0.9)";
      ctx.beginPath();
      ctx.arc(x - 1, y - sz * 0.5, sz * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(230, 120, 130, 0.55)";
      ctx.fillRect(x - 1, Math.floor(y - sz * 0.9), 1, 1);

      if (tumor.size > 4) {
        ctx.strokeStyle = "rgba(140, 20, 40, 0.7)";
        ctx.lineWidth = Math.max(1, s);
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + t * 0.6;
          const len = sz * 1.6 + Math.sin(t * 4 + i) * 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y - sz * 0.4);
          ctx.lineTo(x + Math.cos(ang) * len, y - sz * 0.4 + Math.sin(ang) * len * 0.5);
          ctx.stroke();
        }
      }
    }

    function drawMist() {
      if (!ctx) return;
      // dense ground mist near the horizon — what sells "infinite"
      const horizonFog = ctx.createLinearGradient(0, HORIZON - 6, 0, HORIZON + 50);
      horizonFog.addColorStop(0, "rgba(180, 150, 160, 0.0)");
      horizonFog.addColorStop(0.35, "rgba(170, 140, 150, 0.55)");
      horizonFog.addColorStop(1, "rgba(120, 90, 100, 0.0)");
      ctx.fillStyle = horizonFog;
      ctx.fillRect(0, HORIZON - 6, W, 60);

      // soft drifting puffs across depth
      for (const pf of puffs) {
        const drift = Math.sin(t * 0.3 + pf.drift) * 0.05;
        const p = project(pf.x + drift, pf.z);
        const r = pf.r * (0.4 + p.scale);
        const alpha = Math.max(0, 0.18 + (1 - pf.z) * 0.1);
        const g = ctx.createRadialGradient(p.sx, p.sy - r * 0.3, 1, p.sx, p.sy - r * 0.3, r);
        g.addColorStop(0, `rgba(190, 160, 170, ${alpha})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.sx - r, p.sy - r * 1.3, r * 2, r * 2);
      }

      // overall haze veil to lift blacks like an old DVD transfer
      ctx.fillStyle = "rgba(120, 80, 90, 0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    function drawScanlinesAndVignette() {
      if (!ctx) return;
      // PS2-era scanlines
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);

      // chromatic-ish red edge bleed (subtle)
      const edge = ctx.createLinearGradient(0, 0, W, 0);
      edge.addColorStop(0, "rgba(160, 30, 40, 0.10)");
      edge.addColorStop(0.5, "rgba(0,0,0,0)");
      edge.addColorStop(1, "rgba(40, 20, 80, 0.10)");
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, W, H);

      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 180);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    function update(dt: number) {
      t += dt;

      // tumor lifecycle
      if (t < 1.6) tumor.size = (t / 1.6) * 5.5;
      else if (t < 2.2) tumor.size = 5.5 + ((t - 1.6) / 0.6) * 3;
      else tumor.size = 8.5 + Math.sin(t * 4) * 0.6;

      // Tamara starts running deeper (z increases) — running away from camera
      if (t > 1.9 && tam.z < 0.82) {
        tam.z += 0.085 * dt;
        tam.step += dt * 11;
        // slight side-to-side as she runs
        tam.x = -0.05 + Math.sin(t * 4) * 0.04;
      }

      // tumor pursues — slightly slower so it never catches her
      if (t > 2.2) {
        tumor.alive = true;
        tumor.z += 0.072 * dt;
      }

      if (t > TOTAL && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }

    function render() {
      if (!ctx) return;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      drawSky();
      drawFloor();
      drawWalls();

      // draw entities in depth order (further first)
      const entities: Array<{ z: number; draw: () => void }> = [
        { z: tam.z, draw: drawTamara },
        { z: tumor.z, draw: drawTumor },
      ];
      entities.sort((a, b) => b.z - a.z);
      for (const e of entities) e.draw();

      drawMist();
      drawScanlinesAndVignette();

      // end fade to black
      if (t > 8.2) {
        const a = Math.min(1, (t - 8.2) / 0.8);
        ctx.fillStyle = `rgba(0,0,0,${a})`;
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
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          width: "min(100vw, calc(100vh * 16 / 9))",
          height: "min(100vh, calc(100vw * 9 / 16))",
          imageRendering: "pixelated",
          display: "block",
          background: "#000",
        }}
      />
    </div>
  );
}
