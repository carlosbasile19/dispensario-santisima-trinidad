import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";

import { runReminderJob } from "@/lib/whatsapp/send";

export const maxDuration = 300;

// Vercel Cron calls this once a day (vercel.json), the afternoon before the
// visits, with "Authorization: Bearer $CRON_SECRET". It sends tomorrow's
// WhatsApp reminders (see runReminderJob in lib/whatsapp/send.ts) and
// answers what it did, as JSON.

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
  const report = await runReminderJob();
  if (!report.ok) console.error("WhatsApp reminder job failed", report);
  return Response.json(report, { status: report.ok ? 200 : 502, headers: { "cache-control": "no-store" } });
}
