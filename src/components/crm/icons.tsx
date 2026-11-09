import type { ReactNode } from "react";

// Line icons for the admin platform, drawn on a 24px grid at 1.6 stroke.

export type IconName =
  | "home" | "calendar" | "patients" | "ledger" | "building" | "team"
  | "lock" | "plus" | "check" | "clock" | "phone" | "eye" | "logout" | "key"
  | "search" | "chevron-left" | "chevron-right" | "x" | "cash" | "tag"
  | "chevron-down" | "chevrons" | "card" | "mobile" | "bank" | "send" | "coins" | "installments"
  | "stethoscope" | "tooth" | "flask" | "shield" | "star" | "refresh" | "id-card" | "bolt" | "alert";

const PATHS: Record<IconName, ReactNode> = {
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
      {PATHS[name]}
    </svg>
  );
}
