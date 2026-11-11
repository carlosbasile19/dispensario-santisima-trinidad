"use client";

import { useActionState, useRef, useState } from "react";

import type { FormState } from "@/lib/crm/form-state";
import { removeLabSignature, uploadLabSignature } from "./actions";

const MAX_BYTES = 1024 * 1024;
const TYPES = ["image/png", "image/jpeg"];

const button =
  "h-9 rounded-lg border border-outline bg-white px-3.5 text-sm font-medium hover:border-navy disabled:opacity-60";

// The signer's handwritten signature for the PDF: pick an image, it uploads
// right away and the page shows the stored one. `src` is a short-lived
// signed link to the stored image (the bucket is private).
export function SignatureForm({ src, signer }: { src: string | null; signer: string }) {
  const [uploadState, upload, uploading] = useActionState<FormState, FormData>(uploadLabSignature, undefined);
  const [removeState, remove, removing] = useActionState<FormState, FormData>(removeLabSignature, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"upload" | "remove" | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setClientError(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setClientError("La firma debe ser una imagen PNG o JPG.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setClientError("La imagen no puede pesar más de 1 MB.");
      event.target.value = "";
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setLastAction("upload");
    formRef.current?.requestSubmit();
  }

  const state = lastAction === "remove" ? removeState : uploadState;
  const error = clientError ?? state?.error;
  const busy = uploading || removing;
  const shown = uploading && preview ? preview : src;

  return (
    <div className="flex flex-wrap items-center gap-5 px-5 py-5">
      {/* As it sits on the PDF: over the line, above the signer's name. */}
      <div className="flex w-[220px] shrink-0 flex-col items-center">
        <div className="flex h-[70px] w-full items-end justify-center">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed link to a private file, or a local preview
            <img src={shown} alt={`Firma de ${signer}`} className="max-h-[70px] max-w-full object-contain" />
          ) : (
            <span className="pb-1 text-[12px] text-stone">Sin firma: el PDF lleva la línea en blanco</span>
          )}
        </div>
        <div className="mt-1 h-px w-full bg-navy" />
        <p className="mt-1 truncate font-serif text-sm text-navy">{signer}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <form ref={formRef} action={upload}>
            <input
              ref={inputRef}
              name="signature"
              type="file"
              accept={TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              onChange={onPick}
            />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={button}>
              {uploading ? "Subiendo…" : src ? "Cambiar firma" : "Subir firma"}
            </button>
          </form>
          {src && (
            <form action={remove} onSubmit={() => setLastAction("remove")}>
              <button type="submit" disabled={busy} className={`${button} text-muted`}>
                {removing ? "Quitando…" : "Quitar"}
              </button>
            </form>
          )}
        </div>
        <p className="text-[12px] text-muted">
          PNG con fondo transparente (o JPG sobre fondo blanco), recortada a la firma, de hasta 1 MB. Va en el PDF de los
          informes validados que se envían por WhatsApp o se descargan. La boleta impresa se firma a mano.
        </p>
        {error && (
          <p role="alert" className="text-sm text-[#b03a36]">
            {error}
          </p>
        )}
        {!error && state?.message && (
          <p role="status" className="text-sm text-[#135c62]">
            {state.message}
          </p>
        )}
      </div>
    </div>
  );
}
