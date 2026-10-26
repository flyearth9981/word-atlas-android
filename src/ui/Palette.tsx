import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Atlas, WordRef } from "../atlas/types";
import { useAtlas } from "../atlas/context";
import { openWord } from "../lib/router";
import { Illustration } from "./Illustration";

export function searchAtlas(atlas: Atlas, raw: string, limit = 40): WordRef[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const zh = /[一-鿿]/.test(q);
  const hits: [number, WordRef][] = [];
  for (const w of atlas.words) {
    let score = 0;
    if (zh) {
      const i = w.zh.indexOf(q);
      if (i >= 0) score = 60 - Math.min(40, i) - w.zh.length * 0.2;
    } else {
      const word = w.word.toLowerCase();
      if (word === q) score = 1000;
      else if (word.startsWith(q)) score = 500 - word.length;
      else if (word.includes(q)) score = 200 - word.indexOf(q) - word.length;
    }
    if (score > 0) hits.push([score, w]);
  }
  hits.sort((a, b) => b[0] - a[0] || a[1].order - b[1].order);
  return hits.slice(0, limit).map((h) => h[1]);
}

export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const atlas = useAtlas();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchAtlas(atlas, q, 30), [atlas, q]);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);
  if (!open) return null;
  const pick = (w: WordRef) => {
    onClose();
    openWord(w.id);
  };
  return (
    <div className="palette-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="搜索单词">
        <label className="palette-input">
          <Search size={20} />
          <input
            ref={input}
            value={q}
            placeholder="搜索英文或中文，例如 serendipity / 环境"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(results.length - 1, s + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(0, s - 1));
              }
              if (e.key === "Enter" && results[sel]) pick(results[sel]);
            }}
            aria-controls="palette-list"
            aria-activedescendant={results[sel] ? `pal-${results[sel].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </label>
        <ul id="palette-list" className="palette-list" role="listbox">
          {results.map((w, i) => (
            <li
              key={w.id}
              id={`pal-${w.id}`}
              role="option"
              aria-selected={i === sel}
              className={i === sel ? "is-sel" : ""}
              onMouseEnter={() => setSel(i)}
              onClick={() => pick(w)}
            >
              <Illustration src={atlas.img(w, "thumb")} word={w.word} topic={w.topic} className="palette-thumb" />
              <span className="palette-word" lang="en">
                {w.word}
              </span>
              <span className="palette-zh">{w.zh}</span>
              {i === sel && <CornerDownLeft size={15} className="palette-enter" />}
            </li>
          ))}
          {q && !results.length && <li className="palette-empty">没有找到「{q}」</li>}
          {!q && (
            <li className="palette-hint">
              {atlas.count.toLocaleString()} 个词条 · 支持英文前缀与中文释义搜索 · <kbd>↑</kbd>
              <kbd>↓</kbd> 选择 <kbd>↵</kbd> 打开
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
