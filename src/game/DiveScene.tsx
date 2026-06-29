import { useEffect, useRef } from "react";
import { clang } from "./audio";

// Pseudo-3D dive — PS1/PS2-era survival-horror corridor of Sector Gamma-7.
// Third-person view from behind Tamara as she wades deeper into the flooded
// maintenance tunnel. Perspective floor grid, paneled walls receding into mist,
// flickering red sconces, drifting silt, and the Husk floating at the far end.
type Props = { onReach: () => void };

const W = 320;
const H = 180;
const HORIZON = 70;     // y of the vanishing point
const VPX = W / 2;      // x of the vanishing point
const CORRIDOR_LEN = 60; // depth units to the Husk

// Project a world point (x = lateral [-1..1], y = vertical offset from floor,
// z = depth from camera in world units) into screen coords.
function project(x: number, y: number, z: number) {
  // 1/z perspective; clamp so nothing explodes near the camera.
  const persp = 1 / (0.6 + z * 0.22);
  const sy = HORIZON + (H - HORIZON) * persp - y * persp * 40;
  const sx = VPX + x * (W * 0.6) * persp;
  return { sx, sy, scale: persp };
}

export default function DiveScene({ onReach }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reachedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    // Player position in corridor-space.
    // z = how far Tamara has walked into the tunnel (0 = start).
    // lateral = -1..1 strafe across corridor width.
    const player = { z: 0, lateral: 0, facing: 0, step: 0 };
    // Camera trails just behind Tamara
    const cam = { z: -3 };

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

    // Sconces lining the corridor — each at a depth z, alternating walls.
    const sconces: { z: number; side: -1 | 1; phase: number }[] = [];
    for (let z = 4; z < CORRIDOR_LEN; z += 5 + rnd() * 2) {
      sconces.push({ z, side: rnd() > 0.5 ? -1 : 1, phase: rnd() * Math.PI * 2 });
    }

    // Pipes, crates, barrels along the walls.
    type Prop = { z: number; side: -1 | 1; kind: "crate" | "barrel" | "console" | "pipe" };
    const props: Prop[] = [];
    for (let z = 3; z < CORRIDOR_LEN - 3; z += 2.2 + rnd() * 2.5) {
      const r = rnd();
      const kind: Prop["kind"] = r < 0.3 ? "crate" : r < 0.55 ? "barrel" : r < 0.8 ? "console" : "pipe";
      props.push({ z, side: rnd() > 0.5 ? -1 : 1, kind });
    }

    // Floor puddles — pools of vital fluid catching the red sconce light.
    const puddles: { z: number; x: number; r: number }[] = [];
    for (let i = 0; i < 24; i++) {
      puddles.push({ z: 2 + rnd() * CORRIDOR_LEN, x: (rnd() - 0.5) * 1.4, r: 0.15 + rnd() * 0.25 });
    }

    // Floating silt motes — drift through the volume.
    const silt: { x: number; y: number; z: number; vy: number; vx: number; a: number }[] = [];
    for (let i = 0; i < 80; i++) {
      silt.push({
        x: (rnd() - 0.5) * 2,
        y: rnd() * 1.8,
        z: rnd() * CORRIDOR_LEN,
        vy: 0.05 + rnd() * 0.15,
        vx: (rnd() - 0.5) * 0.08,
        a: 0.15 + rnd() * 0.35,
      });
    }

    let raf = 0;
    let last = performance.now();
    let stepTimer = 0;
    let time = 0;

    function update(dt: number) {
      time += dt;
      let fwd = 0;
      let lat = 0;
      if (keys.has("arrowup") || keys.has("w")) fwd += 1;
      if (keys.has("arrowdown") || keys.has("s")) fwd -= 1;
      if (keys.has("arrowleft") || keys.has("a")) lat -= 1;
      if (keys.has("arrowright") || keys.has("d")) lat += 1;

      const fwdSpeed = 2.4; // depth units / sec
      const latSpeed = 0.9;
      player.z += fwd * fwdSpeed * dt;
      player.lateral += lat * latSpeed * dt;
      player.z = Math.max(0, Math.min(CORRIDOR_LEN, player.z));
      player.lateral = Math.max(-0.85, Math.min(0.85, player.lateral));
      if (lat !== 0) player.facing = lat;

      // Camera trails behind, smoothing
      const targetCam = player.z - 3;
      cam.z += (targetCam - cam.z) * Math.min(1, dt * 4);

      const moving = fwd !== 0 || lat !== 0;
      if (moving) {
        stepTimer += dt;
        const interval = player.step === 0 ? 0.42 : 0.68;
        if (stepTimer > interval) {
          stepTimer = 0;
          player.step = (player.step + 1) % 2;
          clang(player.step === 0 ? "step" : "hydraulic");
        }
      } else {
        stepTimer = 0.3;
      }

      // silt drift upward (pressure)
      for (const s of silt) {
        s.y += s.vy * dt;
        s.x += s.vx * dt;
        if (s.y > 2) {
          s.y = 0;
          s.x = (rnd() - 0.5) * 2;
          s.z = player.z + 1 + rnd() * (CORRIDOR_LEN - player.z);
        }
      }

      if (player.z >= CORRIDOR_LEN - 2 && !reachedRef.current) {
        reachedRef.current = true;
        onReach();
      }
    }

    // Convert a world depth to "depth from camera"
    const zd = (z: number) => z - cam.z;

    function drawFloor() {
      if (!ctx) return;
      // Solid floor base (below horizon) with vertical gradient
      const g = ctx.createLinearGradient(0, HORIZON, 0, H);
      g.addColorStop(0, "#0a0508");
      g.addColorStop(0.4, "#120709");
      g.addColorStop(1, "#1a0d10");
      ctx.fillStyle = g;
      ctx.fillRect(0, HORIZON, W, H - HORIZON);

      // Perspective floor grid — lines receding into distance.
      // Lateral lines (parallel to camera, marching toward us).
      ctx.strokeStyle = "rgba(80, 30, 32, 0.55)";
      ctx.lineWidth = 1;
      const scroll = cam.z % 1;
      for (let i = 0; i < 40; i++) {
        const z = i - scroll;
        if (z < 0.1) continue;
        const a = project(-1, 0, z);
        const b = project(1, 0, z);
        const fade = Math.max(0, 1 - z / 28);
        if (fade <= 0) continue;
        ctx.strokeStyle = `rgba(90, 36, 38, ${0.55 * fade})`;
        ctx.beginPath();
        ctx.moveTo(0, a.sy);
        ctx.lineTo(W, b.sy);
        ctx.stroke();
      }
      // Longitudinal lines (going to vanishing point).
      ctx.strokeStyle = "rgba(70, 28, 30, 0.4)";
      for (let lx = -1; lx <= 1; lx += 0.25) {
        const near = project(lx, 0, 0.2);
        ctx.beginPath();
        ctx.moveTo(near.sx, near.sy);
        ctx.lineTo(VPX, HORIZON);
        ctx.stroke();
      }

      // Center drain channel — darker strip down the middle
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.moveTo(VPX - 2, HORIZON);
      ctx.lineTo(VPX + 2, HORIZON);
      ctx.lineTo(W / 2 + 30, H);
      ctx.lineTo(W / 2 - 30, H);
      ctx.closePath();
      ctx.fill();
    }

    function drawWalls() {
      if (!ctx) return;
      // Solid wall fills (left & right) using projected quads at z=0..far
      const farZ = 25;
      const near = 0.2;
      const nearL = project(-1, 0, near);
      const nearLT = project(-1, 1.8, near);
      const farL = project(-1, 0, farZ);
      const farLT = project(-1, 1.8, farZ);

      // Left wall
      const lg = ctx.createLinearGradient(0, 0, W * 0.4, 0);
      lg.addColorStop(0, "#0d070a");
      lg.addColorStop(1, "#1c1014");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(nearL.sx, nearL.sy);
      ctx.lineTo(nearLT.sx, nearLT.sy);
      ctx.lineTo(farLT.sx, farLT.sy);
      ctx.lineTo(farL.sx, farL.sy);
      ctx.closePath();
      ctx.fill();

      // Right wall
      const nearR = project(1, 0, near);
      const nearRT = project(1, 1.8, near);
      const farR = project(1, 0, farZ);
      const farRT = project(1, 1.8, farZ);
      const rg = ctx.createLinearGradient(W * 0.6, 0, W, 0);
      rg.addColorStop(0, "#1c1014");
      rg.addColorStop(1, "#0d070a");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(nearR.sx, nearR.sy);
      ctx.lineTo(nearRT.sx, nearRT.sy);
      ctx.lineTo(farRT.sx, farRT.sy);
      ctx.lineTo(farR.sx, farR.sy);
      ctx.closePath();
      ctx.fill();

      // Ceiling
      const cg = ctx.createLinearGradient(0, 0, 0, HORIZON);
      cg.addColorStop(0, "#06030a");
      cg.addColorStop(1, "#100610");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(nearLT.sx, nearLT.sy);
      ctx.lineTo(nearRT.sx, nearRT.sy);
      ctx.lineTo(farRT.sx, farRT.sy);
      ctx.lineTo(farLT.sx, farLT.sy);
      ctx.closePath();
      ctx.fill();

      // Wall panel seams + pipe — vertical lines at integer z positions
      const scroll = cam.z % 1;
      for (let i = 0; i < 30; i++) {
        const z = i - scroll;
        if (z < 0.3) continue;
        const fade = Math.max(0, 1 - z / 22);
        if (fade <= 0) continue;
        // Left wall seam
        const lb = project(-1, 0, z);
        const lt = project(-1, 1.8, z);
        ctx.strokeStyle = `rgba(0,0,0,${0.55 * fade})`;
        ctx.beginPath();
        ctx.moveTo(lb.sx, lb.sy);
        ctx.lineTo(lt.sx, lt.sy);
        ctx.stroke();
        // Right wall seam
        const rb = project(1, 0, z);
        const rt = project(1, 1.8, z);
        ctx.beginPath();
        ctx.moveTo(rb.sx, rb.sy);
        ctx.lineTo(rt.sx, rt.sy);
        ctx.stroke();
        // Rivets
        ctx.fillStyle = `rgba(60, 26, 22, ${fade})`;
        ctx.fillRect(Math.floor(lb.sx), Math.floor(lb.sy - 8 * lb.scale), 1, 1);
        ctx.fillRect(Math.floor(rb.sx), Math.floor(rb.sy - 8 * rb.scale), 1, 1);
      }

      // Horizontal pipe running along both walls at mid-height
      ctx.strokeStyle = "rgba(58, 34, 24, 0.85)";
      ctx.lineWidth = 1;
      const pNearL = project(-1, 0.9, near);
      const pFarL = project(-1, 0.9, farZ);
      ctx.beginPath();
      ctx.moveTo(pNearL.sx, pNearL.sy);
      ctx.lineTo(pFarL.sx, pFarL.sy);
      ctx.stroke();
      const pNearR = project(1, 0.9, near);
      const pFarR = project(1, 0.9, farZ);
      ctx.beginPath();
      ctx.moveTo(pNearR.sx, pNearR.sy);
      ctx.lineTo(pFarR.sx, pFarR.sy);
      ctx.stroke();

      // Hazard stripe along floor base of walls
      ctx.strokeStyle = "rgba(70, 50, 12, 0.5)";
      const hzNearL = project(-1, 0.05, near);
      const hzFarL = project(-1, 0.05, farZ);
      ctx.beginPath();
      ctx.moveTo(hzNearL.sx, hzNearL.sy);
      ctx.lineTo(hzFarL.sx, hzFarL.sy);
      ctx.stroke();
      const hzNearR = project(1, 0.05, near);
      const hzFarR = project(1, 0.05, farZ);
      ctx.beginPath();
      ctx.moveTo(hzNearR.sx, hzNearR.sy);
      ctx.lineTo(hzFarR.sx, hzFarR.sy);
      ctx.stroke();
    }

    function drawPuddles() {
      if (!ctx) return;
      // Sort by depth, far first
      const list = puddles
        .map((p) => ({ ...p, zd: zd(p.z) }))
        .filter((p) => p.zd > 0.4 && p.zd < 25)
        .sort((a, b) => b.zd - a.zd);
      for (const p of list) {
        const c = project(p.x - player.lateral, 0, p.zd);
        const r = p.r * 60 * c.scale;
        if (r < 0.5) continue;
        ctx.fillStyle = `rgba(60, 10, 20, ${0.55 * Math.min(1, p.zd < 18 ? 1 : (25 - p.zd) / 7)})`;
        ctx.beginPath();
        ctx.ellipse(c.sx, c.sy, r, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // shimmer
        ctx.fillStyle = `rgba(200, 80, 90, ${0.15 + 0.06 * Math.sin(time * 1.5 + p.z)})`;
        ctx.beginPath();
        ctx.ellipse(c.sx, c.sy - 1, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawProps() {
      if (!ctx) return;
      const list = props
        .map((p) => ({ ...p, zd: zd(p.z) }))
        .filter((p) => p.zd > 0.5 && p.zd < 22)
        .sort((a, b) => b.zd - a.zd);
      for (const p of list) {
        const baseX = p.side * 0.85 - player.lateral;
        const c = project(baseX, 0, p.zd);
        const top = project(baseX, 0.5, p.zd);
        const s = c.scale;
        const fade = Math.min(1, (22 - p.zd) / 8);
        ctx.globalAlpha = fade;
        switch (p.kind) {
          case "crate": {
            const w = 18 * s;
            const h = (c.sy - top.sy);
            ctx.fillStyle = "#2a1810";
            ctx.fillRect(c.sx - w / 2, c.sy - h, w, h);
            ctx.fillStyle = "#3e2418";
            ctx.fillRect(c.sx - w / 2, c.sy - h, w, Math.max(1, 2 * s));
            ctx.fillStyle = "#120808";
            ctx.fillRect(c.sx - w / 2, c.sy - Math.max(1, 2 * s), w, Math.max(1, 2 * s));
            break;
          }
          case "barrel": {
            const w = 14 * s;
            const h = (c.sy - project(baseX, 0.7, p.zd).sy);
            ctx.fillStyle = "#2a1410";
            ctx.fillRect(c.sx - w / 2, c.sy - h, w, h);
            ctx.fillStyle = "#3e1c14";
            ctx.fillRect(c.sx - w / 2, c.sy - h * 0.55, w, Math.max(1, s));
            ctx.fillStyle = "#5a4010";
            ctx.fillRect(c.sx - w / 4, c.sy - h * 0.4, w / 2, Math.max(1, 2 * s));
            break;
          }
          case "console": {
            const w = 22 * s;
            const h = (c.sy - project(baseX, 0.45, p.zd).sy);
            ctx.fillStyle = "#181014";
            ctx.fillRect(c.sx - w / 2, c.sy - h, w, h);
            ctx.fillStyle = `rgba(180, 30, 50, ${0.3 + 0.5 * Math.random() * (Math.random() > 0.9 ? 1 : 0)})`;
            ctx.fillRect(c.sx - w / 2 + 2, c.sy - h + 2, Math.max(1, w - 4), Math.max(1, 2 * s));
            break;
          }
          case "pipe": {
            // vertical broken pipe with drip
            const top2 = project(baseX, 1.1, p.zd);
            ctx.strokeStyle = "#5a3220";
            ctx.lineWidth = Math.max(1, 2 * s);
            ctx.beginPath();
            ctx.moveTo(c.sx, c.sy);
            ctx.lineTo(top2.sx, top2.sy);
            ctx.stroke();
            ctx.fillStyle = `rgba(160, 30, 50, ${0.5 + 0.3 * Math.sin(time * 3 + p.z)})`;
            ctx.fillRect(c.sx, c.sy - 4 * s, Math.max(1, s), Math.max(1, 4 * s));
            break;
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawSconces() {
      if (!ctx) return;
      const list = sconces
        .map((s) => ({ ...s, zd: zd(s.z) }))
        .filter((s) => s.zd > 0.6 && s.zd < 22)
        .sort((a, b) => b.zd - a.zd);
      for (const s of list) {
        const baseX = s.side - player.lateral;
        const mount = project(baseX, 1.2, s.zd);
        const flick = 0.65 + 0.35 * Math.sin(time * 14 + s.phase) * (Math.random() > 0.93 ? 0 : 1);
        const fade = Math.min(1, (22 - s.zd) / 8);
        // fixture
        ctx.fillStyle = `rgba(180, 30, 40, ${0.9 * flick * fade})`;
        const sz = Math.max(1, 3 * mount.scale);
        ctx.fillRect(mount.sx - sz / 2, mount.sy - sz / 2, sz, sz);
        // light pool on floor in front of sconce
        const pool = project(baseX * 0.6, 0, s.zd);
        const r = 60 * pool.scale;
        const lg = ctx.createRadialGradient(pool.sx, pool.sy, 1, pool.sx, pool.sy, r);
        lg.addColorStop(0, `rgba(220, 60, 60, ${0.35 * flick * fade})`);
        lg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lg;
        ctx.fillRect(pool.sx - r, pool.sy - r * 0.6, r * 2, r * 1.2);
      }
    }

    function drawSilt() {
      if (!ctx) return;
      const list = silt
        .map((s) => ({ ...s, zd: zd(s.z) }))
        .filter((s) => s.zd > 0.3 && s.zd < 24);
      for (const s of list) {
        const c = project(s.x - player.lateral, s.y, s.zd);
        const fade = Math.min(1, (24 - s.zd) / 10);
        ctx.fillStyle = `rgba(180, 140, 130, ${s.a * fade})`;
        ctx.fillRect(Math.floor(c.sx), Math.floor(c.sy), 1, 1);
      }
    }

    function drawHusk() {
      if (!ctx) return;
      const hZ = zd(CORRIDOR_LEN);
      if (hZ < 0.5 || hZ > 30) return;
      const baseX = -player.lateral;
      const c = project(baseX, 0.5, hZ); // hovering off floor
      const s = c.scale * 1.6;
      const fade = Math.min(1, (30 - hZ) / 18);
      ctx.globalAlpha = fade;
      const hx = Math.floor(c.sx);
      const hy = Math.floor(c.sy);
      const bob = Math.sin(time * 0.6) * 1.2 * s;

      // dark pool of blood beneath
      const pool = project(baseX, 0, hZ);
      ctx.fillStyle = `rgba(80, 8, 18, ${0.55 * fade})`;
      ctx.beginPath();
      ctx.ellipse(pool.sx, pool.sy, 16 * s, 5 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // torso
      const W2 = Math.max(2, 12 * s);
      const H2 = Math.max(3, 18 * s);
      ctx.fillStyle = "#1a1418";
      ctx.fillRect(hx - W2 / 2, hy - H2 / 2 + bob, W2, H2);
      // chest rupture
      ctx.fillStyle = `rgba(170, 24, 44, ${0.75 + 0.18 * Math.sin(time * 2.2)})`;
      ctx.fillRect(hx - W2 / 4, hy - H2 / 6 + bob, W2 / 2, H2 / 4);
      // broken-wing arm
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(hx - W2, hy - H2 / 4 + bob, W2 / 2, Math.max(1, 2 * s));
      ctx.fillStyle = "rgba(170, 30, 50, 0.85)";
      ctx.fillRect(hx - W2, hy - H2 / 8 + bob, Math.max(1, 2 * s), Math.max(1, 2 * s));
      ctx.fillStyle = "#1a1014";
      ctx.fillRect(hx - W2 - Math.max(1, s), hy + bob, Math.max(1, 2 * s), H2 / 3);
      // helmet
      ctx.fillStyle = "#3a1218";
      ctx.fillRect(hx - W2 / 2, hy - H2 / 2 - H2 / 3 + bob, W2, H2 / 3);
      ctx.fillStyle = "#0a0408";
      ctx.fillRect(hx - W2 / 3, hy - H2 / 2 - H2 / 5 + bob, (W2 * 2) / 3, Math.max(1, 2 * s));
      // crack
      ctx.fillStyle = "#e8d8c8";
      ctx.fillRect(hx, hy - H2 / 2 - H2 / 3 + bob, 1, H2 / 4);

      // floating blood droplets — rise with pressure
      for (let i = 0; i < 8; i++) {
        const t = ((time * 0.4 + i * 0.13) % 1);
        const dx = Math.sin(i * 1.7) * 6 * s;
        const dy = -t * 22 * s;
        ctx.fillStyle = `rgba(180, 28, 48, ${(1 - t) * 0.7 * fade})`;
        ctx.fillRect(hx + dx, hy + dy + bob, Math.max(1, s), Math.max(1, s));
      }
      ctx.globalAlpha = 1;
    }

    function drawPlayer() {
      if (!ctx) return;
      // Tamara is shown from behind, foreground-bottom. Slight bob with step.
      const bob = player.step === 1 ? 1 : 0;
      const cx = VPX + player.lateral * 6;
      const baseY = H - 6;
      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx, baseY + 4, 14, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // legs
      ctx.fillStyle = "#1a1010";
      ctx.fillRect(cx - 6, baseY - 8 + bob, 4, 10);
      ctx.fillStyle = "#3a3a3a"; // peg leg
      ctx.fillRect(cx + 2, baseY - 8, 4, 10);
      // backpack hump
      ctx.fillStyle = "#1a1014";
      ctx.fillRect(cx - 9, baseY - 26 + bob, 18, 10);
      // torso (heavy suit, viewed from back)
      ctx.fillStyle = "#1c1018";
      ctx.fillRect(cx - 10, baseY - 22 + bob, 20, 16);
      ctx.fillStyle = "#2a1820";
      ctx.fillRect(cx - 10, baseY - 22 + bob, 20, 2);
      // shoulder pauldrons
      ctx.fillStyle = "#3a2018";
      ctx.fillRect(cx - 12, baseY - 21 + bob, 3, 6);
      ctx.fillRect(cx + 9, baseY - 21 + bob, 3, 6);
      // helmet (back of head)
      ctx.fillStyle = "#3a2418";
      ctx.fillRect(cx - 7, baseY - 32 + bob, 14, 10);
      ctx.fillStyle = "#0a0a0a"; // hood seam
      ctx.fillRect(cx - 7, baseY - 24 + bob, 14, 2);
      // tiny helmet light leak (rim light on top edge)
      ctx.fillStyle = "rgba(255, 230, 190, 0.35)";
      ctx.fillRect(cx - 5, baseY - 32 + bob, 10, 1);
    }

    function drawFog() {
      if (!ctx) return;
      // Distance mist that swallows the corridor — radial bloom near horizon
      const mg = ctx.createRadialGradient(VPX, HORIZON, 4, VPX, HORIZON, 130);
      mg.addColorStop(0, "rgba(60, 30, 40, 0.85)");
      mg.addColorStop(0.4, "rgba(30, 14, 20, 0.55)");
      mg.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);
      // Low-lying floor mist
      const fm = ctx.createLinearGradient(0, HORIZON, 0, H);
      fm.addColorStop(0, "rgba(30, 16, 22, 0.5)");
      fm.addColorStop(0.5, "rgba(20, 10, 16, 0.2)");
      fm.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = fm;
      ctx.fillRect(0, HORIZON, W, H - HORIZON);
    }

    function drawScanlines() {
      if (!ctx) return;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
      // soft chromatic bleed top/bottom
      ctx.fillStyle = "rgba(80, 0, 30, 0.18)";
      ctx.fillRect(0, 0, W, 10);
      ctx.fillStyle = "rgba(20, 0, 40, 0.15)";
      ctx.fillRect(0, H - 10, W, 10);
    }

    function render() {
      if (!ctx) return;
      // Sky/void
      const voidGrad = ctx.createLinearGradient(0, 0, 0, H);
      voidGrad.addColorStop(0, "#06030a");
      voidGrad.addColorStop(0.5, "#100610");
      voidGrad.addColorStop(1, "#06030a");
      ctx.fillStyle = voidGrad;
      ctx.fillRect(0, 0, W, H);

      drawWalls();
      drawFloor();
      drawPuddles();
      drawSconces();
      // Husk first (far), then nearer props sorted by depth
      drawHusk();
      drawProps();
      drawSilt();
      drawFog();
      drawPlayer();

      // Helmet light cone projected forward into the corridor
      const cone = ctx.createRadialGradient(VPX + player.lateral * 6, H - 20, 4, VPX + player.lateral * 6, HORIZON + 10, 120);
      cone.addColorStop(0, "rgba(255, 230, 190, 0.18)");
      cone.addColorStop(0.5, "rgba(220, 120, 90, 0.08)");
      cone.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = cone;
      ctx.fillRect(0, 0, W, H);

      // Vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 170);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      drawScanlines();

      // Hint near the husk
      if (!reachedRef.current) {
        const remaining = CORRIDOR_LEN - player.z;
        if (remaining < 8) {
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
