/** What a form's Server Action answers: an error to show, or a confirmation. */
export type FormState = { error?: string; message?: string } | undefined;

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Postgres/PostgREST error as returned by supabase-js. */
type DbError = { code?: string; hint?: string | null; message?: string } | null | undefined;

const BY_HINT: Record<string, string> = {
  missing_rate: "Falta la tasa BCV de hoy. Cárgala antes de cobrar.",
  exceeds_balance: "El monto es mayor que el saldo pendiente de la cita.",
  inactive_service: "Uno de los servicios ya no se ofrece. Elige otro.",
  invalid_professional: "El profesional asignado debe tener perfil de médico o director médico.",
};

/** A message in Spanish for a database error, so members never see raw SQL errors. */
export function dbErrorMessage(error: DbError, fallback = "No se pudo guardar. Inténtalo de nuevo.") {
  if (!error) return fallback;
  if (error.hint && BY_HINT[error.hint]) return BY_HINT[error.hint];
  if (error.code === "42501") return "Tu perfil no tiene permiso para hacer esto.";
  if (error.code === "23505") return "Ya existe un registro con esos datos.";
  return fallback;
}
