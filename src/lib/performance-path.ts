const STATIC_PATHS = new Set([
  "/", "/odontologia", "/bioanalisis", "/agendar", "/login", "/acceso-pendiente",
  "/auth/confirm", "/auth/error", "/dashboard", "/dashboard/agenda", "/dashboard/agenda/nueva",
  "/dashboard/pacientes", "/dashboard/pacientes/nuevo", "/dashboard/laboratorio",
  "/dashboard/laboratorio/nuevo", "/dashboard/calendarios", "/dashboard/cuenta",
  "/dashboard/contabilidad", "/dashboard/contabilidad/tarifas", "/dashboard/gestion",
  "/dashboard/miembros", "/dashboard/whatsapp", "/api/cron/bcv", "/api/cron/whatsapp",
  "/api/whatsapp/webhook", "/api/whatsapp/callback",
]);

/** Keep timing groups useful without sending patient IDs, slugs or search terms. */
export function performancePath(value: string): string {
  let path: string;
  try {
    path = new URL(value, "https://telemetry.invalid").pathname.replace(/\/$/, "") || "/";
  } catch {
    return "/other";
  }
  if (STATIC_PATHS.has(path)) return path;
  if (/^\/agendar\/[^/]+$/.test(path)) return "/agendar/[slug]";
  if (/^\/imprimir\/laboratorio\/[^/]+$/.test(path)) return "/imprimir/laboratorio/[id]";
  const detail = path.match(/^\/dashboard\/(pacientes|agenda|laboratorio|calendarios)\/[^/]+(\/pdf|\/horario|\/ajustes)?$/);
  return detail ? `/dashboard/${detail[1]}/[id]${detail[2] ?? ""}` : "/other";
}
