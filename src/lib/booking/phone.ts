// Phone numbers the way the database keeps them: patients.phone_e164 comes
// from normalize_phone() in the booking_calendars migration. Keep the two in
// step. Shared by the booking page (to check a number as it is typed) and the
// server.

/**
 * "+58" and ten digits for a Venezuelan number however it is written
 * (0412-1234567, 0414 123 45 67, +58 424 1234567, 412.123.4567); "+" and the
 * digits for a number from abroad written with its country code; null otherwise.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  const digits = text.replace(/\D/g, "");
  const plus = text.startsWith("+");
  if (/^0[24]\d{9}$/.test(digits)) return `+58${digits.slice(1)}`;
  if (/^58[24]\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0058[24]\d{9}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^[24]\d{9}$/.test(digits) && !plus) return `+58${digits}`;
  if (plus && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** Online booking takes a Venezuelan mobile (04xx) or a number from abroad, not a landline. */
export const isBookingPhone = (e164: string | null): e164 is string =>
  e164 !== null && (e164.startsWith("+584") || !e164.startsWith("+58"));

/**
 * Light formatting while a Venezuelan number is typed: "04121234567" →
 * "0412-1234567", like the centre writes its own number. Anything else (a
 * number with + and a country code) is left as typed.
 */
export function formatPhoneInput(value: string) {
  if (!/^[\d\s.()-]*$/.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  if (!digits.startsWith("0")) return value;
  const local = digits.slice(0, 11);
  return local.length > 4 ? `${local.slice(0, 4)}-${local.slice(4)}` : local;
}
