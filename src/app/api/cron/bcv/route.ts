import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";

import { syncBcvRates } from "@/lib/bcv/sync";

export const maxDuration = 60;

// Vercel Cron calls this every day (vercel.json) with
// "Authorization: Bearer $CRON_SECRET". It records the BCV rate the clinic
// needs (see lib/bcv/sync.ts) and answers what it did, as JSON.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  await connection();
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const report = await syncBcvRates();
  if (!report.ok) console.error("BCV rate sync failed", report);
  return Response.json(report, { status: report.ok ? 200 : 502, headers: { "cache-control": "no-store" } });
}
