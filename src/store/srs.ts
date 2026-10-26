import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";

/** Serialized FSRS card. Dates are epoch milliseconds to keep backups small and JSON-safe. */
export interface CardState {
  due: number;
  s: number;
  d: number;
  el: number;
  sd: number;
  ls: number;
  reps: number;
  lapses: number;
  st: 0 | 1 | 2 | 3;
  last?: number;
  /** First time the learner met the word. */
  seen: number;
}

export { Rating };
export type { Grade };

const schedulers = new Map<number, ReturnType<typeof fsrs>>();
const scheduler = (retention: number) => {
  let s = schedulers.get(retention);
  if (!s) {
    s = fsrs({ request_retention: retention, enable_fuzz: true, enable_short_term: true, learning_steps: ["1m", "10m"], relearning_steps: ["10m"] });
    schedulers.set(retention, s);
  }
  return s;
};

const toCard = (c: CardState): Card => ({
  due: new Date(c.due),
  stability: c.s,
  difficulty: c.d,
  elapsed_days: c.el,
  scheduled_days: c.sd,
  learning_steps: c.ls,
  reps: c.reps,
  lapses: c.lapses,
  state: c.st as State,
  last_review: c.last ? new Date(c.last) : undefined,
});

const fromCard = (c: Card, seen: number): CardState => ({
  due: c.due.getTime(),
  s: c.stability,
  d: c.difficulty,
  el: c.elapsed_days,
  sd: c.scheduled_days,
  ls: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  st: c.state as CardState["st"],
  last: c.last_review?.getTime(),
  seen,
});

export function review(prev: CardState | undefined, grade: Grade, now: number, retention = 0.9): CardState {
  const card = prev ? toCard(prev) : createEmptyCard(new Date(now));
  const next = scheduler(retention).next(card, new Date(now), grade).card;
  return fromCard(next, prev?.seen ?? now);
}

/** Next interval for each grade, for button labels. */
export function preview(prev: CardState | undefined, now: number, retention = 0.9): Record<Grade, number> {
  const card = prev ? toCard(prev) : createEmptyCard(new Date(now));
  const p = scheduler(retention).repeat(card, new Date(now));
  return {
    [Rating.Again]: p[Rating.Again].card.due.getTime() - now,
    [Rating.Hard]: p[Rating.Hard].card.due.getTime() - now,
    [Rating.Good]: p[Rating.Good].card.due.getTime() - now,
    [Rating.Easy]: p[Rating.Easy].card.due.getTime() - now,
  } as Record<Grade, number>;
}

export function retrievability(c: CardState, now: number, retention = 0.9) {
  return scheduler(retention).get_retrievability(toCard(c), new Date(now), false) as number;
}

/** Long-term memory: the card would still be recalled with 90% odds three weeks after review. */
export const MASTERED_STABILITY = 21;
export const isMastered = (c?: CardState) => !!c && c.st === 2 && c.s >= MASTERED_STABILITY;
export const isLearning = (c?: CardState) => !!c && !isMastered(c);

export function formatInterval(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 1) return "<1分";
  if (m < 60) return `${m}分`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}小时`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}天`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}个月`;
  return `${(d / 365).toFixed(1)}年`;
}
