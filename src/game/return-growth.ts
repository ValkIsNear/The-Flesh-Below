// Pixel-art creature drawing; all positions are projected by the shared tunnel camera.
export type ReturnEye = { x: number; y: number; r: number; depth: number; index: number };

export function drawReturnGrowth(ctx: CanvasRenderingContext2D, eye: ReturnEye, time: number, growth: number, hits: number) {
  const { x, y, r } = eye;
  const dead = hits >= 3;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - eye.depth / 10);
  if (growth > 0) {
    const size = r * (2.2 + growth * 1.8);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const px = x + Math.cos(a) * size * 0.4;
      const py = y + Math.sin(a) * size * 0.3;
      ctx.fillStyle = i % 2 ? "#160d1c" : "#08060a";
      ctx.beginPath();
      ctx.ellipse(px, py, size * 0.42, size * 0.36, a, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#38233e";
      ctx.fillRect(px - size * 0.15, py - size * 0.2, size * 0.2, Math.max(1, size * 0.04));
      let tx = px, ty = py, angle = a;
      for (let k = 0; k < 7; k++) {
        angle += Math.sin(time * (dead ? 0 : 0.35) + i + k * 0.7) * 0.5;
        const nx = tx + Math.cos(angle) * size * 0.27 * growth;
        const ny = ty + Math.sin(angle) * size * 0.27 * growth;
        ctx.strokeStyle = "#160f1b";
        ctx.lineWidth = Math.max(1, size * 0.22 * (1 - k / 8));
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(nx, ny); ctx.stroke();
        tx = nx; ty = ny;
      }
      ctx.strokeStyle = dead ? "#29131b" : "#7d1928";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke();
      if (growth > 0.35 && i % 2 === 0) {
        ctx.fillStyle = dead ? "#342a20" : "#9c8737";
        ctx.fillRect(px - r * 0.18, py - r * 0.12, Math.max(1, r * 0.36), Math.max(1, r * 0.24));
      }
    }
  }
  ctx.fillStyle = dead ? "#2d1720" : "#80202c";
  ctx.beginPath();ctx.ellipse(x, y, r * 1.25, r, 0, 0, Math.PI * 2);ctx.fill();
  ctx.fillStyle = dead ? "#4a3c28" : "#c6af64";
  ctx.beginPath();ctx.ellipse(x, y, r, r * (dead ? 0.15 : 0.72), 0, 0, Math.PI * 2);ctx.fill();
  ctx.fillStyle = "#09070a";
  ctx.beginPath();ctx.ellipse(x + Math.sin(time * 0.3) * r * 0.15, y, r * 0.24, r * 0.56, 0, 0, Math.PI * 2);ctx.fill();
  if (!dead) { ctx.fillStyle = "#e1d596";ctx.fillRect(x - r * 0.35,y - r * 0.3,Math.max(1,r * 0.18),Math.max(1,r * 0.12)); }
  ctx.restore();
}