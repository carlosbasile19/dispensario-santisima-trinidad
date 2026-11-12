import type { ReactNode } from "react";

import { formatCount, formatPercent } from "@/lib/crm/reports";
import { CHART } from "./palette";

// The static figures of Reportes: ranked bar lists, a part-to-whole bar and
// the rows of a breakdown. Every value is printed next to its mark, so none
// needs a hover to be read.

/** Ranked horizontal bars, the value at the tip of each one. */
export function BarList({
  rows,
  color = CHART.current,
}: {
  rows: { key: string; label: ReactNode; value: number; text: string; sub?: string; color?: string }[];
  color?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <ul className="flex flex-col gap-3.5">
      {rows.map((row) => (
        <li key={row.key} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-medium text-navy tabular-nums">{row.text}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <span className="h-2 flex-1 rounded-full bg-sand">
              <span
                className="block h-full rounded-full"
                style={{ width: `${max > 0 ? Math.max(2, (row.value / max) * 100) : 0}%`, background: row.color ?? color }}
              />
            </span>
          </div>
          {row.sub && <p className="mt-1 text-[12px] text-muted">{row.sub}</p>}
        </li>
      ))}
    </ul>
  );
}

/** One whole split into parts, with a legend that names them in order. */
export function SegmentedBar({ parts, unit }: { parts: { label: string; value: number; color: string }[]; unit: [string, string] }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const visible = parts.filter((p) => p.value > 0);
  const describe = (p: { label: string; value: number }) =>
    `${p.label}: ${formatCount(p.value)} ${p.value === 1 ? unit[0] : unit[1]}${total ? ` (${formatPercent(p.value / total)})` : ""}`;
  return (
    <div>
      <div role="img" aria-label={parts.map(describe).join(", ")} className="flex h-7 gap-0.5">
        {total === 0 ? (
          <span className="flex-1 rounded bg-sand" />
        ) : (
          visible.map((p) => (
            <span
              key={p.label}
              title={describe(p)}
              className="flex min-w-1 items-center overflow-hidden rounded px-2 text-[12px] font-medium whitespace-nowrap"
              // White on teal and indigo; near-black on the lighter orange.
              style={{ flexGrow: p.value, flexBasis: 0, background: p.color, color: p.color === CHART.expense ? "#1f1410" : "#fff" }}
            >
              {/* The share only when the block is wide enough to hold it. */}
              {p.value / total >= 0.14 && p.color !== CHART.muted ? formatPercent(p.value / total) : null}
            </span>
          ))
        )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-muted">{p.label}</span>
            <span className="font-medium text-navy tabular-nums">{formatCount(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rows of a breakdown, each with its count and a thin meter of its share. */
export function ShareRows({ rows, total }: { rows: { label: string; value: number; hint?: string }[]; total: number }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-ink">
              {row.label}
              {row.hint && <span className="ml-1.5 text-[12px] text-stone">{row.hint}</span>}
            </dt>
            <dd className="flex items-baseline gap-2 tabular-nums">
              <span className="font-medium text-navy">{formatCount(row.value)}</span>
              <span className="w-11 text-right text-[12px] text-muted">{total ? formatPercent(row.value / total) : "—"}</span>
            </dd>
          </div>
          <span className="mt-1.5 block h-1 rounded-full bg-sand">
            <span className="block h-full rounded-full bg-[#00909a]" style={{ width: `${total ? (row.value / total) * 100 : 0}%` }} />
          </span>
        </div>
      ))}
    </dl>
  );
}

/** A card's body when the period has nothing to show. */
export function NoData({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}
