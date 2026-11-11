import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";

// These labels come from Next's instrumentation, never from a URL or a query.
const OPERATIONS = new Set([
  "BaseServer.handleRequest", "AppRender.getBodyResult", "AppRender.fetch",
  "AppRouteRouteHandlers.runHandler", "NextNodeServer.findPageComponents",
  "NextNodeServer.getLayoutOrPageModule", "ResolveMetadata.generateMetadata",
]);

/** Write slow span timings to the existing runtime logs, with no request data. */
export class SlowSpanProcessor implements SpanProcessor {
  onStart() {}

  onEnd(span: ReadableSpan) {
    const durationMs = span.duration[0] * 1000 + span.duration[1] / 1_000_000;
    if (durationMs < 1000) return;
    const operation = span.attributes["next.span_type"];
    const context = span.spanContext();
    console.info(JSON.stringify({
      event: "slow_span",
      operation: typeof operation === "string" && OPERATIONS.has(operation) ? operation : "request",
      durationMs: Math.round(durationMs),
      traceId: context.traceId,
      spanId: context.spanId,
      status: span.status.code,
    }));
  }

  async forceFlush() {}
  async shutdown() {}
}
