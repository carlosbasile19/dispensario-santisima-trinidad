import { connection } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/crm/clinic";
import { pdfFileName } from "@/lib/lab/config";
import { getLabReport } from "@/lib/lab/data";
import { reportNumber } from "@/lib/lab/report";
import { reportPdf } from "@/lib/lab/whatsapp";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

// The branded PDF of a report, rendered on request for a member who sees it
// (RLS). Drafts carry a BORRADOR watermark. ?descargar=1 downloads it; a
// download of a validated report is logged as a delivery.
export async function GET(request: Request, ctx: RouteContext<"/dashboard/laboratorio/[id]/pdf">) {
  await connection();
  if (!(await getCurrentUser())) return new Response("Inicia sesión para ver este informe.", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Informe no válido.", { status: 404 });

  const report = await getLabReport(id);
  if (!report) return new Response("No encontramos este informe.", { status: 404 });

  const pdf = await reportPdf(report);
  const download = new URL(request.url).searchParams.get("descargar") === "1";
  if (download && report.status === "final") {
    const supabase = await createClient();
    await supabase.from("lab_report_deliveries").insert({ report_id: report.id, channel: "download" });
  }

  const name = pdfFileName(reportNumber(report.number));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
