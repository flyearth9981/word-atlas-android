import { useSyncExternalStore } from "react";

interface T {
  id: number;
  text: string;
  tone: "info" | "ok" | "warn";
}
let items: T[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(text: string, tone: T["tone"] = "info") {
  const id = Date.now() + Math.random();
  items = [...items.slice(-2), { id, text, tone }];
  emit();
  window.setTimeout(() => {
    items = items.filter((x) => x.id !== id);
    emit();
  }, 3200);
}

export function Toasts() {
  const list = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => items,
  );
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
