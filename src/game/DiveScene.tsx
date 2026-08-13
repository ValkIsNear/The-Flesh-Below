import { useEffect, useRef } from "react";
import { clang } from "./audio";

// Low-poly software-rendered 3D corridor — early Tomb Raider / PS1 look.
// Flat-shaded textured-ish polygons, chunky vertex fog, wobbly vertex snapping,
// third-person camera trailing Tamara through Sector Gamma-7.
type Props = { onReach: () => void };

const W = 480;
const H = 270;
const FOCAL = 300;
const CORRIDOR_LEN = 60;
const HALF_W = 2.6;
const CEIL = 3.2;
const FOG_NEAR = 6;
const FOG_FAR = 34;
const FOG = [22, 12, 16] as const;

type V3 = { x: number; y: number; z: number };
type Poly = { v: V3[]; c: [number, number, number]; light?: number };

function rgb(c: readonly number[], f: number) {
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;
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

    let seed = 7331;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    const player = { x: 0, z: 1.5, yaw: 0, step: 0 };
    const cam = { x: 0, y: 1.7, z: -1.6, yaw: 0 };

    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    // ---- static level geometry -------------------------------------------
    const level: Poly[] = [];
    const quad = (a: V3, b: V3, c: V3, d: V3, col: [number, number, number]) =>
      level.push({ v: [a, b, c, d], c: col });

    const SEG = 2;
    for (let z = 0; z < CORRIDOR_LEN; z += SEG) {
      const z2 = z + SEG;
      const t = (z / SEG) % 2;
      // floor plates
      const fl: [number, number, number] = t ? [58, 40, 38] : [48, 33, 32];
      quad({ x: -HALF_W, y: 0, z }, { x: HALF_W, y: 0, z }, { x: HALF_W, y: 0, z: z2 }, { x: -HALF_W, y: 0, z: z2 }, fl);
      // ceiling
      quad(
        { x: -HALF_W, y: CEIL, z },
        { x: -HALF_W, y: CEIL, z: z2 },
        { x: HALF_W, y: CEIL, z: z2 },
        { x: HALF_W, y: CEIL, z },
        t ? [30, 20, 26] : [24, 16, 22],
      );
      // walls: lower plate, mid band, upper plate (gives banded TR-style texture)
      for (const s of [-1, 1] as const) {
        const x = s * HALF_W;
        const bands: [number, number, [number, number, number]][] = [
          [0, 0.9, t ? [62, 42, 36] : [54, 36, 31]],
          [0.9, 1.25, [86, 52, 30]],
          [1.25, 2.3, t ? [50, 34, 34] : [44, 29, 30]],
          [2.3, CEIL, [34, 22, 26]],
        ];
        for (const [y0, y1, col] of bands) {
          quad({ x, y: y0, z }, { x, y: y1, z }, { x, y: y1, z: z2 }, { x, y: y0, z: z2 }, col);
        }
        // rib pillar every 4 units
        if ((z / SEG) % 2 === 0) {
          const xi = s * (HALF_W - 0.12);
          quad(
            { x: xi, y: 0, z: z + 0.3 },
            { x: xi, y: CEIL, z: z + 0.3 },
            { x: xi, y: CEIL, z: z + 0.65 },
            { x: xi, y: 0, z: z + 0.65 },
            [78, 50, 40],
          );
        }
      }
    }

    // props: boxes along the walls
    const box = (cx: number, cz: number, w: number, h: number, d: number, col: [number, number, number]) => {
      const x0 = cx - w / 2,
        x1 = cx + w / 2,
        z0 = cz - d / 2,
        z1 = cz + d / 2;
      const top: [number, number, number] = [col[0] * 1.25, col[1] * 1.25, col[2] * 1.25];
      const side: [number, number, number] = [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7];
      quad({ x: x0, y: h, z: z0 }, { x: x1, y: h, z: z0 }, { x: x1, y: h, z: z1 }, { x: x0, y: h, z: z1 }, top);
      quad({ x: x0, y: 0, z: z0 }, { x: x0, y: h, z: z0 }, { x: x1, y: h, z: z0 }, { x: x1, y: 0, z: z0 }, col);
      quad({ x: x1, y: 0, z: z1 }, { x: x1, y: h, z: z1 }, { x: x0, y: h, z: z1 }, { x: x0, y: 0, z: z1 }, col);
      quad({ x: x0, y: 0, z: z1 }, { x: x0, y: h, z: z1 }, { x: x0, y: h, z: z0 }, { x: x0, y: 0, z: z0 }, side);
      quad({ x: x1, y: 0, z: z0 }, { x: x1, y: h, z: z0 }, { x: x1, y: h, z: z1 }, { x: x1, y: 0, z: z1 }, side);
    };

    for (let z = 5; z < CORRIDOR_LEN - 6; z += 4 + rnd() * 5) {
      const s = rnd() > 0.5 ? -1 : 1;
      const r = rnd();
      const x = s * (HALF_W - 0.5 - rnd() * 0.3);
      if (r < 0.4) box(x, z, 0.9, 0.9, 0.9, [70, 46, 30]);
      else if (r < 0.7) box(x, z, 0.7, 1.2, 0.7, [58, 32, 28]);
      else box(x, z, 1.2, 0.7, 0.6, [40, 40, 48]);
    }

    // emergency lamps (billboarded glows in screen space)
    const lamps: { x: number; y: number; z: number; phase: number }[] = [];
    for (let z = 6; z < CORRIDOR_LEN; z += 8) {
      lamps.push({ x: (rnd() > 0.5 ? -1 : 1) * (HALF_W - 0.1), y: 2.4, z, phase: rnd() * 6.28 });
    }

    // ---- transform / raster ----------------------------------------------
    function toCam(p: V3): V3 {
      const dx = p.x - cam.x;
      const dz = p.z - cam.z;
      const c = Math.cos(-cam.yaw),
        s = Math.sin(-cam.yaw);
      return { x: dx * c - dz * s, y: p.y - cam.y, z: dx * s + dz * c };
    }
    const NEAR = 0.25;
    function clipNear(v: V3[]): V3[] {
      const out: V3[] = [];
      for (let i = 0; i < v.length; i++) {
        const a = v[i],
          b = v[(i + 1) % v.length];
        const ain = a.z >= NEAR,
          bin = b.z >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) {
          const t = (NEAR - a.z) / (b.z - a.z);
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
        }
      }
      return out;
    }
    function proj(p: V3) {
      // slight vertex snapping = PS1 jitter
      const sx = W / 2 + (p.x * FOCAL) / p.z;
      const sy = H * 0.42 - (p.y * FOCAL) / p.z;
      return { x: Math.round(sx * 0.75) / 0.75, y: Math.round(sy * 0.75) / 0.75 };
    }

    function drawPolys(polys: Poly[]) {
      if (!ctx) return;
      const list: { pts: { x: number; y: number }[]; depth: number; c: [number, number, number]; light: number }[] = [];
      for (const p of polys) {
        const cv = p.v.map(toCam);
        const clipped = clipNear(cv);
        if (clipped.length < 3) continue;
        let depth = 0;
        for (const v of clipped) depth += v.z;
        depth /= clipped.length;
        if (depth > FOG_FAR + 6) continue;
        list.push({ pts: clipped.map(proj), depth, c: p.c, light: p.light ?? 1 });
      }
      list.sort((a, b) => b.depth - a.depth);
      for (const q of list) {
        const fog = Math.min(1, Math.max(0, (q.depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        const l = q.light;
        const r = q.c[0] * l * (1 - fog) + FOG[0] * fog;
        const g = q.c[1] * l * (1 - fog) + FOG[1] * fog;
        const b = q.c[2] * l * (1 - fog) + FOG[2] * fog;
        ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
        ctx.beginPath();
        ctx.moveTo(q.pts[0].x, q.pts[0].y);
        for (let i = 1; i < q.pts.length; i++) ctx.lineTo(q.pts[i].x, q.pts[i].y);
        ctx.closePath();
        ctx.fill();
        // gouraud-ish seam so polys read as separate faces
        ctx.strokeStyle = `rgba(0,0,0,${0.25 * (1 - fog)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ---- characters as low-poly boxes -------------------------------------
    function charPolys(px: number, pz: number, yaw: number, bob: number, out: Poly[]) {
      const c = Math.cos(yaw),
        s = Math.sin(yaw);
      const put = (
        lx: number,
        y0: number,
        y1: number,
        lz: number,
        w: number,
        d: number,
        col: [number, number, number],
      ) => {
        const corners = [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ].map(([ox, oz]) => {
          const X = lx + ox,
            Z = lz + oz;
          return { x: px + X * c - Z * s, z: pz + X * s + Z * c };
        });
        const top: [number, number, number] = [col[0] * 1.3, col[1] * 1.3, col[2] * 1.3];
        out.push({
          v: corners.map((p) => ({ x: p.x, y: y1 + bob, z: p.z })),
          c: top,
        });
        for (let i = 0; i < 4; i++) {
          const a = corners[i],
            b = corners[(i + 1) % 4];
          const shade = i % 2 ? 0.72 : 1;
          out.push({
            v: [
              { x: a.x, y: y0 + bob, z: a.z },
              { x: a.x, y: y1 + bob, z: a.z },
              { x: b.x, y: y1 + bob, z: b.z },
              { x: b.x, y: y0 + bob, z: b.z },
            ],
            c: [col[0] * shade, col[1] * shade, col[2] * shade],
          });
        }
      };
      // legs
      put(-0.16, 0, 0.75, 0, 0.22, 0.24, [42, 30, 34]);
      put(0.16, 0, 0.75, 0, 0.2, 0.22, [70, 70, 78]); // hydraulic peg leg
      // torso / heavy suit
      put(0, 0.72, 1.5, 0, 0.62, 0.42, [64, 40, 46]);
      // backpack
      put(0, 0.95, 1.45, -0.3, 0.5, 0.26, [40, 26, 32]);
      // pauldrons
      put(-0.38, 1.15, 1.45, 0, 0.2, 0.34, [84, 52, 40]);
      put(0.38, 1.15, 1.45, 0, 0.2, 0.34, [84, 52, 40]);
      // helmet
      put(0, 1.5, 1.85, 0, 0.36, 0.36, [92, 60, 44]);
    }

    function huskPolys(out: Poly[], time: number) {
      const bob = Math.sin(time * 0.6) * 0.06;
      const px = 0,
        pz = CORRIDOR_LEN - 3;
      const put = (
        lx: number,
        y0: number,
        y1: number,
        lz: number,
        w: number,
        d: number,
        col: [number, number, number],
      ) => {
        const corners = [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ].map(([ox, oz]) => ({ x: px + lx + ox, z: pz + lz + oz }));
        out.push({ v: corners.map((p) => ({ x: p.x, y: y1 + bob, z: p.z })), c: [col[0] * 1.25, col[1] * 1.25, col[2] * 1.25] });
        for (let i = 0; i < 4; i++) {
          const a = corners[i],
            b = corners[(i + 1) % 4];
          const shade = i % 2 ? 0.7 : 1;
          out.push({
            v: [
              { x: a.x, y: y0 + bob, z: a.z },
              { x: a.x, y: y1 + bob, z: a.z },
              { x: b.x, y: y1 + bob, z: b.z },
              { x: b.x, y: y0 + bob, z: b.z },
            ],
            c: [col[0] * shade, col[1] * shade, col[2] * shade],
          });
        }
      };
      // hovering corpse, torso + ruptured chest + broken-wing arm + helmet
      put(0, 1.0, 1.9, 0, 0.55, 0.35, [46, 34, 40]);
      put(0, 1.3, 1.55, 0.19, 0.28, 0.05, [150, 26, 44]);
      put(-0.55, 1.55, 1.7, 0.05, 0.7, 0.16, [52, 34, 42]); // limp arm, wing-like
      put(-0.9, 1.15, 1.6, 0.05, 0.14, 0.14, [40, 26, 32]);
      put(0.42, 1.2, 1.7, 0, 0.16, 0.2, [52, 34, 42]);
      put(0, 1.9, 2.25, 0, 0.34, 0.34, [70, 34, 36]);
      // blood pool
      out.push({
        v: [
          { x: -0.9, y: 0.01, z: pz - 0.9 },
          { x: 0.9, y: 0.01, z: pz - 0.9 },
          { x: 0.9, y: 0.01, z: pz + 0.9 },
          { x: -0.9, y: 0.01, z: pz + 0.9 },
        ],
        c: [70, 12, 22],
      });
    }

    // floating blood droplets (screen-space dots projected from 3D)
    const drops = Array.from({ length: 26 }, () => ({
      x: (rnd() - 0.5) * 1.4,
      y: rnd() * 2,
      z: CORRIDOR_LEN - 3 + (rnd() - 0.5) * 1.2,
      v: 0.08 + rnd() * 0.2,
    }));

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let stepTimer = 0;

    function update(dt: number) {
      time += dt;
      let fwd = 0,
        turn = 0,
        strafe = 0;
      if (keys.has("arrowup") || keys.has("w")) fwd += 1;
      if (keys.has("arrowdown") || keys.has("s")) fwd -= 1;
      if (keys.has("arrowleft") || keys.has("a")) turn -= 1;
      if (keys.has("arrowright") || keys.has("d")) turn += 1;
      if (keys.has("q")) strafe -= 1;
      if (keys.has("e")) strafe += 1;

      player.yaw += turn * 1.8 * dt;
      const sp = 3.0;
      player.z += Math.cos(player.yaw) * fwd * sp * dt + Math.sin(player.yaw) * strafe * sp * 0.6 * dt;
      player.x += Math.sin(player.yaw) * fwd * sp * dt - Math.cos(player.yaw) * strafe * sp * 0.6 * dt;
      player.x = Math.max(-HALF_W + 0.6, Math.min(HALF_W - 0.6, player.x));
      player.z = Math.max(0.6, Math.min(CORRIDOR_LEN - 1.2, player.z));

      // camera trails behind player (Tomb Raider style chase cam)
      const tx = player.x - Math.sin(player.yaw) * 4.4;
      const tz = player.z - Math.cos(player.yaw) * 4.4;
      const k = Math.min(1, dt * 4.5);
      cam.x += (tx - cam.x) * k;
      cam.z += (tz - cam.z) * k;
      let dy = player.yaw - cam.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      cam.yaw += dy * Math.min(1, dt * 5);
      cam.y += (2.35 - cam.y) * k;

      const moving = fwd !== 0 || strafe !== 0;
      if (moving) {
        stepTimer += dt;
        const interval = player.step === 0 ? 0.4 : 0.62;
        if (stepTimer > interval) {
          stepTimer = 0;
          player.step = (player.step + 1) % 2;
          clang(player.step === 0 ? "step" : "hydraulic");
        }
      } else stepTimer = 0.28;

      for (const d of drops) {
        d.y += d.v * dt;
        if (d.y > 2.4) d.y = 0.1;
      }

      if (player.z > CORRIDOR_LEN - 6 && !reachedRef.current) {
        reachedRef.current = true;
        onReach();
      }
    }

    function render() {
      if (!ctx) return;
      ctx.fillStyle = `rgb(${FOG[0]},${FOG[1]},${FOG[2]})`;
      ctx.fillRect(0, 0, W, H);

      const dyn: Poly[] = [];
      huskPolys(dyn, time);
      const bob = Math.sin(time * 8) * 0.02 * (keys.size ? 1 : 0);
      charPolys(player.x, player.z, player.yaw, bob, dyn);
      drawPolys([...level, ...dyn]);

      // lamp glows
      for (const l of lamps) {
        const p = toCam({ x: l.x, y: l.y, z: l.z });
        if (p.z < 0.4) continue;
        const s = proj(p);
        const flick = 0.6 + 0.4 * Math.sin(time * 9 + l.phase);
        const fog = Math.min(1, Math.max(0, (p.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        const r = (260 / p.z) * (1 - fog);
        if (r < 1) continue;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        g.addColorStop(0, `rgba(255,90,80,${0.5 * flick * (1 - fog)})`);
        g.addColorStop(1, "rgba(255,60,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // floating blood droplets near the husk
      for (const d of drops) {
        const p = toCam(d);
        if (p.z < 0.5) continue;
        const s = proj(p);
        const size = Math.max(1, (6 / p.z) * 1.5);
        const fog = Math.min(1, Math.max(0, (p.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        ctx.fillStyle = `rgba(170,26,44,${0.8 * (1 - fog)})`;
        ctx.fillRect(s.x, s.y, size, size);
      }

      // volumetric mist bands
      const mg = ctx.createLinearGradient(0, H * 0.25, 0, H);
      mg.addColorStop(0, "rgba(40,22,30,0.45)");
      mg.addColorStop(0.5, "rgba(28,15,22,0.22)");
      mg.addColorStop(1, "rgba(18,10,14,0.35)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);

      // vignette
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.7)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      if (!reachedRef.current && CORRIDOR_LEN - player.z < 12) {
        ctx.fillStyle = "rgba(225,205,205,0.85)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Nešto pluta napred…", W / 2, H - 18);
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
