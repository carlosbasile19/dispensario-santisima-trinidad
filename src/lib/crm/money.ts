// Money on the screens. Prices and balances are US dollars; payments may be
// in bolívares at the day's BCV rate. The database does the real conversion
// (payments_apply_rate); these helpers repeat it exactly, on integers, so a
// preview never differs from what gets stored by a cent.
//
// Amounts are carried as cents (bigint) and the rate as Bs per dollar scaled
// by 10^8 (the BCV publishes 8 decimals).

const RATE_SCALE = 100_000_000n;

/** Round-half-up division of non-negative integers, like Postgres round(). */
const divRound = (numerator: bigint, denominator: bigint) => (numerator * 2n + denominator) / (2n * denominator);

const scaled = (value: string, decimals: number): bigint | null => {
  const clean = value.trim().replace(",", ".");
  const match = new RegExp(`^(\\d{1,12})(?:\\.(\\d{1,${decimals}}))?$`).exec(clean);
  if (!match) return null;
  return BigInt(match[1]) * 10n ** BigInt(decimals) + BigInt((match[2] ?? "").padEnd(decimals, "0"));
};

/** "25", "25.5" or "25,50" → 2550n. Null if it is not an amount with up to 2 decimals. */
export const parseCents = (value: string) => scaled(value, 2);

/** "233,0456" → 23304560000n. Null if it is not a positive rate with up to 8 decimals. */
export const parseRate = (value: string) => {
  const rate = scaled(value, 8);
  return rate && rate > 0n ? rate : null;
};

/** A dollar or bolívar amount read from the database (at most 2 decimals). */
export const toCents = (amount: number) => BigInt(Math.round(amount * 100));
/** A rate read from the database. */
export const toRate = (rate: number) => parseRate(rate.toFixed(8)) ?? 0n;

export const usdToBs = (usdCents: bigint, rate: bigint) => divRound(usdCents * rate, RATE_SCALE);
export const bsToUsd = (bsCents: bigint, rate: bigint) => (rate > 0n ? divRound(bsCents * RATE_SCALE, rate) : 0n);

export const sumCents = (amounts: number[]) => amounts.reduce((total, amount) => total + toCents(amount), 0n);

/** Cents as the plain "25.50" string the database and number inputs take. */
export const centsToInput = (cents: bigint) => {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
};

const twoDecimals = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const asNumber = (amount: number | bigint) => (typeof amount === "bigint" ? Number(amount) / 100 : amount);

/** "$ 1.234,50". Takes dollars (number) or cents (bigint). */
export const formatUsd = (amount: number | bigint) => {
  const value = asNumber(amount);
  return `${value < 0 ? "-" : ""}$ ${twoDecimals.format(Math.abs(value))}`;
};

/** "Bs. 5.826,14". Takes bolívares (number) or cents (bigint). */
export const formatBs = (amount: number | bigint) => {
  const value = asNumber(amount);
  return `${value < 0 ? "-" : ""}Bs. ${twoDecimals.format(Math.abs(value))}`;
};

/**
 * "233,05": the rate as the screens show it, with 2 decimals. Takes the rate
 * as stored (number) or scaled (bigint). Conversions still use the BCV's
 * full figure (up to 8 decimals), as the database does.
 */
export const formatRate = (rate: number | bigint) =>
  twoDecimals.format(typeof rate === "bigint" ? Number(rate) / 1e8 : rate);
