/** A short burst of ink-coloured particles from a point on screen (correct answers). */
const COLORS = ["#c4573a", "#d39a2f", "#6f8f68", "#6f93ae", "#1e2640", "#e6b457"];
let canvas: HTMLCanvasElement | null = null;
let parts: { x: number; y: number; vx: number; vy: number; r: number; c: string; life: number; rot: number; vr: number }[] = [];
let raf = 0;

function ensure() {
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.className = "burst-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  return canvas;
}

export function burst(x: number, y: number, count = 34) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = ensure();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== innerWidth * dpr || cv.height !== innerHeight * dpr) {
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
  }
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 2.5 + Math.random() * 5.5;
    parts.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2.5,
      r: 2 + Math.random() * 3.5,
      c: COLORS[i % COLORS.length],
      life: 1,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick() {
  const cv = canvas!;
  const g = cv.getContext("2d")!;
  const dpr = cv.width / innerWidth;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life > 0);
  for (const p of parts) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy = p.vy * 0.94 + 0.32;
    p.rot += p.vr;
    p.life -= 0.022;
    g.save();
    g.globalAlpha = Math.max(0, p.life);
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    g.fillStyle = p.c;
    // Ink flecks: half round dots, half little paper squares.
    if (p.r > 3.6) g.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
    else {
      g.beginPath();
      g.arc(0, 0, p.r / 2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : 0;
  if (!raf) g.clearRect(0, 0, innerWidth, innerHeight);
}
