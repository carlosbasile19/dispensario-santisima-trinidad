import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { ReportSigner } from "./types";

// The bioanalyst's signature image (lab_settings.signer_signature, in the
// private bucket lab-signatures). Only the PDF draws it, on validated
// reports; the printed boleta is signed by hand.

export const SIGNATURE_BUCKET = "lab-signatures";
export const SIGNATURE_MAX_BYTES = 1024 * 1024;

export type SignatureImage = { data: Buffer; format: "png" | "jpg" };

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** PNG or JPEG by its first bytes (the declared type is not trusted). */
export function imageFormat(bytes: Uint8Array): SignatureImage["format"] | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length > 8 && png.every((b, i) => bytes[i] === b)) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}

const normalize = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * The signature to draw on a validated report: the image in lab_settings,
 * when the report is signed by the bioanalyst configured there (a report
 * validated by someone who no longer signs gets no image). Null when there
 * is none or it cannot be read: the PDF then keeps an empty line.
 */
export async function signatureFor(signer: ReportSigner | null, admin: Admin | null): Promise<SignatureImage | null> {
  if (!signer || !admin) return null;
  const { data: settings } = await admin.from("lab_settings").select("signer_name, signer_signature").maybeSingle();
  if (!settings?.signer_signature || normalize(settings.signer_name) !== normalize(signer.name)) return null;
  const { data: file, error } = await admin.storage.from(SIGNATURE_BUCKET).download(settings.signer_signature);
  if (error || !file) {
    console.error("lab signature download failed", error?.message);
    return null;
  }
  const data = Buffer.from(await file.arrayBuffer());
  const format = imageFormat(data);
  return format ? { data, format } : null;
}
