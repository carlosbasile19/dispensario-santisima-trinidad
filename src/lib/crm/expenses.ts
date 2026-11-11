// Gastos: how the centre pays out, the week it is summed by, and where the
// money went. Mirrors supabase/migrations/*_expenses.sql.

import { PAYMENT_METHODS, addDays } from "./clinic";

/** Ways the centre pays a supplier. Dollars: Zelle and cash; the rest bolívares at the day's BCV rate. */
export const EXPENSE_METHODS = ["pago_movil", "transfer_bs", "cash_bs", "zelle", "cash_usd"] as const;
export type ExpenseMethod = (typeof EXPENSE_METHODS)[number];

export const isExpenseMethod = (value: unknown): value is ExpenseMethod =>
  typeof value === "string" && (EXPENSE_METHODS as readonly string[]).includes(value);

/** Label, currency and icon: the same as the payment methods of the same name. */
export const expenseMethod = (method: ExpenseMethod) => PAYMENT_METHODS[method];

/** The Monday of a day's week (weeks run Monday to Sunday). */
export function weekStart(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((weekday + 6) % 7));
}

/** The seven days of the week that starts on `monday`. */
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

const dayMonth = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric", month: "long" });
const dayOnly = new Intl.DateTimeFormat("es-VE", { timeZone: "UTC", day: "numeric" });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** "9 al 15 de noviembre", or "30 de noviembre al 6 de diciembre" across months. */
export function formatWeek(monday: string) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${sameMonth ? dayOnly.format(at(monday)) : dayMonth.format(at(monday))} al ${dayMonth.format(at(sunday))}`;
}

/** Venezuelan account numbers have 20 digits: "0102-0123-45-0123456789". Anything else is shown as typed. */
export function formatAccount(account: string) {
  const digits = account.replace(/[\s-]/g, "");
  return /^\d{20}$/.test(digits)
    ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`
    : account;
}

export type SupplierAccounts = {
  document: string | null;
  bank: string | null;
  account_number: string | null;
  pago_movil_phone: string | null;
  notes: string | null;
};

const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/**
 * Where the money went, for the method used: the pago móvil details for a
 * pago móvil, the bank account for a transfer, the notes (a Zelle e-mail)
 * for Zelle. Null when the supplier has nothing on file for it (and for cash).
 */
export function destinationFor(supplier: SupplierAccounts, method: ExpenseMethod): string | null {
  const text = (() => {
    switch (method) {
      case "pago_movil":
        return supplier.pago_movil_phone ? join("Pago móvil", supplier.bank, supplier.pago_movil_phone, supplier.document) : null;
      case "transfer_bs":
        return supplier.account_number ? join(supplier.bank, formatAccount(supplier.account_number), supplier.document) : null;
      case "zelle":
        return supplier.notes ? join("Zelle", supplier.notes) : null;
      default:
        return null;
    }
  })();
  return text ? text.slice(0, 200) : null;
}

/** Banks of Venezuela with their code, offered while typing a supplier's bank. */
export const VENEZUELAN_BANKS = [
  "0102 Banco de Venezuela",
  "0104 Venezolano de Crédito",
  "0105 Mercantil",
  "0108 Provincial (BBVA)",
  "0114 Bancaribe",
  "0115 Exterior",
  "0128 Banco Caroní",
  "0134 Banesco",
  "0137 Sofitasa",
  "0138 Banco Plaza",
  "0151 BFC Banco Fondo Común",
  "0156 100% Banco",
  "0157 DelSur",
  "0163 Banco del Tesoro",
  "0166 Banco Agrícola de Venezuela",
  "0168 Bancrecer",
  "0169 Mi Banco",
  "0171 Banco Activo",
  "0172 Bancamiga",
  "0174 Banplus",
  "0175 Banco Bicentenario",
  "0177 Banfanb",
  "0191 BNC Banco Nacional de Crédito",
] as const;
