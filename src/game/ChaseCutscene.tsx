import { useEffect, useRef } from "react";

// Non-interactive cutscene: a small tumor forms on the floor, sprouts,
// then chases Tamara across the room. It nearly catches her before she
// reaches the far door. Then we cut to the morgue.
type Props = { onDone: () => void };

const W = 320;
const H = 180;

export default function ChaseCutscene({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const floorY = 130;
    // Tamara stands on the left, then runs right.
    const tam = { x: 70, y: floorY, step: 0 };
    // Tumor begins as a tiny seed in the middle of the floor.
    const tumor = { x: 150, y: floorY + 2, size: 0, vx: 0, alive: false };

    let t = 0;
    let raf = 0;
    let last = performance.now();

    // Timeline (seconds):
    //  0.0 - 1.6  tumor forms (grows from 0 -> ~6)
    //  1.6 - 2.2  tumor sprouts/lurches, tendrils erupt
    //  2.2 - 7.0  chase: tumor pursues Tamara, just slightly slower
    //  7.0 - 7.6  Tamara reaches far side (door), tumor stops just short
    //  7.6 - 8.4  fade to black
    //  8.4        onDone

    const TOTAL = 8.4;

    function drawRoom() {
      if (!ctx) return;
      // bg
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a0509");
      g.addColorStop(1, "#04020410".slice(0, 7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // back wall
      ctx.fillStyle = "#120a10";
      ctx.fillRect(0, 40, W, floorY - 40);
      // panel seams
      ctx.fillStyle = "#06030608";
      for (let x = 0; x < W; x += 24) {
        ctx.fillStyle = "#05030580";
        ctx.fillRect(x, 40, 1, floorY - 40);
      }
      // floor
      const fg = ctx.createLinearGradient(0, floorY, 0, H);
      fg.addColorStop(0, "#180c10");
      fg.addColorStop(1, "#08040608".slice(0, 7));
      ctx.fillStyle = fg;
      ctx.fillRect(0, floorY, W, H - floorY);
      // tile lines
      for (let x = 0; x < W; x += 16) {
        ctx.fillStyle = "rgba(50,25,28,0.6)";
        ctx.fillRect(x, floorY, 1, H - floorY);
      }
      for (let y = floorY; y < H; y += 16) {
        ctx.fillStyle = "rgba(50,25,28,0.4)";
        ctx.fillRect(0, y, W, 1);
      }
      // far door on the right
      ctx.fillStyle = "#1a0e14";
      ctx.fillRect(W - 36, 60, 26, floorY - 60);
      ctx.fillStyle = "#2a1218";
      ctx.fillRect(W - 36, 60, 26, 2);
      ctx.fillRect(W - 36, floorY - 4, 26, 2);
      // emergency light over door
      const flick = 0.7 + 0.3 * Math.sin(t * 18) * (Math.random() > 0.9 ? 0 : 1);
      ctx.fillStyle = `rgba(220, 50, 60, ${0.6 * flick})`;
      ctx.fillRect(W - 30, 56, 14, 2);
      const cone = ctx.createRadialGradient(W - 23, 58, 2, W - 23, 58, 60);
      cone.addColorStop(0, `rgba(220, 60, 60, ${0.25 * flick})`);
      cone.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = cone;
      ctx.fillRect(W - 80, 56, 80, 80);
    }

    function drawTamara() {
      if (!ctx) return;
      const x = Math.floor(tam.x);
      const y = Math.floor(tam.y);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath();
      ctx.ellipse(x, y + 8, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // legs (peg + flesh) — animate
      const stepBob = Math.sin(tam.step) * 1.5;
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(x - 3, y, 2, 6 + stepBob);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(x + 1, y, 2, 6 - stepBob);
      // torso
      ctx.fillStyle = "#1c1018";
      ctx.fillRect(x - 4, y - 7, 8, 8);
      ctx.fillStyle = "#3a2018";
      ctx.fillRect(x - 5, y - 6, 1, 3);
      ctx.fillRect(x + 4, y - 6, 1, 3);
      // helmet
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(x - 4, y - 12, 8, 5);
      ctx.fillStyle = "#0a0408";
      ctx.fillRect(x - 3, y - 10, 6, 2);
      // visor eyes
      ctx.fillStyle = "#e8f0ff";
      ctx.fillRect(x - 2, y - 10, 1, 1);
      ctx.fillRect(x + 1, y - 10, 1, 1);
      // backpack
      ctx.fillStyle = "#1a1014";
      ctx.fillRect(x - 3, y - 5, 6, 4);
    }

    function drawTumor() {
      if (!ctx) return;
      const x = Math.floor(tumor.x);
      const y = Math.floor(tumor.y);
      const s = tumor.size;
      if (s <= 0.2) return;

      // pool/shadow under
      ctx.fillStyle = `rgba(60,8,16,${Math.min(0.55, 0.1 + s * 0.06)})`;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, s * 1.6, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // main pulsing meat blob
      const pulse = 0.7 + 0.3 * Math.sin(t * 5);
      ctx.fillStyle = `rgba(150, 22, 40, ${0.85})`;
      ctx.beginPath();
      ctx.arc(x, y, s * pulse, 0, Math.PI * 2);
      ctx.fill();
      // darker core
      ctx.fillStyle = "rgba(60, 6, 14, 0.85)";
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, s * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // wet highlight
      ctx.fillStyle = "rgba(230, 120, 130, 0.55)";
      ctx.fillRect(x - 1, y - Math.floor(s * 0.6), 1, 1);

      // tendrils once sprouted
      if (s > 4) {
        ctx.strokeStyle = "rgba(140, 20, 40, 0.7)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2 + t * 0.6;
          const len = s * 1.6 + Math.sin(t * 4 + i) * 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.6);
          ctx.stroke();
        }
        // forward reach (toward Tamara)
        const reach = Math.min(s * 0.9, 8);
        ctx.strokeStyle = "rgba(180, 30, 50, 0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 2, y - 1);
        ctx.lineTo(x - 4 - reach, y - 2);
        ctx.moveTo(x - 2, y + 1);
        ctx.lineTo(x - 5 - reach, y + 2);
        ctx.stroke();
      }

      // tiny floating blood specks once it's chasing
      if (tumor.alive) {
        for (let i = 0; i < 6; i++) {
          const fy = y - ((t * 30 + i * 7) % 18);
          ctx.fillStyle = `rgba(180, 28, 48, ${0.4 - (y - fy) / 60})`;
          ctx.fillRect(x + ((i * 3) % 7) - 3, fy, 1, 1);
        }
      }
    }

    function update(dt: number) {
      t += dt;

      // Phase: forming
      if (t < 1.6) {
        tumor.size = (t / 1.6) * 5.5;
      } else if (t < 2.2) {
        // sprout — quick growth spurt
        tumor.size = 5.5 + ((t - 1.6) / 0.6) * 3;
      } else {
        tumor.size = 8.5 + Math.sin(t * 4) * 0.6;
      }

      // Tamara starts running just before the tumor wakes up
      if (t > 2.0 && tam.x < W - 50) {
        const speed = 38;
        tam.x += speed * dt;
        tam.step += dt * 10;
      }

      // Tumor chases
      if (t > 2.2) {
        tumor.alive = true;
        // a little slower than Tamara so it never catches her
        const chase = 32;
        tumor.x += chase * dt;
      }

      if (t > TOTAL && !doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }

    function render() {
      if (!ctx) return;
      drawRoom();
      // draw tumor first (it's on/in the floor), then Tamara in front when she runs past
      drawTumor();
      drawTamara();

      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 180);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // end fade to black
      if (t > 7.6) {
        const a = Math.min(1, (t - 7.6) / 0.8);
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
