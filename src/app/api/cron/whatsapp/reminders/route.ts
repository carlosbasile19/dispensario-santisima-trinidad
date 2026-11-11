import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { runHourBeforeReminders } from "@/lib/whatsapp/send";

export const maxDuration = 60;

// pg_cron calls this every five minutes (migration
// 20261111205916_whatsapp_reminder_schedule) with the Vault token
// "whatsapp_reminders_token" as a bearer token; "Bearer $CRON_SECRET" works
// too, to run it by hand. It sends the reminders of the visits that start
// within the hour (see runHourBeforeReminders in lib/whatsapp/send.ts) and
// answers what it did, as JSON.

function matchesCronSecret(header: string) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function authorized(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (matchesCronSecret(header)) return true;
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length < 32 || token.length > 200) return false;
  const admin = createAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("whatsapp_reminders_token_ok", { token });
  if (error) console.error("whatsapp_reminders_token_ok failed", error.code, error.message);
  return data === true;
}

export async function GET(request: Request) {
  await connection();
  if (!(await authorized(request))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runHourBeforeReminders();
  if (!report.ok) console.error("WhatsApp reminders failed", report);
  return Response.json(report, { status: report.ok ? 200 : 502, headers: { "cache-control": "no-store" } });
}
