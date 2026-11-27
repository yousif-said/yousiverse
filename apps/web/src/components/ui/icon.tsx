import { cn } from "cn";
import type { ReactNode } from "react";

/** The app's own icon set: one weight, drawn on a 24 unit grid, colored by the text around it. */
const SHAPES = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  library: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.2" />
      <rect x="8.5" y="7.5" width="4.5" height="12.5" rx="1.2" />
      <path d="m15.4 9.3 2.8-.8 3 11-2.8.8z" />
    </>
  ),
  spark: (
    <path d="M12 3.5l1.8 5.2a2 2 0 0 0 1.5 1.5l5.2 1.8-5.2 1.8a2 2 0 0 0-1.5 1.5L12 20.5l-1.8-5.2a2 2 0 0 0-1.5-1.5L3.5 12l5.2-1.8a2 2 0 0 0 1.5-1.5z" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  feed: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
  clubs: (
    <>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.8c1.9.6 3.1 2.2 3.5 4.7" />
    </>
  ),
  list: <path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11M4.4 6.5h.2M4.4 12h.2M4.4 17.5h.2" />,
  bell: <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15zM10 20.6a2.2 2.2 0 0 0 4 0" />,
  import: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />,
  upload: <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 19.5h15" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  "chev-r": <path d="m9 5 7 7-7 7" />,
  "chev-l": <path d="m15 5-7 7 7 7" />,
  "chev-d": <path d="m5 9 7 7 7-7" />,
  "arrow-r": <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />,
  ext: <path d="M8 16 17 7M9 7h8v8" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5C9.5 17.9 8.4 15.1 8.4 12S9.5 6.1 12 3.5z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.3 2" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" strokeLinejoin="round" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  board: (
    <>
      <rect x="4" y="4" width="4.5" height="16" rx="1.2" />
      <rect x="9.75" y="4" width="4.5" height="10.5" rx="1.2" />
      <rect x="15.5" y="4" width="4.5" height="13.5" rx="1.2" />
    </>
  ),
  msg: (
    <path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H11l-4.5 3.5v-3.5h-2a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
  ),
  link: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
  more: <path d="M5.9 12h.2M11.9 12h.2M17.9 12h.2" strokeWidth="2.6" />,
  sort: <path d="M7 5v14M3.5 15.5 7 19l3.5-3.5M17 19V5M13.5 8.5 17 5l3.5 3.5" />,
  logout: (
    <path d="M14 4.5h4A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 8l-4 4 4 4M6 12h9" />
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.7" />
      <path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M5.5 15.5h-1v-10a1 1 0 0 1 1-1h10v1" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.500h9l1-12.5" />,
  pencil: <path d="m4.5 19.5 1-4.500L16 4.500l3.5 3.500L9 18.500z" />,
  tag: (
    <>
      <path d="M3.5 12.500v-8h8l9 9-8 8z" />
      <path d="M7.9 8.900h.2" strokeWidth="2.4" />
    </>
  ),
  orbit: (
    <>
      <circle cx="12" cy="12" r="2.6" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(-28 12 12)" />
    </>
  ),
  bookmark: <path d="M6.5 4.500h11V20L12 16l-5.5 4z" />,
  shield: <path d="M12 3.5 19.5 6v5.500c0 4.5-3 7.7-7.5 9-4.5-1.3-7.5-4.5-7.5-9V6z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.500M12 7.600v.2" />
    </>
  ),
  movie: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7.5 4.500v15M16.5 4.500v15M3.5 9.500h4M3.5 14.500h4M16.5 9.500h4M16.5 14.500h4" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 20.500h8M12 17v3.5" />
    </>
  ),
  game: (
    <>
      <rect x="2.5" y="7" width="19" height="10.5" rx="5.2" />
      <path d="M7.5 10.300v4M5.5 12.300h4M15.4 11.200h.2M18 13.500h.2" />
    </>
  ),
  book: (
    <path d="M12 6.500C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.500V5c-3.5-.5-6.5 0-8.5 1.500zM12 6.500v13" />
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof SHAPES;

type Props = {
  name: IconName;
  size?: "sm" | "lg";
  className?: string;
};

/** Decorative by default: say what a control does in its own label, not in its icon. */
export function Icon({ name, size, className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("i", size === "sm" && "i--sm", size === "lg" && "i--lg", className)}
    >
      {SHAPES[name]}
    </svg>
  );
}
