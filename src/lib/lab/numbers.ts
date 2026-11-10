// Results are typed the Venezuelan way: a comma for decimals ("13,5") and a
// dot for thousands ("145.000"). A dot alone is also read as a decimal point
// ("13.5"), except in a whole number grouped by thousands ("7.500").

const THOUSANDS = /^[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/;
const PLAIN = /^\d*([.,]\d+)?$/;
const QUALIFIER = /^(<=|>=|<|>|≤|≥)\s*/;

/** A typed result as a number ("< 0,5" reads 0.5), or null when it is not one. */
export function parseResult(raw: string): number | null {
  const text = raw.trim().replace(QUALIFIER, "").replace(/\s+/g, "");
  if (!text) return null;
  const negative = text.startsWith("-");
  const body = negative ? text.slice(1) : text;
  let value: number;
  if (THOUSANDS.test(body)) value = Number(body.replace(/\./g, "").replace(",", "."));
  else if (PLAIN.test(body) && /\d/.test(body)) value = Number(body.replace(",", "."));
  else return null;
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const formats = new Map<number, Intl.NumberFormat>();
const format = (decimals: number) => {
  let f = formats.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat("es-VE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formats.set(decimals, f);
  }
  return f;
};

/** 145000 → "145.000", 13.5 → "13,5". Without `decimals`, up to 2 and no trailing zeros. */
export function formatNumber(value: number, decimals?: number | null) {
  if (decimals === undefined || decimals === null) {
    const rounded = Math.round(value * 100) / 100;
    const places = Number.isInteger(rounded) ? 0 : Number.isInteger(rounded * 10) ? 1 : 2;
    return format(places).format(rounded);
  }
  return format(decimals).format(value);
}

/** How many decimals a typed number has ("13,50" → 2). */
function typedDecimals(raw: string) {
  const text = raw.trim().replace(QUALIFIER, "");
  if (THOUSANDS.test(text)) return text.includes(",") ? text.split(",")[1].length : 0;
  const match = text.match(/[.,](\d+)$/);
  return match ? match[1].length : 0;
}

/**
 * A typed numeric result in the house style, keeping its precision and any
 * "<"/">" in front: "13.50" → "13,50", "7500" → "7.500", "<0.5" → "< 0,5".
 * Anything that is not a number ("Hemolizada", "*****") is kept as typed.
 */
export function tidyNumber(raw: string) {
  const value = parseResult(raw);
  if (value === null) return raw.trim();
  const qualifier = raw.trim().match(QUALIFIER)?.[1];
  const sign = qualifier === "<=" ? "≤" : qualifier === ">=" ? "≥" : qualifier;
  const shown = formatNumber(value, typedDecimals(raw));
  return sign ? `${sign} ${shown}` : shown;
}
