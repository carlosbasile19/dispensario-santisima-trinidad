"use server";

import { refresh } from "next/cache";

import { clinicToday, formatDay, isIsoDate, isUuid } from "@/lib/crm/clinic";
import { getTodayRate } from "@/lib/crm/data";
import { destinationFor, expenseMethod, isExpenseMethod } from "@/lib/crm/expenses";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { centsToInput, parseCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const NO_ACCOUNTING = "Solo Contabilidad puede hacer esto.";

/** A trimmed text field, null when empty, cut to `max` characters. */
const text = (formData: FormData, name: string, max: number) => {
  const value = String(formData.get(name) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
  return value || null;
};

/** Adds a supplier or updates one: who they are and the accounts the centre pays them into. */
export async function saveSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return { error: NO_ACCOUNTING };

  const id = formData.get("id");
  const name = text(formData, "name", 120);
  if (!name || name.length < 2) return { error: "Escribe el nombre del proveedor." };
  const supplier = {
    name,
    document: text(formData, "document", 30),
    bank: text(formData, "bank", 80),
    account_number: text(formData, "account_number", 30),
    pago_movil_phone: text(formData, "pago_movil_phone", 20),
    notes: text(formData, "notes", 300),
  };

  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("suppliers").update(supplier).eq("id", id)
    : await supabase.from("suppliers").insert(supplier);
  if (error) return { error: error.code === "23505" ? "Ya existe un proveedor con ese nombre." : dbErrorMessage(error) };
  refresh();
  return { message: isUuid(id) ? "Proveedor guardado." : "Proveedor añadido." };
}

/**
 * Records money paid out. The amount is in the method's currency; the
 * database applies that day's BCV rate for the other one and keeps the
 * supplier's account for the method as the destination.
 */
export async function addExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return { error: NO_ACCOUNTING };

  const day = formData.get("spent_on");
  const method = formData.get("method");
  const supplierId = formData.get("supplier");
  const description = text(formData, "description", 200);
  const cents = parseCents(String(formData.get("amount") ?? ""));
  if (!isIsoDate(day)) return { error: "Elige el día del gasto." };
  if (!isExpenseMethod(method)) return { error: "Elige cómo se pagó." };
  if (!description || description.length < 2) return { error: "Escribe en qué se gastó." };
  if (cents === null || cents <= 0n || cents > 99_999_999_999n) return { error: "Escribe el monto, con hasta 2 decimales." };

  const today = await clinicToday();
  if (day > today) return { error: "El gasto no puede ser de un día futuro." };

  const supabase = await createClient();
  let destination: string | null = null;
  if (isUuid(supplierId)) {
    const { data: supplier } = await supabase
      .from("suppliers")
      .select("document, bank, account_number, pago_movil_phone, notes")
      .eq("id", supplierId)
      .maybeSingle();
    if (!supplier) return { error: "Ese proveedor ya no existe." };
    destination = destinationFor(supplier, method);
  }

  // Today's rate is fetched from the BCV if the daily job has not run yet.
  if (day === today) await getTodayRate(today);

  const amount = Number(centsToInput(cents));
  const usd = expenseMethod(method).currency === "USD";
  // currency, rate and the other currency's amount are set by the
  // expenses_apply_rate trigger; members cannot write them.
  const row = {
    spent_on: day,
    description,
    supplier_id: isUuid(supplierId) ? supplierId : null,
    method,
    reference: text(formData, "reference", 60),
    destination,
    ...(usd ? { amount_usd: amount } : { amount_bs: amount }),
  } as TablesInsert<"expenses">;
  const { error } = await supabase.from("expenses").insert(row);
  if (error) {
    if (error.hint === "missing_expense_rate") {
      return { error: `Falta la tasa BCV del ${formatDay(day, "short")}. Cárgala en «Cobros y tasa BCV» y vuelve a intentarlo.` };
    }
    return { error: dbErrorMessage(error) };
  }
  refresh();
  return { message: "Gasto registrado." };
}

/** Deletes an expense entered by mistake. */
export async function deleteExpense(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return { error: NO_ACCOUNTING };
  const id = formData.get("expense");
  if (!isUuid(id)) return { error: "Gasto no válido." };

  const supabase = await createClient();
  const { error, count } = await supabase.from("expenses").delete({ count: "exact" }).eq("id", id);
  if (error) return { error: dbErrorMessage(error, "No se pudo borrar el gasto.") };
  if (!count) return { error: "Ese gasto ya no existe." };
  refresh();
  return { message: "Gasto borrado." };
}
