import { useEffect, useRef } from "react";

// Tar-like tumors with eyes around the title screen. Positions are fractions of the
// screen (from the user's layout sketch). Green = mass with a big eye, yellow = lone eye.
const MASSES: [number, number, number][] = [
  [0.035, 0.05, 0.075], [0.17, 0.04, 0.04], [0.5, 0.0, 0.025], [0.69, 0.06, 0.14],
  [0.965, 0.07, 0.085], [1.0, 0.3, 0.06], [0.0, 0.28, 0.035], [0.935, 0.54, 0.032],
  [0.935, 0.77, 0.12], [0.03, 0.71, 0.042], [0.08, 0.9, 0.12], [0.635, 0.98, 0.1], [0.765, 0.97, 0.035],
];
const EYES: [number, number, number][] = [];
// only a few realistically large eyes; each one is ringed by a handful of small ones
for (let c = 0; c < 4; c++) {
  const cx = [0.08, 0.71, 0.9, 0.25][c], cy = [0.17, 0.11, 0.68, 0.86][c];
  EYES.push([cx, cy, 0.05]);
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * Math.PI * 2 + c * 0.8;
    let r = 0.014 + (j % 2) * 0.005;
    if (EYES.length % 3 === 0) r *= 1.7; // every 3rd-4th eye grows ~70%
    EYES.push([cx + Math.cos(a) * 0.055, cy + Math.sin(a) * 0.07, r]);
  }
}

// Layers of smaller watchers fill the darkness without adding more giant eyes.
for (let ring = 0; ring < 3; ring++) {
  const count = 28 + ring * 10;
  for (let j = 0; j < count; j++) {
    const a = (j / count) * Math.PI * 2 + ring * 0.23;
    const wobble = Math.sin(j * 2.7 + ring) * 0.018;
    const rx = 0.29 + ring * 0.085 + wobble;
    const ry = 0.30 + ring * 0.085 - wobble;
    const r = (0.006 + (j % 4) * 0.002) * (j % 3 === 0 ? 1.7 : 1);
    EYES.push([0.5 + Math.cos(a) * rx, 0.5 + Math.sin(a) * ry, r]);
  }
}

const PX = 4; // render at 1/4 res for chunky pixels

export function TitleTumors() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0, mx = -9999, my = -9999;
    const heat = new Map<string, number>();
    const onMove = (e: MouseEvent) => { const r = cv.getBoundingClientRect(); mx = (e.clientX - r.left) / PX; my = (e.clientY - r.top) / PX; };
    window.addEventListener("mousemove", onMove);

    const eye = (x: number, y: number, r: number, key: string, t: number, dt: number) => {
      const near = Math.hypot(mx - x, my - y) < r * 2.4 + 30 ? 1 : 0;
      const h = (heat.get(key) ?? 0) + (near - (heat.get(key) ?? 0)) * Math.min(1, dt * 1.3);
      heat.set(key, h);
      // eyes sleep in the dark; light (cursor) wakes them in sick yellow
      const k = h;
      ctx.fillStyle = `rgb(${18 + k * 70},${8 + k * 40},${10})`;
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * 1.08, 0, 0, Math.PI * 2); ctx.fill();
      // ridged teeth-like rim
      ctx.fillStyle = `rgb(${29 + k * 131},${25 + k * 105},${15 + k * 35})`;
      for (let q = 0; q < 10; q++) { const a = (q / 10) * Math.PI * 2 + t * 0.2; ctx.fillRect(x + Math.cos(a) * r * 1.1 - 1, y + Math.sin(a) * r * 0.92 - 1, 2, 2); }
      ctx.fillStyle = `rgb(${25 + k * 175},${23 + k * 153},${14 + k * 44})`;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      if (k > 0.05) { ctx.shadowColor = `rgba(255,220,60,${k})`; ctx.shadowBlur = r * 1.5 * k; }
      const a = Math.atan2(my - y, mx - x), d = Math.min(r * 0.35, Math.hypot(mx - x, my - y) * 0.05) * k;
      const ix = x + Math.cos(a) * d, iy = y + Math.sin(a) * d;
      ctx.fillStyle = `rgb(${37 + k * 218},${32 + k * 190},${10 + k * 18})`;
      ctx.beginPath(); ctx.arc(ix, iy, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(ix, iy, Math.max(0.5, r * (0.3 - k * 0.18 + Math.sin(t * 2 + x) * 0.03)), 0, Math.PI * 2); ctx.fill();
      if (k > 0.3) { ctx.fillStyle = `rgba(255,250,200,${k})`; ctx.fillRect(ix - r * 0.2, iy - r * 0.25, 1, 1); }
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const t = now / 1000;
      const W = (cv.width = Math.ceil(cv.clientWidth / PX)), H = (cv.height = Math.ceil(cv.clientHeight / PX));
      ctx.imageSmoothingEnabled = false;
      const S = Math.min(W, H) * 1.4;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(0, 0, W, H);
      MASSES.forEach(([fx, fy, fr], i) => {
        const x = fx * W, y = fy * H, r = fr * S;
        // tar body with purple sheen + tendrils
        ctx.strokeStyle = "#1c1222"; ctx.lineCap = "round";
        for (let k = 0; k < 9; k++) {
          let ang = (k / 9) * Math.PI * 2 + i, px = x, py = y;
          for (let s = 0; s < 10; s++) {
            ang += Math.sin(t * 0.2 + k + s * 0.6 + i) * 0.3;
            const nx = px + Math.cos(ang) * r * 0.3, ny = py + Math.sin(ang) * r * 0.3;
            ctx.lineWidth = Math.max(1, r * 0.42 * (1 - s / 10));
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
            px = nx; py = ny;
          }
        }
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, "#2a1530"); g.addColorStop(0.6, "#0a060c"); g.addColorStop(1, "#020103");
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          const rr = r * (0.85 + Math.sin(a * 5 + t * 1.3 + i) * 0.07);
          k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.fill();
        // red veins
        ctx.strokeStyle = `rgba(140,20,25,${0.4 + Math.sin(t * 2 + i) * 0.2})`; ctx.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          const a = k * 1.3 + i;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.4) * r * 0.5, y + Math.sin(a + 0.4) * r * 0.5, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.stroke();
        }
        eye(x, y, r * 0.42, "m" + i, t, dt);
        if (r > 10) { eye(x + r * 0.5, y - r * 0.35, r * 0.1, "s" + i, t, dt); eye(x - r * 0.45, y + r * 0.4, r * 0.08, "t" + i, t, dt); }
      });
      EYES.forEach(([fx, fy, fr], i) => {
        const x = fx * W, y = fy * H, r = fr * S;
        // The inner layer stays behind the lettering, the outer layers crowd the edges.
        const title = cv.parentElement?.querySelector(".sy-title-inner");
        const bounds = title?.getBoundingClientRect();
        const canvasBounds = cv.getBoundingClientRect();
        if (i >= 16 && bounds && x > (bounds.left - canvasBounds.left - 12) / PX && x < (bounds.right - canvasBounds.left + 12) / PX && y > (bounds.top - canvasBounds.top - 12) / PX && y < (bounds.bottom - canvasBounds.top + 12) / PX) return;
        eye(x, y, r, "e" + i, t, dt);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("mousemove", onMove); };
  }, []);
  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1, pointerEvents: "none", imageRendering: "pixelated" }} />;
}
