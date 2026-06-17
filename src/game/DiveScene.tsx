import { useEffect, useRef } from "react";
import { clang } from "./audio";

// Top-down pixel dive. Player walks through a flooded sector, reaches the Husk,
// then onReach() fires.
type Props = { onReach: () => void };

const W = 320;
const H = 180;

export default function DiveScene({ onReach }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reachedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // World: a 640x360 silt floor with rusted debris and a Husk at the far end.
    const worldW = 720;
    const worldH = 360;
    const husk = { x: worldW - 60, y: worldH / 2 };
    const player = { x: 40, y: worldH / 2, vx: 0, vy: 0, facing: 1, step: 0, frame: 0 };

    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    // Procedural debris: stable PRNG
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    const debris: { x: number; y: number; r: number; c: string }[] = [];
    for (let i = 0; i < 80; i++) {
      debris.push({
        x: rnd() * worldW,
        y: rnd() * worldH,
        r: 2 + rnd() * 5,
        c: rnd() > 0.5 ? "#3a1f12" : "#2a1410",
      });
    }
    // Bio-meat pulses
    const meat: { x: number; y: number; r: number; phase: number }[] = [];
    for (let i = 0; i < 18; i++) {
      meat.push({ x: rnd() * worldW, y: rnd() * worldH, r: 6 + rnd() * 10, phase: rnd() * Math.PI * 2 });
    }

    let raf = 0;
    let last = performance.now();
    let stepTimer = 0;
    let time = 0;

    function update(dt: number) {
      time += dt;
      let mx = 0;
      let my = 0;
      if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
      if (keys.has("arrowright") || keys.has("d")) mx += 1;
      if (keys.has("arrowup") || keys.has("w")) my -= 1;
      if (keys.has("arrowdown") || keys.has("s")) my += 1;
      const len = Math.hypot(mx, my) || 1;
      const speed = 38; // pixels/sec — heavy
      player.x += (mx / len) * speed * dt;
      player.y += (my / len) * speed * dt;
      player.x = Math.max(8, Math.min(worldW - 8, player.x));
      player.y = Math.max(20, Math.min(worldH - 8, player.y));
      if (mx !== 0) player.facing = mx > 0 ? 1 : -1;
      const moving = mx !== 0 || my !== 0;
      if (moving) {
        stepTimer += dt;
        if (stepTimer > 0.55) {
          stepTimer = 0;
          player.step = (player.step + 1) % 2;
          clang(player.step === 0 ? "step" : "hydraulic");
        }
      } else {
        stepTimer = 0.5;
      }

      const d = Math.hypot(player.x - husk.x, player.y - husk.y);
      if (d < 22 && !reachedRef.current) {
        reachedRef.current = true;
        onReach();
      }
    }

    function render() {
      if (!ctx) return;
      // Camera follows player, clamped
      const camX = Math.max(0, Math.min(worldW - W, player.x - W / 2));
      const camY = Math.max(0, Math.min(worldH - H, player.y - H / 2));

      // Background: bruised teal/purple gradient + silt
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a0610");
      g.addColorStop(1, "#180a14");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Bio-meat pulses
      for (const m of meat) {
        const sx = Math.floor(m.x - camX);
        const sy = Math.floor(m.y - camY);
        if (sx < -20 || sx > W + 20) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.4 + m.phase);
        ctx.fillStyle = `rgba(120, 20, 40, ${0.25 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(sx, sy, m.r + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Debris
      for (const d of debris) {
        const sx = Math.floor(d.x - camX);
        const sy = Math.floor(d.y - camY);
        if (sx < -10 || sx > W + 10) continue;
        ctx.fillStyle = d.c;
        ctx.fillRect(sx, sy, d.r, Math.max(1, d.r * 0.4));
      }

      // Husk: torn suit drifting
      const hx = Math.floor(husk.x - camX);
      const hy = Math.floor(husk.y - camY);
      const bob = Math.sin(time * 0.6) * 1.5;
      ctx.fillStyle = "#1a1418";
      ctx.fillRect(hx - 5, hy - 8 + bob, 10, 14); // torso
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(hx - 7, hy - 4 + bob, 3, 8); // limp arm
      ctx.fillStyle = "#5a1020";
      ctx.fillRect(hx - 3, hy - 11 + bob, 6, 5); // shattered helmet
      ctx.fillStyle = "#9a3040";
      ctx.fillRect(hx - 2, hy - 10 + bob, 4, 2); // blood/meat

      // Player: Tamara — thin, beanie, helmet, chrome eyes, peg leg
      const px = Math.floor(player.x - camX);
      const py = Math.floor(player.y - camY);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(px, py + 6, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // legs (one peg)
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(px - 3, py + 2, 2, 5);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(px + 1, py + 2, 2, 5);
      if (player.step === 1) {
        ctx.fillStyle = "#555";
        ctx.fillRect(px + 1, py + 7, 2, 1);
      }
      // torso (dark suit)
      ctx.fillStyle = "#241820";
      ctx.fillRect(px - 4, py - 4, 8, 7);
      // helmet (rust)
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(px - 4, py - 9, 8, 5);
      // beanie
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(px - 4, py - 10, 8, 2);
      // chrome eyes
      ctx.fillStyle = "#e8f0ff";
      ctx.fillRect(px - 2 + (player.facing > 0 ? 0 : 0), py - 7, 1, 1);
      ctx.fillRect(px + 1, py - 7, 1, 1);
      // ruptured red rim
      ctx.fillStyle = "#7a0010";
      ctx.fillRect(px - 2, py - 6, 1, 1);
      ctx.fillRect(px + 1, py - 6, 1, 1);

      // Light cone from helmet
      const grad = ctx.createRadialGradient(px, py, 4, px, py, 70);
      grad.addColorStop(0, "rgba(255, 230, 180, 0.35)");
      grad.addColorStop(0.5, "rgba(180, 80, 80, 0.15)");
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Vignette darkness
      const vg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 140);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Hint
      if (!reachedRef.current) {
        const d = Math.hypot(player.x - husk.x, player.y - husk.y);
        if (d < 90) {
          ctx.fillStyle = "rgba(220,200,200,0.85)";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("Nešto pluta napred…", W / 2, H - 14);
        }
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
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [onReach]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        width: "min(100vw, calc(100vh * 16 / 9))",
        height: "min(100vh, calc(100vw * 9 / 16))",
        imageRendering: "pixelated",
        display: "block",
        margin: "0 auto",
        background: "#000",
      }}
    />
  );
}
