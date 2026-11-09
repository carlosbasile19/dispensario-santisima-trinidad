"use server";

import { refresh } from "next/cache";

import { isServiceArea, isUuid } from "@/lib/crm/clinic";
import { dbErrorMessage, type FormState } from "@/lib/crm/form-state";
import { centsToInput, parseCents } from "@/lib/crm/money";
import { getViewer } from "@/lib/crm/viewer";
import { createClient } from "@/lib/supabase/server";

const NO_ACCOUNTING = "Solo Contabilidad puede hacer esto.";

/**
 * Creates a service of the price list or updates one (name, area, price,
 * offered or not). The new price applies to services booked from now on;
 * visits already booked keep the price they were booked with.
 */
export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return { error: NO_ACCOUNTING };

  const id = formData.get("id");
  const area = formData.get("area");
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const cents = parseCents(String(formData.get("price") ?? ""));
  if (!isServiceArea(area)) return { error: "Elige el área del servicio." };
  if (name.length < 2 || name.length > 120) return { error: "Escribe el nombre del servicio." };
  if (cents === null || cents > 99_999_999n) return { error: "Escribe el precio en dólares, con hasta 2 decimales." };

  const service = {
    area,
    name,
    price_usd: Number(centsToInput(cents)),
    active: isUuid(id) ? formData.get("active") === "on" : true,
  };
  const supabase = await createClient();
  const { error } = isUuid(id)
    ? await supabase.from("services").update(service).eq("id", id)
    : await supabase.from("services").insert(service);
  if (error) {
    return { error: error.code === "23505" ? "Ya existe un servicio con ese nombre en esa área." : dbErrorMessage(error) };
  }
  refresh();
  return { message: isUuid(id) ? "Servicio guardado." : "Servicio añadido al tarifario." };
}

/** Voids a payment: it stays on record, struck through, and stops counting. */
export async function voidPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer.permissions.accounting) return { error: NO_ACCOUNTING };
  const payment = formData.get("payment");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  if (!isUuid(payment)) return { error: "Cobro no válido." };
  if (!reason) return { error: "Escribe el motivo de la anulación." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_payment", { payment, reason });
  if (error) return { error: dbErrorMessage(error, "No se pudo anular el cobro.") };
  refresh();
  return { message: "Cobro anulado." };
}
