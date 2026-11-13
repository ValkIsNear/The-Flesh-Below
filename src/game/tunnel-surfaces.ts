// Shared industrial plates; Signal uses the same surface with its colour drained.
export function createTunnelSurfaces(desaturated = false) {
  let seed = 7331;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
  const make = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
    if (desaturated) {
      const image = ctx.getImageData(0, 0, 64, 64);
      for (let i = 0; i < image.data.length; i += 4) {
        const grey = Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114);
        image.data[i] = image.data[i + 1] = image.data[i + 2] = grey;
      }
      ctx.putImageData(image, 0, 0);
    }
    return canvas;
  };
  const grain = (ctx: CanvasRenderingContext2D, amount: number) => {
    for (let i = 0; i < 900; i++) {
      const x = Math.floor(rnd() * 64), y = Math.floor(rnd() * 64), g = 120 + rnd() * 90;
      ctx.fillStyle = `rgba(${g},${g * 0.72},${g * 0.6},${rnd() * amount * 0.45})`;
      ctx.fillRect(x, y, 1 + (rnd() > 0.85 ? 1 : 0), 1);
    }
  };
  const wall = make((ctx) => {
    ctx.fillStyle = '#4b3230'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#583a34'; ctx.fillRect(3, 3, 58, 26);
    ctx.fillStyle = '#422b2b'; ctx.fillRect(3, 34, 58, 26);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 30, 64, 3);
    ctx.fillStyle = '#7d5540';
    for (let x = 6; x < 60; x += 12) { ctx.fillRect(x, 6, 2, 2); ctx.fillRect(x, 55, 2, 2); }
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rnd() * 64);
      ctx.fillStyle = `rgba(90,45,25,${0.15 + rnd() * 0.3})`;
      ctx.fillRect(x, Math.floor(rnd() * 30), 1 + Math.floor(rnd() * 2), 20 + Math.floor(rnd() * 30));
    }
    grain(ctx, 0.3);
  });
  const ceiling = make((ctx) => {
    ctx.fillStyle = '#2a1d24'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#20161c'; ctx.fillRect(0, 26, 64, 12);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 64, 2);
    grain(ctx, 0.25);
  });
  return { wall, ceiling };
}