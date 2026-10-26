import { useEffect, useRef, useState } from "react";
import { duck, playFile, preloadFiles } from "../lib/sound";
import { dayKey, store } from "../store/store";

const SEEN_KEY = "word-atlas:splash";
const PALETTE: [string, number][] = [
  ["243,236,223", 0.58],
  ["230,180,87", 0.16],
  ["229,124,90", 0.12],
  ["151,184,142", 0.08],
  ["143,178,204", 0.06],
];

export function shouldShowSplash() {
  if (!store.get().settings.splash) return false;
  const h = location.hash.replace(/^#\/?/, "");
  if (h && !h.startsWith("?")) return false; // deep links go straight to content
  try {
    return localStorage.getItem(SEEN_KEY) !== dayKey();
  } catch {
    return true;
  }
}

interface P {
  x: number;
  y: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  c: string;
  r: number;
  d: number;
  a: number;
  tw: number;
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Sample bright pixels of the logo, the Chinese name and the wordmark as particle targets. */
function targets(w: number, h: number, count: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const s = Math.min(w, h);
  const cx = w / 2;
  const top = h * 0.5 - s * 0.3;
  const R = s * 0.085;
  const cy = top + R;
  g.fillStyle = g.strokeStyle = "#fff";
  g.lineWidth = Math.max(2, s * 0.006);
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(cx, cy - R * 0.9);
  g.lineTo(cx + R * 0.3, cy);
  g.lineTo(cx, cy + R * 0.9);
  g.lineTo(cx - R * 0.3, cy);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(cx - R * 0.62, cy);
  g.lineTo(cx, cy - R * 0.1);
  g.lineTo(cx + R * 0.62, cy);
  g.lineTo(cx, cy + R * 0.1);
  g.closePath();
  g.fill();
  const zh = Math.min(w * 0.3, s * 0.24);
  g.font = `700 ${zh}px "Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("词光", cx, cy + R + zh * 0.78);
  const en = Math.max(18, zh * 0.24);
  g.font = `700 ${en}px "Fraunces Variable", Georgia, serif`;
  g.letterSpacing = `${en * 0.34}px`;
  g.fillText("WORD ATLAS", cx, cy + R + zh * 1.52);
  const data = g.getImageData(0, 0, w, h).data;
  // Take every lit pixel, then a random subset: no visible sampling grid.
  const all: [number, number][] = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (data[(y * w + x) * 4 + 3] > 120) all.push([x, y]);
  const pts: [number, number][] = [];
  for (let i = 0; i < count && all.length; i++) {
    const [x, y] = all[Math.floor(Math.random() * all.length)];
    pts.push([x + Math.random() * 2, y + Math.random() * 2]);
  }
  return { pts, cy: cy + R, wordTop: cy + R + zh * 1.3 };
}

export function Splash({ onDone }: { onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"gather" | "ready" | "open">("gather");
  const opening = useRef(false);
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    preloadFiles(["splash-voice.mp3", "splash-door.mp3", "splash-burst.mp3"]);
    const t = window.setTimeout(() => setPhase((p) => (p === "gather" ? "ready" : p)), reduce ? 300 : 2100);
    return () => window.clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || reduce) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext("2d")!;
    g.scale(dpr, dpr);
    const N = w < 700 ? 2600 : 5200;
    const { pts, wordTop } = targets(w, h, N);
    const pick = (): string => {
      let r = Math.random();
      for (const [c, p] of PALETTE) if ((r -= p) <= 0) return c;
      return PALETTE[0][0];
    };
    const ps: P[] = [];
    const cx = w / 2;
    const cy = h / 2;
    for (let i = 0; i < N; i++) {
      const [tx, ty] = pts.length ? pts[i % pts.length] : [cx, cy];
      // Start as a drifting dust cloud across (and slightly beyond) the screen.
      const sx = -0.1 * w + Math.random() * 1.2 * w;
      const sy = -0.1 * h + Math.random() * 1.2 * h;
      ps.push({
        x: sx,
        y: sy,
        sx,
        sy,
        tx: tx + (Math.random() - 0.5) * 1.2,
        ty: ty + (Math.random() - 0.5) * 1.2,
        vx: 0,
        vy: 0,
        c: pick(),
        // A few large glowing grains, but keep the small wordmark crisp.
        r: ty < wordTop && Math.random() < 0.06 ? 2.2 + Math.random() * 1.4 : 0.7 + Math.random() * 1.2,
        d: Math.random() * 0.55,
        a: 0.55 + Math.random() * 0.45,
        tw: Math.random() * Math.PI * 2,
      });
    }
    const stars = Array.from({ length: Math.round((w * h) / 9000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 0.9 + 0.2, tw: Math.random() * 6 }));
    let raf = 0;
    const t0 = performance.now();
    let openAt = 0;
    const frame = (now: number) => {
      const t = (now - t0) / 1000;
      g.clearRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      for (const s of stars) {
        g.fillStyle = `rgba(243,236,223,${0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.tw))})`;
        g.fillRect(s.x, s.y, s.r, s.r);
      }
      if (opening.current && !openAt) {
        openAt = t;
        for (const p of ps) {
          const dx = p.x - cx;
          const dy = p.y - cy * 0.95;
          const len = Math.hypot(dx, dy) || 1;
          const sp = 4 + Math.random() * 9;
          p.vx = (dx / len) * sp + (Math.random() - 0.5) * 3;
          p.vy = (dy / len) * sp + (Math.random() - 0.5) * 3 - 1;
        }
      }
      const fade = openAt ? Math.max(0, 1 - (t - openAt) / 1.1) : 1;
      for (const p of ps) {
        if (openAt) {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 + 0.04;
        } else {
          const k = ease((t - 0.15 - p.d) / 1.7);
          // Spiral in: the swirl offset shrinks as the particle arrives.
          const sw = (1 - k) * (90 + p.tw * 12);
          const ang = (1 - k) * 3.2 + p.tw;
          p.x = p.sx + (p.tx - p.sx) * k + Math.cos(ang) * sw;
          p.y = p.sy + (p.ty - p.sy) * k + Math.sin(ang) * sw;
          if (k >= 1) {
            p.x += Math.sin(t * 2 + p.tw) * 0.35;
            p.y += Math.cos(t * 1.7 + p.tw) * 0.35;
          }
        }
        const twinkle = 0.75 + 0.25 * Math.sin(t * 3 + p.tw * 3);
        const alpha = p.a * twinkle * fade;
        if (p.r > 2) {
          g.fillStyle = `rgba(${p.c},${alpha * 0.12})`;
          g.beginPath();
          g.arc(p.x, p.y, p.r * 2.6, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = `rgba(${p.c},${alpha})`;
        g.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      }
      g.globalCompositeOperation = "source-over";
      if (!openAt || t - openAt < 1.4) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const open = (sound = true) => {
    if (opening.current) return;
    opening.current = true;
    try {
      localStorage.setItem(SEEN_KEY, dayKey());
    } catch {
      /* optional */
    }
    if (sound && store.get().settings.sfx) {
      void playFile("splash-burst.mp3", 0.55);
      void playFile("splash-door.mp3", 0.6, 0.12);
      void playFile("splash-voice.mp3", 0.95, 0.35);
      // Let the welcome line sit above the music that fades in with the doors.
      duck(true);
      window.setTimeout(() => duck(false), 3200);
    }
    setPhase("open");
    window.setTimeout(onDone, reduce ? 300 : 1900);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === "Tab") return;
      e.preventDefault();
      if (e.key === "Escape") open(false);
      else open();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`splash is-${phase} ${reduce ? "is-reduced" : ""}`} onClick={() => open()} role="dialog" aria-label="欢迎打开雅思大门，点击进入">
      <div className="door door-l" />
      <div className="door door-r" />
      <div className="splash-light" />
      <canvas ref={canvas} className="splash-canvas" aria-hidden="true" />
      {reduce && (
        <div className="splash-static">
          <b>词光</b>
          <small>WORD ATLAS</small>
        </div>
      )}
      <div className="splash-copy">
        <p className="splash-tag">欢迎打开雅思大门</p>
        <p className="splash-hint">
          <span className="splash-key" />
          点击开启 · 按任意键
        </p>
      </div>
      <button
        className="splash-skip"
        onClick={(e) => {
          e.stopPropagation();
          open(false);
        }}
      >
        跳过
      </button>
    </div>
  );
}
