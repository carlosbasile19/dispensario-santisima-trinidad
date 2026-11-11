export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ registerOTel }, { SlowSpanProcessor }] = await Promise.all([
    import("@vercel/otel"),
    import("./lib/slow-span-processor"),
  ]);
  registerOTel({
    serviceName: "dispensario-santisima-trinidad",
    // Next already instruments requests and fetches. Avoid recording each twice.
    instrumentations: [],
    // Default exporters include complete URLs. Only the processor's allowlisted
    // timings go to runtime logs; no patient data is sent to a tracing service.
    spanProcessors: [new SlowSpanProcessor()],
    autoDetectResources: false,
  });
}
