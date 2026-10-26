import { useState } from "react";

const HUES = ["#C4573A", "#7F9B77", "#D9A03A", "#5F7FA3", "#A86B8C", "#4E7C76"];

/** Square illustration with a typographic plate as an intentional fallback. */
export function Illustration({
  src,
  word,
  topic = 0,
  className = "",
  eager = false,
  alt,
}: {
  src: string | null;
  word: string;
  topic?: number;
  className?: string;
  eager?: boolean;
  alt?: string;
}) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const showImg = src && state !== "error";
  return (
    <figure className={`illo ${showImg && state === "ok" ? "is-loaded" : ""} ${className}`}>
      {showImg ? (
        <img
          src={src}
          alt={alt ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
        />
      ) : (
        <div className="plate" style={{ "--hue": HUES[topic % HUES.length], "--len": Math.max(4, word.length) } as React.CSSProperties} aria-hidden="true">
          <span className="plate-initial">{word.slice(0, 1)}</span>
          <span className="plate-word">{word}</span>
          <i className="plate-rule" />
        </div>
      )}
    </figure>
  );
}
