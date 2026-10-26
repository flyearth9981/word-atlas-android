export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="mark">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="1.2 2.2" opacity=".55" />
      <g className="mark-needle">
        <path d="M16 3.5 19 16 16 28.5 13 16Z" fill="currentColor" opacity=".9" />
        <path d="M16 3.5 19 16H13Z" fill="var(--terra)" />
      </g>
      <path d="M3.5 16 16 13.4 28.5 16 16 18.6Z" fill="currentColor" opacity=".35" />
      <circle cx="16" cy="16" r="1.6" fill="var(--paper)" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <Mark />
      <span className="logo-text">
        <b>词光</b>
        {!compact && <small>Word Atlas</small>}
      </span>
    </span>
  );
}
