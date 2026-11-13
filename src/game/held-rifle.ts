/** Existing Dive rifle artwork, kept at hip height during Signal exploration. */
export function drawHeldRifle(ctx: CanvasRenderingContext2D, width: number, height: number, bob: number, time: number) {
  ctx.save();
  ctx.translate(width * 0.68 + Math.sin(bob * 0.5) * 3, height * 0.95 + Math.abs(Math.cos(bob * 0.5)) * 3 + Math.sin(time * 1.1));
  ctx.rotate(0.42);
  ctx.scale(1.55, 1.55);
  const poly = (pts: number[][], fill: string) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  };
        // stock/body
        poly([[-10, 6], [60, -2], [70, 14], [-4, 30]], "#0c120e");
        poly([[-10, 6], [60, -2], [61, 2], [-9, 10]], "#1a241d");
        // receiver panel lines
        for (let k = 0; k < 4; k++) poly([[8 + k * 12, 6 - k], [16 + k * 12, 5 - k], [17 + k * 12, 18 - k], [9 + k * 12, 19 - k]], "#101813");
        // magazine
        poly([[14, 22], [26, 20], [30, 44], [18, 46]], "#080c0a");
        poly([[14, 22], [26, 20], [26, 23], [14, 25]], "#1c2620");
        // barrel shroud
        poly([[-46, -4], [10, -10], [14, 6], [-44, 10]], "#121a15");
        poly([[-46, -4], [10, -10], [10, -6], [-46, 0]], "#1e2a22");
        // vent holes
        for (let k = 0; k < 6; k++) poly([[-40 + k * 8, 1], [-35 + k * 8, 0], [-35 + k * 8, 4], [-40 + k * 8, 5]], "#050806");
        // muzzle + brake
        poly([[-58, -3], [-46, -5], [-45, 9], [-57, 7]], "#070a08");
        poly([[-64, -1], [-58, -2], [-57, 6], [-63, 5]], "#141c17");
        // top rail
        for (let k = 0; k < 8; k++) poly([[-34 + k * 7, -11], [-29 + k * 7, -12], [-29 + k * 7, -8], [-34 + k * 7, -7]], "#26322a");
        // optic
        poly([[-10, -12], [16, -15], [17, -22], [-9, -20]], "#0e1511");
        poly([[-12, -19], [-8, -20], [-8, -12], [-12, -11]], "#2a3a30");
        poly([[-11, -17], [-9, -17], [-9, -14], [-11, -14]], "rgba(110,170,120,0.55)");
        // dim green glow strip
        poly([[-40, 3], [6, -1], [6, 1], [-40, 5]], "rgba(90,140,100,0.35)");
        // grip
        poly([[30, 10], [42, 8], [48, 34], [34, 36]], "#0a0f0c");
        // left hand on foregrip (gloved) + knuckle plates
        poly([[-30, 6], [-14, 4], [-10, 22], [-22, 40], [-34, 30]], "#1a1614");
        poly([[-28, 4], [-16, 3], [-16, 7], [-28, 8]], "#2a2420");
        // right hand on grip + sleeve
        poly([[26, 14], [48, 12], [56, 36], [30, 44]], "#1c1816");
        poly([[30, 44], [56, 36], [70, 70], [36, 80]], "#120e0d");
  ctx.restore();
}
