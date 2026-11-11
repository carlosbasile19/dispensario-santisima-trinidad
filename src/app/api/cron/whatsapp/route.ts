import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";

import { runDailyWhatsAppJob } from "@/lib/whatsapp/send";

export const maxDuration = 300;

// Vercel Cron calls this once a day (vercel.json) with
// "Authorization: Bearer $CRON_SECRET". It does the WhatsApp housekeeping and
// sends whatever was left pending (see runDailyWhatsAppJob in
// lib/whatsapp/send.ts), and answers what it did, as JSON. The reminders go
// out one hour before each visit, from ./reminders.

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
  const report = await runDailyWhatsAppJob();
  if (!report.ok) console.error("WhatsApp daily job failed", report);
  return Response.json(report, { status: report.ok ? 200 : 502, headers: { "cache-control": "no-store" } });
}
