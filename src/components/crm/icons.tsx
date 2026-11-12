import type { ReactNode } from "react";

// Line icons for the admin platform, drawn on a 24px grid at 1.6 stroke.

export type IconName =
  | "home" | "calendar" | "patients" | "ledger" | "building" | "team"
  | "lock" | "plus" | "check" | "clock" | "phone" | "eye" | "logout" | "key"
  | "search" | "chevron-left" | "chevron-right" | "x" | "cash" | "tag"
  | "chevron-down" | "chevrons" | "card" | "mobile" | "bank" | "send" | "coins" | "installments"
  | "stethoscope" | "tooth" | "flask" | "shield" | "star" | "refresh" | "id-card" | "bolt" | "alert"
  | "slots" | "calendar-check" | "map-pin" | "globe" | "chat" | "arrow-left" | "arrow-right" | "download"
  | "copy" | "link" | "external" | "trash" | "pause" | "note"
  | "file" | "printer" | "share" | "sigma" | "more" | "unlock" | "arrow-up" | "arrow-down" | "pen" | "fold"
  | "mic" | "sparkle" | "play" | "stop";

const PATHS: Record<Exclude<IconName, keyof typeof EXTRA>, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  patients: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.9.7 3.1 2.5 3.5 5.2" />
    </>
  ),
  ledger: (
    <>
      <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  building: <path d="M4.5 20.5V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15.5M14.5 9.5h4a1 1 0 0 1 1 1v10M2.5 20.5h19M8 8h3M8 12h3M8 16h3" />,
  team: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.7-3.6 3.4-5.8 7-5.8s6.3 2.2 7 5.8" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2Z" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4.5" />
      <path d="m11.5 11.5 8-8M16 7l2.5 2.5M13.5 9.5 15 11" />
    </>
  ),
  logout: <path d="M14.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3.5M10 16l-4-4 4-4M6 12h9.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  "chevron-left": <path d="m14.5 6-6 6 6 6" />,
  "chevron-right": <path d="m9.5 6 6 6-6 6" />,
  x: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />,
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.2 6.2a1.5 1.5 0 0 1-2.1 0l-8.7-7.9Z" />
      <circle cx="8" cy="8" r="1.4" />
    </>
  ),
  "chevron-down": <path d="m6 9.5 6 6 6-6" />,
  chevrons: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  mobile: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.2" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  bank: <path d="M3.5 9.5 12 4.5l8.5 5M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3 20h18" />,
  send: <path d="M20.5 3.5 10 14M20.5 3.5l-6.5 17-4-6.5-6.5-4 17-6.5Z" />,
  coins: (
    <>
      <ellipse cx="9.5" cy="6.5" rx="6" ry="2.5" />
      <path d="M3.5 6.5v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6.5M3.5 11v4.5c0 1.4 2.7 2.5 6 2.5 1 0 2-.1 2.8-.3" />
      <circle cx="17.5" cy="16" r="3.5" />
    </>
  ),
  installments: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 12V3.5M12 12l7.4 4.2M12 12l-7.4 4.2" />
    </>
  ),
  stethoscope: (
    <>
      <path d="M5.5 3.5H4.5v5a4.5 4.5 0 0 0 9 0v-5h-1M9 13v1.5a5 5 0 0 0 10 0v-2" />
      <circle cx="19" cy="10.5" r="2" />
    </>
  ),
  tooth: (
    <path d="M12 6.2c-1.4-1.3-3.1-2-4.9-1.7C4.4 5 3.4 8 4.3 10.8c.7 2 1.4 3.7 1.7 6.1.3 2.2.8 3.6 2 3.6 1.4 0 1.6-2.3 2.2-4.2.4-1.2.9-1.8 1.8-1.8s1.4.6 1.8 1.8c.6 1.9.8 4.2 2.2 4.2 1.2 0 1.7-1.4 2-3.6.3-2.4 1-4.1 1.7-6.1.9-2.8-.1-5.8-2.8-6.3-1.8-.3-3.5.4-4.9 1.7Z" />
  ),
  flask: <path d="M9.5 3.5h5M10.5 3.5v5.3L5 18.3a1.5 1.5 0 0 0 1.3 2.2h11.4a1.5 1.5 0 0 0 1.3-2.2l-5.5-9.5V3.5M7.3 14.5h9.4" />,
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.6 7 9 4.1-1.4 7-4.7 7-9V6l-7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  star: <path d="m12 4 2.4 5 5.4.7-4 3.7 1 5.4-4.8-2.6-4.8 2.6 1-5.4-4-3.7 5.4-.7L12 4Z" />,
  refresh: <path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9M17.7 3.5v3.6h-3.6M6.3 20.5v-3.6h3.6" />,
  "id-card": (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16c.5-1.5 1.6-2.3 3-2.3s2.5.8 3 2.3M14.5 10h4M14.5 13.5h2.5" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.5H12l-1 7.5 7.5-10.5H12l1-7.5Z" />,
  alert: (
    <>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </>
  ),
  slots: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 16.5h2M11 16.5h2" />
    </>
  ),
  "calendar-check": (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.5 5.2 3.5 8.5s-1.2 6.1-3.5 8.5c-2.3-2.4-3.5-5.2-3.5-8.5s1.2-6.1 3.5-8.5Z" />
    </>
  ),
  chat: <path d="M20 11.5a7.5 7.5 0 0 1-11.1 6.6L4 19.5l1.4-4.6A7.5 7.5 0 1 1 20 11.5Z" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  external: <path d="M13.5 4.5h6v6M19.5 4.5 11 13M17.5 13.5v4.5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8A1.5 1.5 0 0 1 6 6.5h4.5" />,
  trash: <path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.8 11.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7M10 11v5.5M14 11v5.5" />,
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  note: (
    <>
      <path d="M5.5 4.5h13a1 1 0 0 1 1 1V15l-4.5 4.5H5.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z" />
      <path d="M19.5 15H16a1 1 0 0 0-1 1v3.5M8.5 9h7M8.5 12.5h4" />
    </>
  ),
};

const EXTRA: Record<
  "file" | "printer" | "share" | "sigma" | "more" | "unlock" | "arrow-up" | "arrow-down" | "pen" | "fold" | "mic" | "sparkle" | "play" | "stop",
  ReactNode
> = {
  file: (
    <>
      <path d="M13.5 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" />
      <path d="M13.5 3.5v5h5M9 13h6M9 16.5h4" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8.5V4h10v4.5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5.5A1.5 1.5 0 0 1 5 8.5h14a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 19 17h-2" />
      <path d="M7 14h10v6H7zM16.5 11.5h.01" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="m8.7 10.8 6.6-4M8.7 13.2l6.6 4" />
    </>
  ),
  sigma: <path d="M17.5 5.5h-11l6 6.5-6 6.5h11" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18.5" cy="12" r="1" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.7-1.5" />
    </>
  ),
  "arrow-up": <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" />,
  "arrow-down": <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />,
  pen: <path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10v4ZM13.5 6.5l4 4" />,
  fold: <path d="M4.5 4.5h15v15h-15zM4.5 12h15" strokeDasharray="0" />,
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M8.5 20.5h7" />
    </>
  ),
  sparkle: <path d="M12 3.5c.6 3.9 2.6 5.9 6.5 6.5-3.9.6-5.9 2.6-6.5 6.5-.6-3.9-2.6-5.9-6.5-6.5 3.9-.6 5.9-2.6 6.5-6.5ZM18.5 15.5c.3 1.6 1 2.3 2.5 2.5-1.5.3-2.2 1-2.5 2.5-.3-1.5-1-2.2-2.5-2.5 1.5-.2 2.2-.9 2.5-2.5Z" />,
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
};

export function Icon({ name, className = "size-[18px]" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name in PATHS ? PATHS[name as keyof typeof PATHS] : EXTRA[name as keyof typeof EXTRA]}
    </svg>
  );
}
