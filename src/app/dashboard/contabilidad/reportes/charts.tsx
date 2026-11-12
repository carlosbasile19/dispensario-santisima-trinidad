"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { Icon } from "@/components/crm/icons";
import { formatUsd } from "@/lib/crm/money";
import { change, formatCount, formatPercent } from "@/lib/crm/reports";
import { CHART } from "./palette";

// The interactive charts of Reportes, drawn as SVG at the card's real width
// (a ResizeObserver keeps it in step), so lines stay 2px and dots round.
// Every chart has a hover/keyboard readout; the same figures are in the
// detail table at the end of the page.

const AXIS_FONT = 11;

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A clean top for the y axis and its step: 0–4 → step 1, 0–2.300 → step 500. */
function niceScale(max: number, integer: boolean, ticks = 4) {
  if (max <= 0) return { top: integer ? ticks : 100, step: integer ? 1 : 25 };
  const raw = max / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const finalStep = integer ? Math.max(1, Math.ceil(step)) : step;
  return { top: Math.ceil(max / finalStep) * finalStep, step: finalStep };
}

const compactMoney = (value: number) =>
  value >= 10_000 ? `$${formatCount(Math.round(value / 1000))}k` : `$${formatCount(value)}`;
export const formatValue = (value: number, money: boolean) => (money ? formatUsd(value) : formatCount(value));
const tickValue = (value: number, money: boolean) => (money ? compactMoney(value) : formatCount(value));

/** Indices of the x ticks that fit the width without colliding (always the first and the last). */
function visibleTicks(count: number, plotWidth: number, minGap = 52) {
  const every = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / minGap))));
  return new Set(Array.from({ length: count }, (_, i) => i).filter((i) => i % every === 0 || i === count - 1));
}

function Tooltip({ x, width, title, rows }: { x: number; width: number; title: string; rows: { key: ReactNode; label: string; value: string }[] }) {
  const boxWidth = 196;
  const left = Math.min(Math.max(x - boxWidth / 2, 0), width - boxWidth);
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-white px-3 py-2 shadow-[0_6px_24px_-12px_rgba(27,42,85,0.35)]"
      style={{ left, width: boxWidth }}
    >
      <p className="text-[12px] text-muted first-letter:uppercase">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="mt-1 flex items-center gap-2 text-[13px]">
          {row.key}
          <span className="font-semibold text-navy tabular-nums">{row.value}</span>
          <span className="truncate text-muted">{row.label}</span>
        </p>
      ))}
    </div>
  );
}

const LineKey = ({ color }: { color: string }) => <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: color }} />;
const SwatchKey = ({ color }: { color: string }) => <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;

/** Moves the hovered slot with the arrow keys, as the pointer does. */
function useSlotKeys(count: number, active: number | null, setActive: (i: number | null) => void) {
  return (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      setActive(Math.min(count - 1, Math.max(0, (active ?? (delta > 0 ? -1 : count)) + delta)));
    } else if (event.key === "Escape") setActive(null);
  };
}

// The KPI strip and the main chart -------------------------------------------

export type Metric = {
  key: string;
  label: string;
  money: boolean;
  total: number;
  previousTotal: number;
  /** Whether a rise is good news (it is not for gastos). */
  upIsGood: boolean;
  /** The change as an amount ("+$ 120,00") instead of a percentage: for the resultado, which can be negative. */
  absoluteDelta?: boolean;
  hint: string;
  /** The figures the delta compares: the whole periods, or both up to the same day while this one is under way. */
  compare: { current: number; previous: number };
  current: number[];
  previous: number[];
  /** Slots of the current period that have happened: money after today would only draw a fall to zero. */
  cutoff: number;
};

function Delta({ metric, versus }: { metric: Metric; versus: string }) {
  const diff = metric.compare.current - metric.compare.previous;
  const ratio = metric.absoluteDelta ? null : change(metric.compare.current, metric.compare.previous);
  if (!metric.absoluteDelta && ratio === null) {
    return <p className="mt-1.5 text-[12px] text-stone">Sin datos de {versus}</p>;
  }
  const direction = diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  const good = direction === "flat" ? null : (direction === "up") === metric.upIsGood;
  const tone = good === null ? "bg-sand text-ink" : good ? "bg-mint/30 text-[#135c62]" : "bg-coral/10 text-[#b03a36]";
  const text = metric.absoluteDelta
    ? `${diff > 0 ? "+" : ""}${formatValue(diff, metric.money)}`
    : formatPercent(Math.abs(ratio ?? 0));
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted">
      <span className={`inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 font-medium tabular-nums ${tone}`}>
        {direction !== "flat" && <Icon name={direction === "up" ? "arrow-up" : "arrow-down"} className="size-3" />}
        {direction === "flat" ? "Igual" : text}
      </span>
      <span>vs {versus}</span>
    </p>
  );
}

export function TrendExplorer({
  metrics,
  ticks,
  names,
  previousNames,
  currentLabel,
  previousLabel,
  versus,
}: {
  metrics: Metric[];
  ticks: string[];
  names: string[];
  previousNames: string[];
  currentLabel: string;
  previousLabel: string;
  versus: string;
}) {
  const [selected, setSelected] = useState(0);
  const metric = metrics[selected];
  return (
    <>
      {/* A 1px gap over the line colour draws the hairlines between cells at every width. */}
      <div role="group" aria-label="Elige el indicador del gráfico" className="grid grid-cols-2 gap-px overflow-hidden rounded-t-xl border-b border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {metrics.map((m, i) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className={`relative min-w-0 px-4 py-4 text-left transition-colors sm:px-5 ${i === selected ? "bg-cream" : "bg-white hover:bg-cream/60"}`}
          >
            <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 ${i === selected ? "bg-teal" : "bg-transparent"}`} />
            <span className="block text-[12px] tracking-[0.04em] text-stone uppercase">{m.label}</span>
            <span className="mt-1.5 block truncate text-xl font-semibold text-navy sm:text-[22px]">{formatValue(m.total, m.money)}</span>
            <Delta metric={m} versus={versus} />
            <span className="mt-1 block truncate text-[12px] text-muted">{m.hint}</span>
          </button>
        ))}
      </div>
      <div className="px-3 pt-4 pb-3 sm:px-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-[15px] font-semibold">{metric.label}</p>
          <div className="flex items-center gap-4 text-[12px] text-muted">
            <span className="flex items-center gap-1.5 first-letter:uppercase">
              <LineKey color={CHART.current} />
              <span className="first-letter:uppercase">{currentLabel}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <LineKey color={CHART.previous} />
              <span className="first-letter:uppercase">{previousLabel}</span>
            </span>
          </div>
        </div>
        <TrendChart
          key={metric.key}
          metric={metric}
          ticks={ticks}
          names={names}
          previousNames={previousNames}
          currentLabel={currentLabel}
          previousLabel={previousLabel}
        />
      </div>
    </>
  );
}

const PLOT = { height: 240, top: 12, bottom: 28, left: 52, right: 14 };

function TrendChart({
  metric,
  ticks,
  names,
  previousNames,
  currentLabel,
  previousLabel,
}: {
  metric: Metric;
  ticks: string[];
  names: string[];
  previousNames: string[];
  currentLabel: string;
  previousLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(720);
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = useSlotKeys(ticks.length, active, setActive);
  const titleId = useId();

  const n = ticks.length;
  const current = metric.current.slice(0, metric.cutoff);
  const previous = metric.previous.slice(0, n);
  const { top, step } = niceScale(Math.max(...current, ...previous, 0), !metric.money);
  const plotW = width - PLOT.left - PLOT.right;
  const height = PLOT.height + PLOT.top + PLOT.bottom;
  const x = (i: number) => PLOT.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PLOT.top + PLOT.height - (v / top) * PLOT.height;
  const line = (values: number[]) => values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = current.length > 1 ? `${line(current)}L${x(current.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const shown = visibleTicks(n, plotW);
  const last = current.length - 1;

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    const i = n <= 1 ? 0 : Math.round(((px - PLOT.left) / plotW) * (n - 1));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative">
      <svg
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onPointerMove={onPointer}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        className="block touch-pan-y overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
      >
        <title id={titleId}>
          {`${metric.label}: ${formatValue(metric.total, metric.money)} en ${currentLabel}, ${formatValue(metric.previousTotal, metric.money)} en ${previousLabel}. Usa las flechas para recorrer el gráfico.`}
        </title>
        {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((v) => (
          <g key={v}>
            <line x1={PLOT.left} x2={width - PLOT.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
            <text x={PLOT.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={AXIS_FONT} fill={CHART.tick} className="tabular-nums">
              {tickValue(v, metric.money)}
            </text>
          </g>
        ))}
        {ticks.map((tick, i) =>
          shown.has(i) ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor={n > 1 && i === n - 1 ? "end" : n > 1 && i === 0 ? "start" : "middle"} fontSize={AXIS_FONT} fill={CHART.tick}>
              {tick}
            </text>
          ) : null,
        )}
        {previous.length > 0 && (
          <path d={line(previous)} fill="none" stroke={CHART.previous} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {area && <path d={area} fill={CHART.current} fillOpacity={0.1} />}
        {current.length > 0 && (
          <path d={line(current)} fill="none" stroke={CHART.current} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {last >= 0 && active === null && <circle cx={x(last)} cy={y(current[last])} r={4} fill={CHART.current} stroke="#fff" strokeWidth={2} />}
        {active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={PLOT.top} y2={PLOT.top + PLOT.height} stroke={CHART.axis} strokeWidth={1} />
            {active < previous.length && <circle cx={x(active)} cy={y(previous[active])} r={4} fill={CHART.previous} stroke="#fff" strokeWidth={2} />}
            {active <= last && <circle cx={x(active)} cy={y(current[active])} r={4.5} fill={CHART.current} stroke="#fff" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {active !== null && (
        <Tooltip
          x={x(active)}
          width={width}
          title={names[active]}
          rows={[
            {
              key: <LineKey color={CHART.current} />,
              label: "",
              value: active <= last ? formatValue(current[active], metric.money) : "—",
            },
            ...(active < previous.length
              ? [{ key: <LineKey color={CHART.previous} />, label: previousNames[active] ?? previousLabel, value: formatValue(previous[active], metric.money) }]
              : []),
          ]}
        />
      )}
    </div>
  );
}

// Grouped columns (ingresos y gastos, citas por día de la semana) ---------------

export type ColumnSeries = { name: string; color: string; values: number[] };

const COLS = { height: 200, top: 10, bottom: 28, left: 52, right: 8 };

/** A column with a 4px rounded top, square on the baseline. */
const columnPath = (x: number, y: number, w: number, h: number) => {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

export function ColumnChart({
  series,
  ticks,
  names,
  money,
  label,
}: {
  series: ColumnSeries[];
  ticks: string[];
  names: string[];
  money: boolean;
  label: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(560);
  const [active, setActive] = useState<number | null>(null);
  const onKeyDown = useSlotKeys(ticks.length, active, setActive);
  const titleId = useId();

  const n = ticks.length;
  const { top, step } = niceScale(Math.max(0, ...series.flatMap((s) => s.values)), !money);
  const plotW = width - COLS.left - COLS.right;
  const height = COLS.height + COLS.top + COLS.bottom;
  const band = plotW / Math.max(1, n);
  const gap = 2;
  const barW = Math.max(2, Math.min(24, (band * 0.72 - gap * (series.length - 1)) / series.length));
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => COLS.top + COLS.height - (v / top) * COLS.height;
  const shown = visibleTicks(n, plotW, 40);

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * width;
    setActive(Math.min(n - 1, Math.max(0, Math.floor((px - COLS.left) / band))));
  };

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-4 text-[12px] text-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <SwatchKey color={s.color} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative">
        <svg
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="block touch-pan-y overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-teal/40"
        >
          <title id={titleId}>{`${label}. Usa las flechas para recorrer el gráfico.`}</title>
          {Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step).map((v) => (
            <g key={v}>
              <line x1={COLS.left} x2={width - COLS.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
              <text x={COLS.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={AXIS_FONT} fill={CHART.tick} className="tabular-nums">
                {tickValue(v, money)}
              </text>
            </g>
          ))}
          {ticks.map((tick, i) => {
            const x0 = COLS.left + i * band + (band - groupW) / 2;
            return (
              <g key={i} opacity={active === null || active === i ? 1 : 0.55}>
                {active === i && <rect x={COLS.left + i * band} y={COLS.top} width={band} height={COLS.height} fill={CHART.hover} />}
                {series.map((s, k) => {
                  const v = s.values[i] ?? 0;
                  return <path key={s.name} d={columnPath(x0 + k * (barW + gap), y(v), barW, y(0) - y(v))} fill={s.color} />;
                })}
                {shown.has(i) && (
                  <text x={COLS.left + i * band + band / 2} y={height - 8} textAnchor="middle" fontSize={AXIS_FONT} fill={CHART.tick}>
                    {tick}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active !== null && (
          <Tooltip
            x={COLS.left + active * band + band / 2}
            width={width}
            title={names[active]}
            rows={series.map((s) => ({ key: <SwatchKey color={s.color} />, label: series.length > 1 ? s.name : "", value: formatValue(s.values[active] ?? 0, money) }))}
          />
        )}
      </div>
    </div>
  );
}
