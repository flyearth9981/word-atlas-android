import type { Atlas } from "../atlas/types";
import { hashSeed } from "../lib/text";

/** Nineteen star colours, one per IELTS topic, tuned to glow on deep navy. */
export const TOPIC_COLORS = [
  "#f2c46d", "#ef8f6b", "#8fd0c8", "#9fb8ff", "#9be38f", "#ff9fa8", "#f7d9a8", "#c6a7ff", "#ffd36b", "#7fc4ff",
  "#ffb38a", "#86e0b5", "#d8c3a5", "#b5e48c", "#ffe6b0", "#ff8fc3", "#a8d8ff", "#ffcf7a", "#e0b0ff",
];

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Deterministic pseudo-random numbers per word, so the galaxy looks the same everywhere. */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GalaxyLayout {
  n: number;
  positions: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  ids: string[];
  index: Map<string, number>;
  /** Centre of each topic cluster, for floating labels. */
  topicCenters: [number, number, number][];
}

/**
 * A spiral galaxy: each IELTS topic owns an arm, easy words sit near the core and
 * the hardest at the rim, so learning visibly travels outward.
 */
export function layoutGalaxy(atlas: Atlas): GalaxyLayout {
  const words = atlas.words;
  const n = words.length;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const seeds = new Float32Array(n);
  const arms = atlas.topics.length;
  // Big topics get a wider arm so every arm has a similar star density.
  const counts = new Array(arms).fill(0);
  words.forEach((w) => counts[w.topic]++);
  const avg = n / arms;
  words.forEach((w, i) => {
    const r = rand(hashSeed(w.id));
    const gauss = () => (r() + r() + r() - 1.5) / 1.5;
    const radius = 0.1 + (w.cefr / 5) * 0.72 + r() * 0.16;
    const arm = (w.topic / arms) * Math.PI * 2;
    const spread = Math.sqrt(Math.max(0.6, counts[w.topic] / avg));
    const angle = arm + radius * 3.4 + gauss() * (0.05 + 0.03 / radius) * spread;
    const thick = 0.05 * (1 - radius * 0.6) * spread;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = gauss() * thick;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    const [cr, cg, cb] = rgb(TOPIC_COLORS[w.topic % TOPIC_COLORS.length]);
    colors.set([cr, cg, cb], i * 3);
    seeds[i] = r();
  });
  // Label each arm where it is widest, half-way out.
  const mid = 0.62;
  return {
    n,
    positions,
    colors,
    seeds,
    ids: words.map((w) => w.id),
    index: new Map(words.map((w, i) => [w.id, i])),
    topicCenters: atlas.topics.map((_, t) => {
      const a = (t / arms) * Math.PI * 2 + mid * 3.4;
      return [Math.cos(a) * mid, 0, Math.sin(a) * mid] as [number, number, number];
    }),
  };
}
