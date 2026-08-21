import { useEffect, useRef, useState } from "react";
import { clang, softChime } from "./audio";

// First-person, texture-mapped software 3D — PS1 / Tomb Raider era look.
// The whole maintenance tunnel of Gamma-7 is flooded: heavy water tint,
// suspended silt, and things drifting in the dark that used to be people.
type Props = { onReach: () => void };

const W = 480;
const H = 270;
const FOCAL = 300;
const CORRIDOR_LEN = 96;
const HALF_W = 2.6;
const CEIL = 3.2;
const FOG_NEAR = 2;
const FOG_FAR = 16;
const FOG = [4, 5, 8] as const;

type V3 = { x: number; y: number; z: number; u?: number; w?: number };
type Poly = { v: V3[]; tex?: HTMLCanvasElement; c?: [number, number, number]; shade?: number };

export default function DiveScene({ onReach }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reachedRef = useRef(false);
  const [log, setLog] = useState<{ line: string; sub: string } | null>(null);
  const [logOn, setLogOn] = useState(false);


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

    // ---- procedural PS1-ish textures (64x64) -----------------------------
    function makeTex(draw: (c: CanvasRenderingContext2D) => void) {
      const t = document.createElement("canvas");
      t.width = 64;
      t.height = 64;
      const c = t.getContext("2d")!;
      c.imageSmoothingEnabled = false;
      draw(c);
      return t;
    }
    const grain = (c: CanvasRenderingContext2D, amt: number) => {
      for (let i = 0; i < 900; i++) {
        const x = Math.floor(rnd() * 64);
        const y = Math.floor(rnd() * 64);
        const g = 120 + rnd() * 90;
        c.fillStyle = `rgba(${g},${g * 0.72},${g * 0.6},${rnd() * amt * 0.45})`;
        c.fillRect(x, y, 1 + (rnd() > 0.85 ? 1 : 0), 1);
      }
    };
    const texFloor = makeTex((c) => {
      c.fillStyle = "#4a3330";
      c.fillRect(0, 0, 64, 64);
      for (let y = 0; y < 64; y += 32)
        for (let x = 0; x < 64; x += 32) {
          c.fillStyle = "#5a3d36";
          c.fillRect(x + 2, y + 2, 28, 28);
          c.fillStyle = "rgba(0,0,0,0.45)";
          c.fillRect(x, y, 64 > 0 ? 2 : 0, 32);
          c.fillRect(x, y, 32, 2);
          c.fillStyle = "rgba(120,80,60,0.25)";
          c.fillRect(x + 4, y + 4, 24, 2);
        }
      grain(c, 0.35);
    });
    const texWall = makeTex((c) => {
      c.fillStyle = "#4b3230";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#583a34";
      c.fillRect(3, 3, 58, 26);
      c.fillStyle = "#422b2b";
      c.fillRect(3, 34, 58, 26);
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(0, 30, 64, 3);
      // rivets
      c.fillStyle = "#7d5540";
      for (let x = 6; x < 60; x += 12) {
        c.fillRect(x, 6, 2, 2);
        c.fillRect(x, 55, 2, 2);
      }
      // rust streaks
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(rnd() * 64);
        c.fillStyle = `rgba(90,45,25,${0.15 + rnd() * 0.3})`;
        c.fillRect(x, Math.floor(rnd() * 30), 1 + Math.floor(rnd() * 2), 20 + Math.floor(rnd() * 30));
      }
      grain(c, 0.3);
    });
    const texBand = makeTex((c) => {
      c.fillStyle = "#6b4a1c";
      c.fillRect(0, 0, 64, 64);
      for (let i = -64; i < 64; i += 12) {
        c.fillStyle = "#2a1c10";
        c.beginPath();
        c.moveTo(i, 0);
        c.lineTo(i + 6, 0);
        c.lineTo(i + 6 + 20, 64);
        c.lineTo(i + 20, 64);
        c.closePath();
        c.fill();
      }
      grain(c, 0.4);
    });
    const texCeil = makeTex((c) => {
      c.fillStyle = "#2a1d24";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#20161c";
      c.fillRect(0, 26, 64, 12);
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(0, 0, 64, 2);
      grain(c, 0.25);
    });
    const texCrate = makeTex((c) => {
      c.fillStyle = "#6a4620";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#4a2f16";
      c.fillRect(4, 4, 56, 56);
      c.fillStyle = "#83592a";
      c.fillRect(8, 8, 48, 6);
      c.fillRect(8, 50, 48, 6);
      grain(c, 0.35);
    });
    const texMeat = makeTex((c) => {
      c.fillStyle = "#4a1a24";
      c.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 120; i++) {
        c.fillStyle = `rgba(${120 + rnd() * 110},${10 + rnd() * 30},${30 + rnd() * 30},${0.3 + rnd() * 0.5})`;
        c.fillRect(rnd() * 64, rnd() * 64, 1 + rnd() * 4, 1 + rnd() * 3);
      }
    });
    const texSuit = makeTex((c) => {
      c.fillStyle = "#3a2830";
      c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#4a3440";
      c.fillRect(2, 2, 60, 28);
      c.fillStyle = "#241820";
      c.fillRect(0, 32, 64, 6);
      grain(c, 0.25);
    });

    // ---- level -----------------------------------------------------------
    const level: Poly[] = [];
    const quad = (a: V3, b: V3, c: V3, d: V3, tex: HTMLCanvasElement, shade = 1) => {
      level.push({
        v: [
          { ...a, u: 0, w: 0 },
          { ...b, u: 1, w: 0 },
          { ...c, u: 1, w: 1 },
          { ...d, u: 0, w: 1 },
        ],
        tex,
        shade,
      });
    };

    const SEG = 2;
    for (let z = 0; z < CORRIDOR_LEN; z += SEG) {
      const z2 = z + SEG;
      quad({ x: -HALF_W, y: 0, z }, { x: HALF_W, y: 0, z }, { x: HALF_W, y: 0, z: z2 }, { x: -HALF_W, y: 0, z: z2 }, texFloor, 0.95);
      quad({ x: -HALF_W, y: CEIL, z }, { x: -HALF_W, y: CEIL, z: z2 }, { x: HALF_W, y: CEIL, z: z2 }, { x: HALF_W, y: CEIL, z }, texCeil, 0.55);
      for (const s of [-1, 1] as const) {
        const x = s * HALF_W;
        const shade = s < 0 ? 0.85 : 1;
        quad({ x, y: 0, z }, { x, y: 1.1, z }, { x, y: 1.1, z: z2 }, { x, y: 0, z: z2 }, texWall, shade * 0.9);
        quad({ x, y: 1.1, z }, { x, y: 1.45, z }, { x, y: 1.45, z: z2 }, { x, y: 1.1, z: z2 }, texBand, shade);
        quad({ x, y: 1.45, z }, { x, y: CEIL, z }, { x, y: CEIL, z: z2 }, { x, y: 1.45, z: z2 }, texWall, shade * 0.8);
      }
    }
    // far wall behind the husk
    quad(
      { x: -HALF_W, y: 0, z: CORRIDOR_LEN },
      { x: -HALF_W, y: CEIL, z: CORRIDOR_LEN },
      { x: HALF_W, y: CEIL, z: CORRIDOR_LEN },
      { x: HALF_W, y: 0, z: CORRIDOR_LEN },
      texMeat,
      0.8,
    );

    const boxInto = (
      out: Poly[],
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      d: number,
      tex: HTMLCanvasElement,
    ) => {
      const x0 = cx - w / 2,
        x1 = cx + w / 2,
        z0 = cz - d / 2,
        z1 = cz + d / 2,
        y0 = cy,
        y1 = cy + h;
      const f = (a: V3, b: V3, c: V3, dd: V3, shade: number) =>
        out.push({
          v: [
            { ...a, u: 0, w: 0 },
            { ...b, u: 1, w: 0 },
            { ...c, u: 1, w: 1 },
            { ...dd, u: 0, w: 1 },
          ],
          tex,
          shade,
        });
      f({ x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }, 1.25);
      f({ x: x0, y: y0, z: z0 }, { x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y0, z: z0 }, 1);
      f({ x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }, { x: x0, y: y0, z: z1 }, 0.85);
      f({ x: x0, y: y0, z: z1 }, { x: x0, y: y1, z: z1 }, { x: x0, y: y1, z: z0 }, { x: x0, y: y0, z: z0 }, 0.7);
      f({ x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y0, z: z1 }, 0.75);
    };

    for (let z = 5; z < CORRIDOR_LEN - 6; z += 4 + rnd() * 5) {
      const s = rnd() > 0.5 ? -1 : 1;
      const x = s * (HALF_W - 0.55 - rnd() * 0.3);
      const r = rnd();
      if (r < 0.45) boxInto(level, x, 0, z, 0.95, 0.95, 0.95, texCrate);
      else if (r < 0.75) boxInto(level, x, 0, z, 0.7, 1.25, 0.7, texWall);
      else boxInto(level, x, 0, z, 1.2, 0.65, 0.7, texSuit);
    }

    const lamps: { x: number; y: number; z: number; phase: number }[] = [];
    for (let z = 6; z < CORRIDOR_LEN; z += 7) {
      lamps.push({ x: (rnd() > 0.5 ? -1 : 1) * (HALF_W - 0.12), y: 2.5, z, phase: rnd() * 6.28 });
    }

    // ---- drifting remains --------------------------------------------------
    type Body = {
      x: number;
      y: number;
      z: number;
      kind: "arm" | "leg" | "torso";
      phase: number;
      seen: boolean;
      line: string;
      sub: string;
    };
    const bodies: Body[] = [
      {
        x: -1.4,
        y: 1.25,
        z: 17,
        kind: "arm",
        phase: 0.4,
        seen: false,
        line: "Jebote—",
        sub: "An arm, snapped open like a broken wing. Black threads grow out of the tear, jointed wrong, and something yellow blinks along them when my lamp gets close.",
      },
      {
        x: 1.45,
        y: 1.3,
        z: 41,
        kind: "arm",
        phase: 2.1,
        seen: false,
        line: "Ne gledaj.",
        sub: "Another arm, and the same black roots. They twitch toward the light. This is not decay — it is a tumor, and it is growing itself a body out of ours.",
      },
      {
        x: -1.25,
        y: 1.5,
        z: 68,
        kind: "torso",
        phase: 4.4,
        seen: false,
        line: "Tumor. Mora da se istera.",
        sub: "The torso is the nest. The tendrils pulse in time with the yellow lights, learning a rhythm. It has to be driven out of the sector before it learns a voice.",
      },
    ];
    // legs she walks past without a second look — no focus, no log
    const strays: Body[] = [
      { x: 1.3, y: 1.05, z: 27, kind: "leg", phase: 1.1, seen: true, line: "", sub: "" },
      { x: -1.5, y: 0.95, z: 53, kind: "leg", phase: 3.4, seen: true, line: "", sub: "" },
      { x: 1.35, y: 1.15, z: 79, kind: "leg", phase: 5.2, seen: true, line: "", sub: "" },
    ];

    // black jointed tendrils with glimmering yellow nodes, one bundle per part
    const tendrils = bodies.flatMap((b) =>
      Array.from({ length: 5 }, (_, i) => {
        const joints = Array.from({ length: 5 }, (_, j) => ({
          ox: (rnd() - 0.5) * 0.5 * (j + 1),
          oy: (rnd() - 0.5) * 0.45 * (j + 1),
          oz: (rnd() - 0.5) * 0.5 * (j + 1),
          ph: rnd() * 6.28,
        }));
        return { b, i, joints, node: 1 + ((rnd() * 3) | 0), ph: rnd() * 6.28 };
      }),
    );

    // rotated box — lets limbs hang at wrong, sickening angles
    const boxRot = (
      out: Poly[],
      cx: number,
      cy: number,
      cz: number,
      w: number,
      h: number,
      d: number,
      rx: number,
      ry: number,
      rz: number,
      tex: HTMLCanvasElement,
    ) => {
      const cxr = Math.cos(rx), sxr = Math.sin(rx);
      const cyr = Math.cos(ry), syr = Math.sin(ry);
      const czr = Math.cos(rz), szr = Math.sin(rz);
      const P = (lx: number, ly: number, lz: number): V3 => {
        // Z then X then Y
        let x = lx * czr - ly * szr;
        let y = lx * szr + ly * czr;
        let z = lz;
        const y2 = y * cxr - z * sxr;
        const z2 = y * sxr + z * cxr;
        y = y2;
        z = z2;
        const x2 = x * cyr + z * syr;
        const z3 = -x * syr + z * cyr;
        x = x2;
        z = z3;
        return { x: cx + x, y: cy + y, z: cz + z };
      };
      const hw = w / 2, hh = h / 2, hd = d / 2;
      const c = [
        P(-hw, -hh, -hd), P(hw, -hh, -hd), P(hw, hh, -hd), P(-hw, hh, -hd),
        P(-hw, -hh, hd), P(hw, -hh, hd), P(hw, hh, hd), P(-hw, hh, hd),
      ];
      const f = (a: V3, b: V3, cc: V3, dd: V3, shade: number) =>
        out.push({
          v: [
            { ...a, u: 0, w: 0 },
            { ...b, u: 1, w: 0 },
            { ...cc, u: 1, w: 1 },
            { ...dd, u: 0, w: 1 },
          ],
          tex,
          shade,
        });
      f(c[3], c[2], c[6], c[7], 1.25); // top
      f(c[0], c[3], c[2], c[1], 1); // front
      f(c[5], c[6], c[7], c[4], 0.85); // back
      f(c[4], c[7], c[3], c[0], 0.7); // left
      f(c[1], c[2], c[6], c[5], 0.75); // right
      f(c[0], c[1], c[5], c[4], 0.6); // bottom
    };

    // a hand: palm + four fingers + thumb, splayed and half-curled
    const handInto = (
      out: Poly[],
      hx: number,
      hy: number,
      hz: number,
      rx: number,
      ry: number,
      rz: number,
      t: number,
      ph: number,
    ) => {
      boxRot(out, hx, hy, hz, 0.17, 0.05, 0.15, rx, ry, rz, texMeat);
      for (let i = 0; i < 4; i++) {
        const spread = (i - 1.5) * 0.045;
        const curl = 0.5 + Math.sin(t * 0.4 + ph + i) * 0.12 + i * 0.1;
        const fx = hx + Math.cos(ry) * spread;
        const fz = hz - Math.sin(ry) * spread;
        // proximal segment
        boxRot(out, fx + Math.sin(ry) * 0.09, hy - 0.02, fz + Math.cos(ry) * 0.09, 0.032, 0.032, 0.11, rx, ry, rz, texMeat);
        // curled tip
        boxRot(
          out,
          fx + Math.sin(ry) * 0.16,
          hy - 0.02 - Math.sin(curl) * 0.06,
          fz + Math.cos(ry) * 0.16,
          0.03,
          0.03,
          0.08,
          rx + curl,
          ry,
          rz,
          texMeat,
        );
      }
      // thumb, bent the wrong way
      boxRot(out, hx - Math.cos(ry) * 0.1, hy + 0.01, hz + Math.sin(ry) * 0.1, 0.09, 0.035, 0.035, rx, ry - 0.9, rz + 0.5, texMeat);
    };

    function bodyPolys(out: Poly[], b: Body, t: number) {
      const yy = b.y + Math.sin(t * 0.5 + b.phase) * 0.09;
      const sway = Math.sin(t * 0.33 + b.phase) * 0.06;
      const roll = Math.sin(t * 0.21 + b.phase) * 0.05;
      const turn = t * 0.09 + b.phase;
      const x = b.x + sway;
      if (b.kind === "arm") {
        // upper arm, canted down and slowly rotating on its own axis
        boxRot(out, x, yy, b.z, 0.58, 0.14, 0.14, 0.1 + roll, 0.35 + turn * 0.4, -0.55 + roll, texSuit);
        // forearm hinged the wrong way at the elbow
        boxRot(out, x + 0.32, yy - 0.3, b.z + 0.06, 0.4, 0.12, 0.12, -0.25, 0.2, 1.9 + roll, texMeat);
        // torn shoulder stump, split bone jutting out of it
        boxRot(out, x - 0.32, yy + 0.16, b.z, 0.16, 0.2, 0.16, 0.3, 0.5, 0.4, texMeat);
        boxRot(out, x - 0.5, yy + 0.3, b.z - 0.03, 0.22, 0.05, 0.05, 0.5, 0.9, 1.15, texCrate);
        // strips of skin trailing off the tear, drifting in the current
        for (let i = 0; i < 3; i++) {
          const f = Math.sin(t * 0.7 + b.phase + i * 1.3) * 0.35;
          boxRot(
            out,
            x - 0.46 - i * 0.05,
            yy + 0.24 - i * 0.09,
            b.z + 0.05 + i * 0.06,
            0.2,
            0.015,
            0.09,
            0.2 + f,
            0.6 + f * 0.8,
            1.4 + f,
            texMeat,
          );
        }
        handInto(out, x + 0.46, yy - 0.5, b.z + 0.08, 0.6, 0.4 + roll, 1.8, t, b.phase);
      } else if (b.kind === "leg") {
        // thigh, tilted across the current
        boxRot(out, x, yy + 0.2, b.z, 0.18, 0.62, 0.18, 0.2, 0.3 + turn * 0.3, 0.42 + roll, texSuit);
        // shin folded at an impossible knee angle
        boxRot(out, x + 0.3, yy - 0.22, b.z + 0.05, 0.16, 0.5, 0.16, -0.35, 0.2, -1.45 + roll, texSuit);
        // the boot, twisted a half turn from where the knee points
        boxRot(out, x + 0.5, yy - 0.52, b.z + 0.16, 0.22, 0.15, 0.32, -0.4, 2.4, -0.9, texCrate);
        // hip socket, torn open — femur head still in it
        boxRot(out, x - 0.1, yy + 0.54, b.z, 0.22, 0.16, 0.22, 0.25, 0.3, 0.5, texMeat);
        boxRot(out, x - 0.16, yy + 0.68, b.z + 0.02, 0.1, 0.1, 0.1, 0.4, 0.7, 0.3, texCrate);
        for (let i = 0; i < 3; i++) {
          const f = Math.sin(t * 0.6 + b.phase + i) * 0.4;
          boxRot(out, x - 0.14 + i * 0.05, yy + 0.74 + i * 0.07, b.z - 0.04, 0.13, 0.014, 0.07, f, 0.5 + f, 1.1 + f, texMeat);
        }
      } else {
        // torso turning on its own axis
        boxRot(out, x, yy, b.z, 0.5, 0.64, 0.32, 0.28, turn * 1.4, 0.35 + roll, texSuit);
        // chest cavity opened up, ribs splayed outward like a cage pulled apart
        boxRot(out, x + 0.08, yy + 0.16, b.z + 0.18, 0.28, 0.28, 0.06, 0.28, turn * 1.4, 0.35, texMeat);
        for (let i = 0; i < 4; i++) {
          const a = turn * 1.4;
          const rib = 0.18 - i * 0.12;
          boxRot(
            out,
            x + 0.08 + Math.cos(a) * 0.26,
            yy + rib,
            b.z + 0.18 + Math.sin(a) * 0.1,
            0.05,
            0.03,
            0.24,
            0.1,
            a + 0.4,
            0.5 + i * 0.12,
            texCrate,
          );
        }
        // something soft still hanging out of the cavity
        boxRot(out, x + 0.16, yy - 0.06, b.z + 0.28, 0.12, 0.16, 0.12, Math.sin(t * 0.5) * 0.3, turn, 0.2, texMeat);
        // one arm still attached, wrenched back the wrong way — with a hand
        boxRot(out, x - 0.38, yy + 0.24, b.z - 0.04, 0.42, 0.12, 0.12, 0.2, -0.4, 1.6 + roll, texMeat);
        handInto(out, x - 0.62, yy + 0.06, b.z - 0.1, 0.4, -0.6, 1.5, t, b.phase + 1.7);
        // stump of the second leg, sheared at the thigh
        boxRot(out, x + 0.3, yy - 0.3, b.z, 0.14, 0.3, 0.14, 0.4, 0.3, -0.6, texMeat);
        boxRot(out, x + 0.34, yy - 0.5, b.z + 0.02, 0.08, 0.09, 0.08, 0.2, 0.4, -0.4, texCrate);
      }
    }

    // blood suspended around the remains — thinned out, dissolving into the water
    const gore = bodies.flatMap((b) =>
      Array.from({ length: 64 }, () => {
        const far = rnd();
        return {
          b,
          ox: (rnd() - 0.5) * (1.1 + far * 2.6),
          oy: (rnd() - 0.5) * (1.0 + far * 2.0),
          oz: (rnd() - 0.5) * (1.1 + far * 2.6),
          v: 0.01 + rnd() * 0.05,
          ph: rnd() * 6.28,
          s: 0.7 + rnd() * 2.6,
          // further from the body = more diluted
          a: 0.5 * (1 - far * 0.82),
        };
      }),
    );

    const silt = Array.from({ length: 90 }, () => ({
      x: (rnd() - 0.5) * 5,
      y: rnd() * CEIL,
      z: rnd() * CORRIDOR_LEN,
      v: 0.05 + rnd() * 0.12,
      s: 0.6 + rnd() * 0.9,
    }));



    // ---- camera / input ---------------------------------------------------
    const cam = { x: 0, y: 1.62, z: 1.5, yaw: 0, bob: 0 };
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onMouse = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) cam.yaw += e.movementX * 0.0022;
    };
    const onClick = () => canvas.requestPointerLock?.();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("mousemove", onMouse);
    canvas.addEventListener("click", onClick);

    function toCam(p: V3): V3 {
      const dx = p.x - cam.x;
      const dz = p.z - cam.z;
      const c = Math.cos(-cam.yaw),
        s = Math.sin(-cam.yaw);
      // negate x: yaw convention is left-handed, otherwise the world mirrors
      // and forced looks snap to the opposite side of the corridor
      return { x: -(dx * c - dz * s), y: p.y - (cam.y + cam.bob), z: dx * s + dz * c, u: p.u, w: p.w };
    }
    const NEAR = 0.2;
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
          out.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: NEAR,
            u: (a.u ?? 0) + ((b.u ?? 0) - (a.u ?? 0)) * t,
            w: (a.w ?? 0) + ((b.w ?? 0) - (a.w ?? 0)) * t,
          });
        }
      }
      return out;
    }
    function proj(p: V3) {
      const sx = W / 2 + (p.x * FOCAL) / p.z;
      const sy = H / 2 - (p.y * FOCAL) / p.z;
      // PS1 vertex snapping
      return { x: Math.round(sx * 0.8) / 0.8, y: Math.round(sy * 0.8) / 0.8, u: p.u ?? 0, w: p.w ?? 0, z: p.z };
    }

    type SP = { x: number; y: number; u: number; w: number; z: number };
    function drawTexTri(a: SP, b: SP, c: SP, tex: HTMLCanvasElement, tint: string) {
      if (!ctx) return;
      const TS = tex.width;
      const u0 = a.u * TS,
        v0 = a.w * TS,
        u1 = b.u * TS,
        v1 = b.w * TS,
        u2 = c.u * TS,
        v2 = c.w * TS;
      const den = u0 * (v2 - v1) - u1 * v2 + u2 * v1 + (u1 - u2) * v0;
      if (den === 0) return;
      const m11 = -(v0 * (c.x - b.x) - v1 * c.x + v2 * b.x + (v1 - v2) * a.x) / den;
      const m12 = (v1 * c.y + v0 * (b.y - c.y) - v2 * b.y + (v2 - v1) * a.y) / den;
      const m21 = (u0 * (c.x - b.x) - u1 * c.x + u2 * b.x + (u1 - u2) * a.x) / den;
      const m22 = -(u1 * c.y + u0 * (b.y - c.y) - u2 * b.y + (u2 - u1) * a.y) / den;
      const dx = (u0 * (v2 * b.x - v1 * c.x) + v0 * (u1 * c.x - u2 * b.x) + (u2 * v1 - u1 * v2) * a.x) / den;
      const dy = (u0 * (v2 * b.y - v1 * c.y) + v0 * (u1 * c.y - u2 * b.y) + (u2 * v1 - u1 * v2) * a.y) / den;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.clip();
      ctx.transform(m11, m12, m21, m22, dx, dy);
      ctx.drawImage(tex, 0, 0);
      ctx.restore();
      // shade + fog pass over the same triangle
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fill();
    }

    function drawPolys(polys: Poly[]) {
      if (!ctx) return;
      const list: { pts: SP[]; depth: number; p: Poly }[] = [];
      for (const p of polys) {
        const clipped = clipNear(p.v.map(toCam));
        if (clipped.length < 3) continue;
        let depth = 0;
        for (const v of clipped) depth += v.z;
        depth /= clipped.length;
        if (depth > FOG_FAR + 8) continue;
        list.push({ pts: clipped.map(proj), depth, p });
      }
      list.sort((a, b) => b.depth - a.depth);
      for (const q of list) {
        const fog = Math.min(1, Math.max(0, (q.depth - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        const shade = q.p.shade ?? 1;
        if (q.p.tex) {
          // darkness from shading + fog, painted as an overlay
          const dark = Math.max(0, 1 - shade * (1 - fog * 0.15));
          const tint = `rgba(${FOG[0]},${FOG[1]},${FOG[2]},${Math.min(0.97, fog * 0.95 + dark * 0.5)})`;
          for (let i = 1; i < q.pts.length - 1; i++) drawTexTri(q.pts[0], q.pts[i], q.pts[i + 1], q.p.tex, tint);
        } else {
          const c = q.p.c ?? [80, 40, 50];
          const r = c[0] * shade * (1 - fog) + FOG[0] * fog;
          const g = c[1] * shade * (1 - fog) + FOG[1] * fog;
          const b = c[2] * shade * (1 - fog) + FOG[2] * fog;
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.beginPath();
          ctx.moveTo(q.pts[0].x, q.pts[0].y);
          for (let i = 1; i < q.pts.length; i++) ctx.lineTo(q.pts[i].x, q.pts[i].y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    // ---- the head at the end of the corridor -------------------------------
    function huskPolys(out: Poly[], time: number) {
      const bob = Math.sin(time * 0.6) * 0.05;
      const pz = CORRIDOR_LEN - 3.5;
      const turn = Math.sin(time * 0.15) * 0.5;
      // a helmeted head alone in the water, slowly rotating to face the light
      boxRot(out, 0, 1.55 + bob, pz, 0.34, 0.36, 0.34, 0.12, turn, 0.1, texCrate);
      boxRot(out, 0, 1.53 + bob, pz - 0.18, 0.22, 0.16, 0.04, 0.12, turn, 0.1, texMeat); // shattered visor
      boxRot(out, 0, 1.33 + bob, pz + 0.02, 0.18, 0.12, 0.18, 0.2, turn, 0.3, texMeat); // torn neck
      for (let i = 0; i < 4; i++) {
        const f = Math.sin(time * 0.6 + i * 1.4) * 0.4;
        boxRot(out, (i - 1.5) * 0.05, 1.24 + bob - i * 0.03, pz + 0.03, 0.12, 0.014, 0.07, f, 0.4 + f, 1.1 + f, texMeat);
      }
    }


    const drops = Array.from({ length: 30 }, () => ({
      x: (rnd() - 0.5) * 1.6,
      y: rnd() * 2.2,
      z: CORRIDOR_LEN - 3.5 + (rnd() - 0.5) * 1.4,
      v: 0.08 + rnd() * 0.2,
    }));

    let raf = 0;
    let last = performance.now();
    let time = 0;
    let stepTimer = 0;
    let stepFlip = 0;
    let walkPhase = 0;
    let focusT = 0; // seconds left of the forced look
    let focusYaw = 0;
    let focusTarget: (typeof bodies)[number] | null = null;
    let focusHold = 0;


    let returnYaw = 0; // where the camera was before the forced look
    let returnT = 0; // seconds left of easing back
    let logTimer = 0;
    let logClear = 0; // seconds left before unmounting the faded-out block

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

      // notice the remains only once we are right next to them
      for (const b of bodies) {
        if (b.seen) continue;
        const dx = b.x - cam.x;
        const dz = b.z - cam.z;
        if (dz > -0.4 && dx * dx + dz * dz < 3.2 * 3.2) {
          b.seen = true;
          (b as any).locked = true;
          focusTarget = b;
          focusHold = 2.4;
          returnYaw = cam.yaw;
          focusT = 0;
          returnT = 0;
          logTimer = 8;
          logClear = 0;
          setLog({ line: b.line, sub: b.sub });
          setLogOn(true);
          softChime();

        }
      }

      if (focusTarget) {
        const dx = focusTarget.x - cam.x;
        const dz = focusTarget.z - cam.z;
        // The renderer mirrors camera-space X, so the look yaw must use the
        // opposite horizontal sign to center the actual body on screen.
        focusYaw = Math.atan2(-dx, dz);
        // freeze the player while the remains hold her attention
        turn = 0;
        fwd = 0;
        strafe = 0;
        let d = focusYaw - cam.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        cam.yaw += d * Math.min(1, dt * 4.5);
        focusHold -= dt;
        if (focusHold <= 0) {
          focusTarget = null;
          returnT = 1.1;
        }
      } else if (returnT > 0) {

        returnT -= dt;
        turn = 0;
        let d = returnYaw - cam.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        cam.yaw += d * Math.min(1, dt * 4);
        if (returnT <= 0) cam.yaw = returnYaw;
      }

      cam.yaw += turn * 1.7 * dt;
      const sp = 2.7;
      // The renderer mirrors camera-space X, so world X motion is negated to
      // keep W walking toward whatever the player is actually looking at.
      cam.z += Math.cos(cam.yaw) * fwd * sp * dt - Math.sin(cam.yaw) * strafe * sp * 0.7 * dt;
      cam.x += -Math.sin(cam.yaw) * fwd * sp * dt - Math.cos(cam.yaw) * strafe * sp * 0.7 * dt;

      cam.x = Math.max(-HALF_W + 0.5, Math.min(HALF_W - 0.5, cam.x));
      cam.z = Math.max(0.7, Math.min(CORRIDOR_LEN - 1.6, cam.z));

      const moving = fwd !== 0 || strafe !== 0;
      if (moving) {
        walkPhase += dt * 5.4;
        cam.bob = Math.sin(walkPhase) * 0.045;
        stepTimer += dt;
        const interval = stepFlip === 0 ? 0.4 : 0.62;
        if (stepTimer > interval) {
          stepTimer = 0;
          stepFlip = (stepFlip + 1) % 2;
          clang(stepFlip === 0 ? "step" : "hydraulic");
        }
      } else {
        cam.bob += (0 - cam.bob) * Math.min(1, dt * 5);
        stepTimer = 0.28;
      }

      if (logTimer > 0) {
        logTimer -= dt;
        if (logTimer <= 0) {
          setLogOn(false); // starts the slow CSS fade
          logClear = 2.4;
        }
      } else if (logClear > 0) {
        logClear -= dt;
        if (logClear <= 0) setLog(null);
      }

      for (const d of drops) {
        d.y += d.v * dt;
        if (d.y > 2.4) d.y = 0.1;
      }
      for (const s of silt) {
        s.y += s.v * dt;
        s.x += Math.sin(time * 0.2 + s.z) * 0.04 * dt;
        if (s.y > CEIL) {
          s.y = 0.05;
          s.z = cam.z + (rnd() - 0.2) * 30;
        }
      }

      if (cam.z > CORRIDOR_LEN - 7 && !reachedRef.current) {
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
      for (const b of bodies) bodyPolys(dyn, b, time);
      for (const s of strays) bodyPolys(dyn, s, time);
      drawPolys([...level, ...dyn]);

      // black tendrils growing out of the remains, with glimmering yellow nodes
      for (const t of tendrils) {
        const b = t.b;
        const dz = b.z - cam.z;
        const dxx = b.x - cam.x;
        const dist = Math.sqrt(dxx * dxx + dz * dz);
        const near = Math.max(0, Math.min(1, (14 - dist) / 12));
        if (near <= 0) continue;
        const pts: { x: number; y: number; z: number }[] = [];
        let ax = b.x,
          ay = b.y,
          az = b.z;
        for (let j = 0; j < t.joints.length; j++) {
          const jt = t.joints[j];
          const wob = Math.sin(time * 0.9 + jt.ph + j) * 0.06 * (j + 1) * 0.35;
          ax += jt.ox * 0.5 + wob;
          ay += jt.oy * 0.5 + Math.cos(time * 0.7 + jt.ph) * 0.03 * (j + 1) * 0.3;
          az += jt.oz * 0.5;
          const p = toCam({ x: ax, y: ay, z: az });
          if (p.z < 0.4) break;
          const s = proj(p);
          pts.push({ x: s.x, y: s.y, z: p.z });
        }
        if (pts.length < 2) continue;
        const fog = Math.min(1, Math.max(0, (pts[0].z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        if (fog >= 1) continue;
        ctx.strokeStyle = `rgba(6,4,8,${(0.55 + near * 0.45) * (1 - fog)})`;
        ctx.lineWidth = Math.max(1, 3 / Math.max(1, pts[0].z * 0.5));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        // yellow nodes flickering harder the closer she gets
        for (let n = 0; n < t.node; n++) {
          const p = pts[Math.min(pts.length - 1, 1 + n * 2)];
          const glim = 0.35 + 0.65 * Math.abs(Math.sin(time * (1.6 + near * 3) + t.ph + n));
          const a = glim * near * (1 - fog);
          const r = Math.max(1.2, (5 / p.z) * (0.7 + near));
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
          g.addColorStop(0, `rgba(255,214,90,${Math.min(1, a)})`);
          g.addColorStop(1, "rgba(255,180,40,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,240,170,${Math.min(1, a)})`;
          ctx.fillRect(p.x - r * 0.3, p.y - r * 0.3, r * 0.6, r * 0.6);
        }
      }



      // suspended blood around the remains
      for (const g of gore) {
        const drift = Math.sin(time * 0.4 + g.ph) * 0.12;
        const p = toCam({
          x: g.b.x + g.ox + drift,
          y: g.b.y + g.oy + ((time * g.v) % 1.2) - 0.4,
          z: g.b.z + g.oz,
        });
        if (p.z < 0.5) continue;
        const s = proj(p);
        const fog = Math.min(1, Math.max(0, (p.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        if (fog >= 1) continue;
        const size = Math.max(1, (7 / p.z) * g.s);
        // diluted plume: thin, brownish-red haze the further it drifts
        const dilute = Math.min(1, g.s / 3.3);
        const r = 150 - dilute * 40;
        const gg = 20 + dilute * 40;
        const bb = 34 + dilute * 34;
        ctx.fillStyle = `rgba(${r | 0},${gg | 0},${bb | 0},${g.a * (1 - fog)})`;
        ctx.fillRect(s.x, s.y, size, size);

      }

      // suspended silt — the water itself
      for (const sp of silt) {
        const p = toCam(sp);
        if (p.z < 0.5) continue;
        const s = proj(p);
        const fog = Math.min(1, Math.max(0, (p.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        if (fog >= 1) continue;
        const size = Math.max(1, (5 / p.z) * sp.s);
        ctx.fillStyle = `rgba(150,170,180,${0.18 * (1 - fog)})`;
        ctx.fillRect(s.x, s.y, size, size);
      }

      for (const l of lamps) {
        const p = toCam(l);
        if (p.z < 0.4) continue;
        const s = proj(p);
        const flick = 0.6 + 0.4 * Math.sin(time * 9 + l.phase);
        const fog = Math.min(1, Math.max(0, (p.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        const r = (240 / p.z) * (1 - fog);
        if (r < 1) continue;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
        g.addColorStop(0, `rgba(255,95,80,${0.45 * flick * (1 - fog)})`);
        g.addColorStop(1, "rgba(255,60,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const d of drops) {
        const p = toCam(d);
        if (p.z < 0.5) continue;
        const s = proj(p);
        const size = Math.max(1, (7 / p.z) * 1.4);
        const fog = Math.min(1, Math.max(0, (p.z - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        ctx.fillStyle = `rgba(175,28,46,${0.85 * (1 - fog)})`;
        ctx.fillRect(s.x, s.y, size, size);
      }

      // helmet lamp pool straight ahead
      const lamp = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, H * 0.9);
      lamp.addColorStop(0, "rgba(255,225,190,0.13)");
      lamp.addColorStop(0.45, "rgba(210,120,95,0.05)");
      lamp.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = lamp;
      ctx.fillRect(0, 0, W, H);

      const mg = ctx.createLinearGradient(0, H * 0.2, 0, H);
      mg.addColorStop(0, "rgba(40,22,30,0.35)");
      mg.addColorStop(0.55, "rgba(28,15,22,0.18)");
      mg.addColorStop(1, "rgba(18,10,14,0.32)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, 0, W, H);

      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // faint visor frame so we read as first-person inside the heavy suit
      ctx.fillStyle = "rgba(10,6,8,0.85)";
      ctx.fillRect(0, 0, W, 6);
      ctx.fillRect(0, H - 8, W, 8);
      ctx.strokeStyle = "rgba(190,120,110,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(6, 10, W - 12, H - 24);

      if (!reachedRef.current && CORRIDOR_LEN - cam.z < 13) {
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
      window.removeEventListener("mousemove", onMouse);
      canvas.removeEventListener("click", onClick);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
  }, [onReach]);

  return (
    <div style={{ position: "relative", width: "min(100vw, calc(100vh * 16 / 9))", margin: "0 auto" }}>
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
          cursor: "crosshair",
        }}
      />
      {log && (
        <div
          style={{
            position: "absolute",
            right: "3%",
            top: "22%",
            width: "32%",
            padding: "10px 12px",
            background: "rgba(8,6,9,0.72)",
            borderLeft: "2px solid rgba(175,28,46,0.75)",
            color: "rgba(228,214,214,0.92)",
            fontFamily: "monospace",
            fontSize: "clamp(9px, 1.05vw, 14px)",
            lineHeight: 1.5,
            letterSpacing: "0.02em",
            pointerEvents: "none",
            opacity: logOn ? 1 : 0,
            filter: logOn ? "blur(0px)" : "blur(1.5px)",
            transition: "opacity 2.2s ease-out, filter 2.2s ease-out",
          }}
        >
          <div style={{ color: "rgba(220,120,120,0.95)", marginBottom: 6 }}>{log.line}</div>
          <div style={{ opacity: 0.85 }}>{log.sub}</div>
        </div>
      )}
    </div>
  );

}
