import { useEffect, useRef } from "react";
import { clang } from "./audio";

// Top-down pixel dive — flooded maintenance corridor of Sector Gamma-7.
// Heavier Signalis-style ambience: tiled deck plates, structural walls, pipes,
// hazard stripes, flickering wall sconces, drifting silt, fluid puddles.
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

    // World: a long corridor. Walls clamp the player on top & bottom.
    const worldW = 960;
    const worldH = 220;
    const wallTop = 28;
    const wallBot = worldH - 28;

    const husk = { x: worldW - 70, y: (wallTop + wallBot) / 2 };
    const player = { x: 40, y: (wallTop + wallBot) / 2, vx: 0, vy: 0, facing: 1, step: 0 };

    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    // Stable PRNG
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    // Structural props placed along corridor
    type Prop =
      | { kind: "crate"; x: number; y: number; w: number; h: number }
      | { kind: "console"; x: number; y: number }
      | { kind: "barrel"; x: number; y: number }
      | { kind: "pipe-break"; x: number; y: number }
      | { kind: "puddle"; x: number; y: number; r: number };
    const props: Prop[] = [];
    for (let x = 80; x < worldW - 100; x += 50 + rnd() * 40) {
      const onTop = rnd() > 0.5;
      const y = onTop ? wallTop + 6 + rnd() * 8 : wallBot - 14 - rnd() * 8;
      const pick = rnd();
      if (pick < 0.3) props.push({ kind: "crate", x, y, w: 10 + Math.floor(rnd() * 6), h: 10 });
      else if (pick < 0.55) props.push({ kind: "console", x, y });
      else if (pick < 0.75) props.push({ kind: "barrel", x, y: y + 2 });
      else props.push({ kind: "pipe-break", x, y: onTop ? wallTop : wallBot - 4 });
    }
    for (let i = 0; i < 22; i++) {
      props.push({
        kind: "puddle",
        x: 50 + rnd() * (worldW - 100),
        y: wallTop + 12 + rnd() * (wallBot - wallTop - 24),
        r: 6 + rnd() * 10,
      });
    }

    // Flickering wall sconces along ceiling
    const sconces: { x: number; phase: number; seedV: number }[] = [];
    for (let x = 60; x < worldW; x += 110) {
      sconces.push({ x, phase: rnd() * Math.PI * 2, seedV: rnd() });
    }

    // Drifting silt particles
    const silt: { x: number; y: number; vy: number; vx: number; a: number }[] = [];
    for (let i = 0; i < 60; i++) {
      silt.push({
        x: rnd() * worldW,
        y: wallTop + rnd() * (wallBot - wallTop),
        vy: -2 - rnd() * 4,
        vx: (rnd() - 0.5) * 2,
        a: 0.15 + rnd() * 0.35,
      });
    }

    // Distant bio-meat pulses (kept, but rarer and behind walls)
    const meat: { x: number; y: number; r: number; phase: number }[] = [];
    for (let i = 0; i < 10; i++) {
      meat.push({
        x: 200 + rnd() * (worldW - 300),
        y: rnd() > 0.5 ? wallTop - 18 : wallBot + 8,
        r: 5 + rnd() * 8,
        phase: rnd() * Math.PI * 2,
      });
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
      const speed = 38;
      player.x += (mx / len) * speed * dt;
      player.y += (my / len) * speed * dt;
      player.x = Math.max(10, Math.min(worldW - 10, player.x));
      player.y = Math.max(wallTop + 6, Math.min(wallBot - 6, player.y));
      if (mx !== 0) player.facing = mx > 0 ? 1 : -1;
      const moving = mx !== 0 || my !== 0;
      if (moving) {
        stepTimer += dt;
        // peg-leg = uneven cadence: short, then long
        const interval = player.step === 0 ? 0.42 : 0.68;
        if (stepTimer > interval) {
          stepTimer = 0;
          player.step = (player.step + 1) % 2;
          clang(player.step === 0 ? "step" : "hydraulic");
        }
      } else {
        stepTimer = 0.3;
      }

      // silt drift
      for (const s of silt) {
        s.x += s.vx * dt * 4;
        s.y += s.vy * dt * 4;
        if (s.y < wallTop - 4) {
          s.y = wallBot + 4;
          s.x = rnd() * worldW;
        }
      }

      const d = Math.hypot(player.x - husk.x, player.y - husk.y);
      if (d < 22 && !reachedRef.current) {
        reachedRef.current = true;
        onReach();
      }
    }

    function drawWall(camX: number, y: number, isTop: boolean) {
      if (!ctx) return;
      const h = 16;
      const wy = isTop ? y - h : y;
      // base plate
      const baseGrad = ctx.createLinearGradient(0, wy, 0, wy + h);
      baseGrad.addColorStop(0, isTop ? "#1a1418" : "#0d090c");
      baseGrad.addColorStop(1, isTop ? "#0d090c" : "#1a1418");
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, wy, W, h);
      // panel seams
      ctx.fillStyle = "#050305";
      const startX = -((camX) % 24);
      for (let x = startX; x < W; x += 24) {
        ctx.fillRect(Math.floor(x), wy, 1, h);
      }
      // rivets
      ctx.fillStyle = "#2a1a1c";
      for (let x = startX + 6; x < W; x += 24) {
        ctx.fillRect(Math.floor(x), isTop ? wy + 3 : wy + h - 4, 1, 1);
        ctx.fillRect(Math.floor(x), isTop ? wy + h - 4 : wy + 3, 1, 1);
      }
      // pipe running along
      ctx.fillStyle = "#3a2218";
      ctx.fillRect(0, isTop ? wy + h - 6 : wy + 2, W, 3);
      ctx.fillStyle = "#5a3220";
      ctx.fillRect(0, isTop ? wy + h - 6 : wy + 2, W, 1);
      // hazard stripe (faded)
      ctx.fillStyle = "#3a2a08";
      ctx.fillRect(0, isTop ? wy + h - 2 : wy, W, 1);
    }

    function drawFloorTiles(camX: number) {
      if (!ctx) return;
      // Base floor color
      const g = ctx.createLinearGradient(0, wallTop, 0, wallBot);
      g.addColorStop(0, "#160d10");
      g.addColorStop(0.5, "#0e0709");
      g.addColorStop(1, "#160d10");
      ctx.fillStyle = g;
      ctx.fillRect(0, wallTop, W, wallBot - wallTop);

      // Tile grid (16x16 deck plates)
      const tile = 16;
      ctx.fillStyle = "rgba(40, 20, 22, 0.55)";
      const startX = -((camX) % tile);
      for (let x = startX; x < W; x += tile) {
        ctx.fillRect(Math.floor(x), wallTop, 1, wallBot - wallTop);
      }
      for (let y = wallTop; y < wallBot; y += tile) {
        ctx.fillRect(0, y, W, 1);
      }
      // diamond-plate flecks
      for (let y = wallTop + 4; y < wallBot; y += tile) {
        for (let x = startX + 4; x < W; x += tile) {
          ctx.fillStyle = "rgba(70, 40, 35, 0.35)";
          ctx.fillRect(Math.floor(x) + 2, y + 2, 1, 1);
          ctx.fillRect(Math.floor(x) + 10, y + 10, 1, 1);
        }
      }

      // Center grate channel — fluid drain
      const drainY = (wallTop + wallBot) / 2 - 3;
      ctx.fillStyle = "#070406";
      ctx.fillRect(0, drainY, W, 6);
      ctx.fillStyle = "#1a0a0c";
      for (let x = startX; x < W; x += 4) {
        ctx.fillRect(Math.floor(x), drainY + 1, 2, 4);
      }
      // glistening fluid
      ctx.fillStyle = `rgba(140, 30, 50, ${0.18 + 0.08 * Math.sin(time * 1.2)})`;
      ctx.fillRect(0, drainY + 2, W, 2);
    }

    function drawProps(camX: number) {
      if (!ctx) return;
      for (const p of props) {
        const sx = Math.floor(p.x - camX);
        if (sx < -30 || sx > W + 30) continue;
        const sy = Math.floor(p.y);
        switch (p.kind) {
          case "crate": {
            ctx.fillStyle = "#2a1810";
            ctx.fillRect(sx, sy, p.w, p.h);
            ctx.fillStyle = "#3e2418";
            ctx.fillRect(sx, sy, p.w, 1);
            ctx.fillStyle = "#120808";
            ctx.fillRect(sx, sy + p.h - 1, p.w, 1);
            ctx.fillStyle = "#4a2a18";
            ctx.fillRect(sx + 2, sy + 3, p.w - 4, 1);
            ctx.fillRect(sx + 2, sy + p.h - 4, p.w - 4, 1);
            break;
          }
          case "console": {
            ctx.fillStyle = "#181014";
            ctx.fillRect(sx, sy, 14, 10);
            ctx.fillStyle = "#3a1218";
            ctx.fillRect(sx + 2, sy + 2, 10, 4);
            // dead screen with flicker
            ctx.fillStyle = `rgba(180, 30, 50, ${0.2 + 0.5 * Math.random() * (Math.random() > 0.92 ? 1 : 0)})`;
            ctx.fillRect(sx + 3, sy + 3, 8, 2);
            ctx.fillStyle = "#0a0608";
            ctx.fillRect(sx + 2, sy + 7, 2, 2);
            ctx.fillRect(sx + 6, sy + 7, 2, 2);
            ctx.fillRect(sx + 10, sy + 7, 2, 2);
            break;
          }
          case "barrel": {
            ctx.fillStyle = "#2a1410";
            ctx.fillRect(sx, sy, 8, 12);
            ctx.fillStyle = "#3e1c14";
            ctx.fillRect(sx, sy, 8, 1);
            ctx.fillRect(sx, sy + 5, 8, 1);
            ctx.fillRect(sx, sy + 11, 8, 1);
            // hazard chevron
            ctx.fillStyle = "#5a4010";
            ctx.fillRect(sx + 2, sy + 7, 4, 2);
            break;
          }
          case "pipe-break": {
            ctx.fillStyle = "#5a3220";
            ctx.fillRect(sx, sy, 14, 3);
            ctx.fillStyle = "#1a0a08";
            ctx.fillRect(sx + 5, sy, 3, 3);
            // drip
            ctx.fillStyle = `rgba(160, 30, 50, ${0.4 + 0.3 * Math.sin(time * 3 + sx)})`;
            ctx.fillRect(sx + 6, sy + 3, 1, 6);
            break;
          }
          case "puddle": {
            ctx.fillStyle = "rgba(60, 10, 20, 0.55)";
            ctx.beginPath();
            ctx.ellipse(sx, sy, p.r, p.r * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(200, 80, 90, ${0.08 + 0.05 * Math.sin(time * 1.5 + sx)})`;
            ctx.beginPath();
            ctx.ellipse(sx, sy - 1, p.r * 0.7, p.r * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
        }
      }
    }

    function drawSilt(camX: number) {
      if (!ctx) return;
      for (const s of silt) {
        const sx = Math.floor(s.x - camX);
        if (sx < 0 || sx > W) continue;
        ctx.fillStyle = `rgba(180, 140, 130, ${s.a})`;
        ctx.fillRect(sx, Math.floor(s.y), 1, 1);
      }
    }

    function drawMeatPulses(camX: number) {
      if (!ctx) return;
      for (const m of meat) {
        const sx = Math.floor(m.x - camX);
        if (sx < -20 || sx > W + 20) continue;
        const pulse = 0.5 + 0.5 * Math.sin(time * 1.1 + m.phase);
        ctx.fillStyle = `rgba(120, 20, 40, ${0.20 + pulse * 0.18})`;
        ctx.beginPath();
        ctx.arc(sx, Math.floor(m.y), m.r + pulse * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Persistent floating blood droplets that drift up & sideways around the husk.
    const bloodDrops: { ox: number; oy: number; vx: number; vy: number; r: number; a: number; life: number }[] = [];
    for (let i = 0; i < 18; i++) {
      bloodDrops.push({
        ox: (rnd() - 0.5) * 18,
        oy: (rnd() - 0.5) * 16 - 2,
        vx: (rnd() - 0.5) * 4,
        vy: -2 - rnd() * 4,
        r: 0.6 + rnd() * 1.6,
        a: 0.45 + rnd() * 0.4,
        life: rnd(),
      });
    }

    function drawHusk(camX: number) {
      if (!ctx) return;
      const hx = Math.floor(husk.x - camX);
      const hy = Math.floor(husk.y);
      const bob = Math.sin(time * 0.6) * 1.2;

      // ground shadow
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(hx, hy + 9, 9, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // dark pool of dispersed blood under the body
      ctx.fillStyle = `rgba(80, 8, 18, ${0.45 + 0.05 * Math.sin(time * 0.8)})`;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 8, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(140, 20, 40, 0.30)";
      ctx.beginPath();
      ctx.ellipse(hx - 2, hy + 8, 8, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // torso — battered suit, slumped
      ctx.fillStyle = "#1a1418";
      ctx.fillRect(hx - 5, hy - 8 + bob, 10, 14);
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(hx - 5, hy - 8 + bob, 10, 1);
      // chest rupture — meat showing through cracked plating
      ctx.fillStyle = "#0a0306";
      ctx.fillRect(hx - 3, hy - 3 + bob, 6, 5);
      ctx.fillStyle = `rgba(170, 24, 44, ${0.75 + 0.18 * Math.sin(time * 2.2)})`;
      ctx.fillRect(hx - 2, hy - 2 + bob, 4, 3);
      ctx.fillStyle = "rgba(220, 80, 90, 0.55)";
      ctx.fillRect(hx - 1, hy - 2 + bob, 2, 1);
      // exposed ribs as thin pale shards
      ctx.fillStyle = "rgba(200, 180, 160, 0.55)";
      ctx.fillRect(hx - 2, hy - 1 + bob, 1, 1);
      ctx.fillRect(hx, hy - 1 + bob, 1, 1);
      ctx.fillRect(hx + 2, hy - 1 + bob, 1, 1);

      // BROKEN-WING ARM — left arm hangs torn, splayed like a bird's broken wing
      // upper segment, wrenched outward
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(hx - 9, hy - 5 + bob, 4, 2);
      // joint exposed (red flesh hinge)
      ctx.fillStyle = "rgba(170, 30, 50, 0.85)";
      ctx.fillRect(hx - 9, hy - 3 + bob, 2, 2);
      // forearm bent the wrong way, dangling down
      ctx.fillStyle = "#1a1014";
      ctx.fillRect(hx - 10, hy - 1 + bob, 2, 5);
      // hand — splayed fingers
      ctx.fillStyle = "#241318";
      ctx.fillRect(hx - 11, hy + 4 + bob, 1, 2);
      ctx.fillRect(hx - 9, hy + 4 + bob, 1, 2);
      ctx.fillRect(hx - 8, hy + 4 + bob, 1, 1);
      // sinew/strings of tissue from torso to arm — the "broken wing" trailing
      ctx.strokeStyle = "rgba(140, 20, 40, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 5, hy - 4 + bob);
      ctx.lineTo(hx - 8, hy - 1 + bob);
      ctx.moveTo(hx - 5, hy - 2 + bob);
      ctx.lineTo(hx - 9, hy + 1 + bob);
      ctx.stroke();

      // right arm — limp at side
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(hx + 5, hy - 4 + bob, 2, 8);

      // shattered helmet, faceplate cracked open
      ctx.fillStyle = "#3a1218";
      ctx.fillRect(hx - 3, hy - 11 + bob, 6, 5);
      ctx.fillStyle = "#0a0408";
      ctx.fillRect(hx - 2, hy - 10 + bob, 4, 2);
      // crack
      ctx.fillStyle = "#e8d8c8";
      ctx.fillRect(hx, hy - 11 + bob, 1, 4);
      // exposed meat where the face should be
      ctx.fillStyle = `rgba(190, 30, 50, ${0.7 + 0.2 * Math.sin(time * 2)})`;
      ctx.fillRect(hx - 1, hy - 9 + bob, 2, 1);

      // floating blood droplets — pressure carries them upward
      for (const d of bloodDrops) {
        d.life += 0.016;
        if (d.life > 1.6) {
          d.life = 0;
          d.ox = (rnd() - 0.5) * 14;
          d.oy = (rnd() - 0.5) * 10 - 2;
        }
        const fx = hx + d.ox + d.vx * d.life;
        const fy = hy + d.oy + d.vy * d.life;
        const fade = Math.max(0, 1 - d.life / 1.6);
        ctx.fillStyle = `rgba(180, 28, 48, ${d.a * fade})`;
        ctx.beginPath();
        ctx.arc(Math.floor(fx), Math.floor(fy), d.r, 0, Math.PI * 2);
        ctx.fill();
        // tiny brighter highlight
        if (d.r > 1) {
          ctx.fillStyle = `rgba(230, 120, 130, ${0.5 * fade})`;
          ctx.fillRect(Math.floor(fx), Math.floor(fy) - 1, 1, 1);
        }
      }

      // tendrils anchoring corpse to floor
      ctx.fillStyle = "rgba(80, 10, 20, 0.7)";
      ctx.fillRect(hx - 1, hy + 6, 1, 4);
      ctx.fillRect(hx + 2, hy + 6, 1, 3);
      ctx.fillRect(hx - 4, hy + 7, 1, 2);
    }

    function drawPlayer() {
      if (!ctx) return;
      const px = Math.floor(W / 2 + (player.x - clampedCam(player.x, worldW, W)) - W / 2);
      // Actually compute via camera below; easier: pass through
    }
    void drawPlayer;

    function clampedCam(px: number, total: number, view: number) {
      return Math.max(0, Math.min(total - view, px - view / 2));
    }

    function render() {
      if (!ctx) return;
      const camX = clampedCam(player.x, worldW, W);

      // Sky / void above and below corridor (deep blackness)
      ctx.fillStyle = "#04020410";
      ctx.fillRect(0, 0, W, H);
      const voidGrad = ctx.createLinearGradient(0, 0, 0, H);
      voidGrad.addColorStop(0, "#06030a");
      voidGrad.addColorStop(0.5, "#100610");
      voidGrad.addColorStop(1, "#06030a");
      ctx.fillStyle = voidGrad;
      ctx.fillRect(0, 0, W, H);

      // Floor + tiles
      drawFloorTiles(camX);

      // Behind-the-wall meat pulses
      drawMeatPulses(camX);

      // Walls (top & bottom)
      drawWall(camX, wallTop, true);
      drawWall(camX, wallBot, false);

      // Props on/near floor
      drawProps(camX);

      // Husk at end of corridor
      drawHusk(camX);

      // Player — drawn at screen-space center-x (camera follows)
      const px = Math.floor(player.x - camX);
      const py = Math.floor(player.y);
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(px, py + 7, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      // legs (peg + flesh)
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(px - 3, py + 2, 2, 5);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(px + 1, py + 2, 2, 5);
      if (player.step === 1) {
        ctx.fillStyle = "#666";
        ctx.fillRect(px + 1, py + 7, 2, 1);
      }
      // torso — heavy suit
      ctx.fillStyle = "#1c1018";
      ctx.fillRect(px - 4, py - 4, 8, 7);
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(px - 4, py - 4, 8, 1);
      // shoulder pauldrons
      ctx.fillStyle = "#3a2018";
      ctx.fillRect(px - 5, py - 3, 1, 3);
      ctx.fillRect(px + 4, py - 3, 1, 3);
      // chest strap
      ctx.fillStyle = "#0a0508";
      ctx.fillRect(px - 4, py - 1, 8, 1);
      // helmet (rust)
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(px - 4, py - 9, 8, 5);
      // helmet visor
      ctx.fillStyle = "#0a0408";
      ctx.fillRect(px - 3, py - 7, 6, 2);
      // chrome eyes through visor
      ctx.fillStyle = "#e8f0ff";
      ctx.fillRect(px - 2, py - 7, 1, 1);
      ctx.fillRect(px + 1, py - 7, 1, 1);
      // beanie / hood
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(px - 4, py - 10, 8, 2);
      // backpack hump
      ctx.fillStyle = "#1a1014";
      ctx.fillRect(px - 3, py - 3, 6, 5);

      // Wall sconce flicker — pools of red emergency light on floor
      for (const s of sconces) {
        const sx = Math.floor(s.x - camX);
        if (sx < -40 || sx > W + 40) continue;
        const flick = 0.7 + 0.3 * Math.sin(time * 14 + s.phase) * (Math.random() > 0.93 ? 0 : 1);
        // sconce on top wall
        ctx.fillStyle = `rgba(180, 30, 40, ${0.9 * flick})`;
        ctx.fillRect(sx - 1, wallTop - 4, 3, 2);
        // light cone down to floor
        const lg = ctx.createRadialGradient(sx, wallTop - 2, 2, sx, wallTop + 50, 50);
        lg.addColorStop(0, `rgba(220, 60, 60, ${0.35 * flick})`);
        lg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(sx - 40, wallTop - 2, 80, wallBot - wallTop + 8);
      }

      // Drifting silt over everything
      drawSilt(camX);

      // Helmet light cone — large, warm, soft
      const cone = ctx.createRadialGradient(px, py, 4, px, py, 90);
      cone.addColorStop(0, "rgba(255, 230, 190, 0.30)");
      cone.addColorStop(0.4, "rgba(220, 120, 90, 0.10)");
      cone.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = cone;
      ctx.fillRect(0, 0, W, H);

      // Soft vignette (less aggressive — not jumpscare territory)
      const vg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 170);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Subtle chromatic haze top/bottom
      ctx.fillStyle = "rgba(40, 0, 20, 0.15)";
      ctx.fillRect(0, 0, W, 8);
      ctx.fillRect(0, H - 8, W, 8);

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
