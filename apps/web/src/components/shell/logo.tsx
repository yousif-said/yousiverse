const MEDIA_HUES = ["movie", "tv", "game", "book"] as const;

/** Four arcs, one in each medium's color, around one point: everything in one orbit. */
export function Logo() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" fill="none" strokeWidth="4" strokeLinecap="round">
      {MEDIA_HUES.map((type, index) => (
        <circle
          key={type}
          cx="14"
          cy="14"
          r="10"
          stroke={`var(--${type})`}
          strokeDasharray="9.4 53.5"
          transform={`rotate(${index * 90 - 72} 14 14)`}
        />
      ))}
      <circle cx="14" cy="14" r="2.6" fill="var(--fg)" stroke="none" />
    </svg>
  );
}
