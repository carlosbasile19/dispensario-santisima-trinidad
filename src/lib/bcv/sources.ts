import "server-only";
import https from "node:https";
import tls from "node:tls";

import { parseRate } from "@/lib/crm/money";
import { SECTIGO_DV_R36 } from "./sectigo-r36";

// Where the official dollar rate is read from.
//
// 1. bcv.org.ve itself: its home page shows the USD rate and its "Fecha
//    Valor", the day the rate applies to (published in the afternoon for the
//    next business day). The site serves an incomplete certificate chain, so
//    the missing intermediate is trusted here (see sectigo-r36.ts).
// 2. ve.dolarapi.com, a public mirror of the BCV figure, when the BCV site
//    is down or slow. Its history is keyed by fecha valor.

export type OfficialRate = {
  /** The fecha valor: the business day the rate applies to, "YYYY-MM-DD". */
  day: string;
  /** Bs per dollar, scaled by 10^8 as in lib/crm/money. */
  rate: bigint;
  source: "bcv" | "dolarapi";
};

const BCV_URL = "https://www.bcv.org.ve/";
const DOLARAPI_HISTORY_URL = "https://ve.dolarapi.com/v1/historicos/dolares/oficial";
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;

const BCV_CA = [...tls.rootCertificates, SECTIGO_DV_R36];

/** GET a page as text, verifying TLS (with extra trusted CAs when given). */
function get(url: string, ca?: string[], redirects = 2, signal = AbortSignal.timeout(TIMEOUT_MS)): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        ca,
        signal,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; DispensarioSantisimaTrinidad/1.0; tasa BCV)",
          accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400 && response.headers.location && redirects > 0) {
          response.resume();
          resolve(get(new URL(response.headers.location, url).toString(), ca, redirects - 1, signal));
          return;
        }
        if (status !== 200) {
          response.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) request.destroy(new Error("Response too large"));
          else chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error(`Timed out after ${TIMEOUT_MS / 1000}s`)));
    request.on("error", reject);
  });
}

// The USD block of the home page and its fecha valor:
//   <div id="dolar" ...> ... <strong class="strong-tb">899,27050000</strong>
//   Fecha Valor: <span ... content="2026-11-10T00:00:00-04:00" ...>
// The page has other date spans, so the date is anchored on "Fecha Valor".
const USD_PATTERN = /<div[^>]*\bid="dolar"[\s\S]*?<strong[^>]*>\s*([\d.]+,\d+)\s*<\/strong>/i;
const FECHA_VALOR_PATTERN = /Fecha\s+Valor:\s*<span[^>]*\bcontent="(\d{4}-\d{2}-\d{2})T/i;

/** "1.006,60742688" (Venezuelan format) → the rate scaled by 10^8. */
export function parseBcvNumber(text: string) {
  return parseRate(text.replace(/\./g, "").replace(",", "."));
}

/** Reads the rate and fecha valor out of the BCV home page. */
export function parseBcvHomepage(html: string): Omit<OfficialRate, "source"> {
  const amount = USD_PATTERN.exec(html)?.[1];
  const day = FECHA_VALOR_PATTERN.exec(html)?.[1];
  const rate = amount ? parseBcvNumber(amount) : null;
  if (!rate || !day) throw new Error("The BCV page no longer has the expected USD block or Fecha Valor");
  return { day, rate };
}

export async function readBcv(signal?: AbortSignal): Promise<OfficialRate> {
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const html = await get(BCV_URL, BCV_CA, 2, signal ? AbortSignal.any([signal, deadline]) : deadline);
  return { ...parseBcvHomepage(html), source: "bcv" };
}

/** The mirror's history, newest last: [{ day, rate }]. */
export async function readDolarApiHistory(signal?: AbortSignal): Promise<OfficialRate[]> {
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const body = JSON.parse(await get(DOLARAPI_HISTORY_URL, undefined, 2, signal ? AbortSignal.any([signal, deadline]) : deadline)) as unknown;
  if (!Array.isArray(body)) throw new Error("Unexpected DolarAPI answer");
  const rates: OfficialRate[] = [];
  for (const row of body) {
    const { fecha, promedio } = (row ?? {}) as { fecha?: unknown; promedio?: unknown };
    if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    if (typeof promedio !== "number" || !Number.isFinite(promedio) || promedio <= 0) continue;
    const rate = parseRate(promedio.toFixed(8));
    if (rate) rates.push({ day: fecha, rate, source: "dolarapi" });
  }
  return rates.sort((a, b) => a.day.localeCompare(b.day));
}
