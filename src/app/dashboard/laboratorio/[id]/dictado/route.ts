import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { connection } from "next/server";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth";
import { clinicDayOf, isUuid, localTime } from "@/lib/crm/clinic";
import { can, isRole } from "@/lib/crm/roles";
import { getLabReport } from "@/lib/lab/data";
import { DICTATION_LIMITS, normalizeDictation, normalizeResult, type DictationEvent } from "@/lib/lab/dictation";
import { dictationConfig } from "@/lib/lab/dictation-config";
import { DICTATION_SCHEMA, DICTATION_SYSTEM, dictationUserTurn } from "@/lib/lab/dictation-prompt";
import { arrayItemReader } from "@/lib/lab/json-stream";

export const maxDuration = 120;

// Sorting a dictation. The browser sends the text the bioanalyst spoke; Claude
// sorts it into the catalog's tests and the answer streams back as one JSON
// object per line: each result as soon as it is written (checked against the
// catalog first), then the whole checked answer. Nothing is saved here: the
// member reviews the results in the editor, which saves the draft as usual.
// Claude gets the dictation, the patient's sex and age and the tests already on
// the report, never the patient's name or ID.

const json = (status: number, message: string) =>
  new Response(`${JSON.stringify({ type: "error", message } satisfies DictationEvent)}\n`, {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function POST(request: Request, ctx: RouteContext<"/dashboard/laboratorio/[id]/dictado">) {
  await connection();
  if (!(await getCurrentUser())) return json(401, "Inicia sesión de nuevo para dictar.");
  const profile = await getCurrentProfile();
  if (!isRole(profile?.role) || !can(profile.role).labReports) return json(403, "Solo los médicos y los administradores preparan informes de laboratorio.");
  const config = dictationConfig();
  if (!config) return json(503, "El dictado no está activado: falta la clave de Claude (ANTHROPIC_API_KEY) en el servidor.");

  const { id } = await ctx.params;
  if (!isUuid(id)) return json(404, "Informe no válido.");
  const body: unknown = await request.json().catch(() => null);
  const transcript = typeof body === "object" && body && "transcript" in body && typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (transcript.length < 2) return json(400, "No se escuchó ningún resultado. Dicta de nuevo.");
  if (transcript.length > DICTATION_LIMITS.transcript) return json(413, "El dictado es muy largo. Aplica una parte y dicta el resto después.");

  const report = await getLabReport(id);
  if (!report) return json(404, "No encontramos este informe.");
  if (report.status !== "draft") return json(409, "Este informe ya está validado. Recarga la página.");

  const now = new Date();
  const userTurn = dictationUserTurn({
    transcript,
    facts: report.facts,
    today: clinicDayOf(now),
    now: localTime(now.toISOString()),
    sections: report.content.sections,
  });

  // The member closing the review stops the request, and Claude's answer with it.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: DictationEvent) => {
        if (open) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      // Results as they are written: each one is checked, and sent again only if its value changed.
      let sent = new Map<string, string>();
      const onItem = (raw: unknown) => {
        const result = normalizeResult(raw);
        if (!result || sent.get(result.id) === result.value) return;
        sent.set(result.id, result.value);
        send({ type: "result", result });
      };
      let read = arrayItemReader("results", onItem);

      try {
        const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 1, timeout: 110_000 });
        const answer = client.beta.messages.stream(
          {
            model: config.model,
            max_tokens: 32_000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: config.effort, format: { type: "json_schema", schema: DICTATION_SCHEMA } },
            system: [{ type: "text", text: DICTATION_SYSTEM, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: userTurn }],
          },
          { signal: abort.signal },
        );
        answer.on("streamEvent", (event) => {
          if (event.type === "content_block_start" && event.content_block.type === "text") {
            // A new answer (after a fallback, the substitute model starts over).
            if (sent.size) send({ type: "reset" });
            sent = new Map();
            read = arrayItemReader("results", onItem);
          } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            read(event.delta.text);
          }
        });

        const message = await answer.finalMessage();
        if (message.stop_reason === "refusal") {
          send({ type: "error", message: "Claude no pudo procesar este dictado. Escribe los resultados o dicta de nuevo con otras palabras." });
          return;
        }
        if (message.stop_reason === "max_tokens") {
          send({ type: "error", message: "El dictado tiene demasiados resultados para una sola vez. Dicta por partes." });
          return;
        }
        const dictation = normalizeDictation(JSON.parse(finalText(message.content)));
        const seconds = Math.round((Date.now() - started) / 100) / 10;
        send({ type: "done", dictation, seconds });
        console.info(
          JSON.stringify({
            event: "lab_dictation",
            model: message.model,
            seconds,
            characters: transcript.length,
            results: dictation.results.length,
            input_tokens: message.usage.input_tokens,
            cache_read_tokens: message.usage.cache_read_input_tokens,
            cache_write_tokens: message.usage.cache_creation_input_tokens,
            output_tokens: message.usage.output_tokens,
          }),
        );
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error("lab dictation failed", error instanceof Anthropic.APIError ? `${error.status} ${error.name}` : error);
          send({ type: "error", message: failure(error) });
        }
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed by the browser leaving.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

/** The answer's text: after a fallback, only what the last model wrote. */
function finalText(content: BetaContentBlock[]) {
  const last = content.map((block) => block.type).lastIndexOf("fallback");
  return content
    .slice(last + 1)
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");
}

function failure(error: unknown) {
  if (error instanceof SyntaxError) return "La respuesta de Claude llegó incompleta. Inténtalo de nuevo.";
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "La clave de Claude del servidor no es válida. Avisa a un administrador.";
  }
  if (error instanceof Anthropic.RateLimitError) return "Claude está recibiendo muchas solicitudes. Espera unos segundos e inténtalo de nuevo.";
  if (error instanceof Anthropic.APIConnectionError) return "No se pudo conectar con Claude. Revisa la conexión e inténtalo de nuevo.";
  if (error instanceof Anthropic.InternalServerError) return "Claude está saturado en este momento. Inténtalo de nuevo en unos segundos.";
  return "No se pudo procesar el dictado. Inténtalo de nuevo.";
}
