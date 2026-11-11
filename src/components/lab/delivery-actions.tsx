"use client";

import { useEffect, useState } from "react";

import { logLabDelivery, sendLabReportWhatsApp } from "@/app/dashboard/laboratorio/actions";
import { ActionForm, SubmitButton } from "@/components/crm/forms";
import { Icon } from "@/components/crm/icons";

// "Entregar resultados": print the boleta, download the PDF, or send it by
// WhatsApp. From the clinic's number when everything is in place (number
// connected, template approved, patient's consent), with the PDF locked with
// the patient's key; it already goes out on its own when the report is
// validated, so here it is sent again. Otherwise from this device's share
// sheet, which on a phone offers WhatsApp with the PDF attached, or the
// patient's chat plus the downloaded file on a computer.

type Props = {
  id: string;
  pdfUrl: string;
  printUrl: string;
  fileName: string;
  /** Digits of the patient's mobile for wa.me, if any. */
  phoneDigits: string | null;
  message: string;
  whatsApp: { ready: true; phone: string; keyLabel: string } | { ready: false; reason: string; fixable?: "patient" | "settings" };
  /** This revision already went out from the clinic's number. */
  sentBefore: boolean;
  patientHref: string;
  canConfigure: boolean;
};

const tile = "flex flex-col gap-3 rounded-xl border border-line bg-white p-4";

export function DeliveryActions(props: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [shared, setShared] = useState<string | null>(null);

  // The PDF is fetched ahead: Safari only shares inside the tap itself.
  useEffect(() => {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return;
    const probe = new File([new Blob(["%PDF"])], props.fileName, { type: "application/pdf" });
    if (!navigator.canShare({ files: [probe] })) return;
    let cancelled = false;
    fetch(props.pdfUrl, { credentials: "same-origin" })
      .then((response) => (response.ok ? response.blob() : null))
      .then((blob) => {
        if (cancelled || !blob) return;
        setFile(new File([blob], props.fileName, { type: "application/pdf" }));
        setCanShareFiles(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [props.pdfUrl, props.fileName]);

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: props.fileName });
      setShared("Compartido. Si lo enviaste por WhatsApp, revisa que llegó al paciente.");
      void logLabDelivery(props.id, "share");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") setShared("No se pudo compartir desde este dispositivo. Descarga el PDF y adjúntalo.");
    }
  };

  const chat = `https://wa.me/${props.phoneDigits ?? ""}?text=${encodeURIComponent(props.message)}`;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className={tile}>
        <span className="grid size-10 place-items-center rounded-xl bg-frost text-navy">
          <Icon name="printer" className="size-5" />
        </span>
        <div>
          <p className="font-medium">Boleta impresa</p>
          <p className="text-[13px] text-muted">Media hoja para doblar, con la portada del laboratorio detrás.</p>
        </div>
        <a
          href={props.printUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy"
        >
          <Icon name="printer" className="size-4" />
          Imprimir boleta
        </a>
      </div>

      <div className={tile}>
        <span className="grid size-10 place-items-center rounded-xl bg-mint/30 text-[#135c62]">
          <Icon name="file" className="size-5" />
        </span>
        <div>
          <p className="font-medium">PDF de marca</p>
          <p className="text-[13px] text-muted">El informe con el diseño del centro, para enviar o guardar.</p>
        </div>
        <div className="mt-auto flex gap-2">
          <a
            href={`${props.pdfUrl}?descargar=1`}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-outline bg-white px-3 text-sm font-medium text-navy hover:border-navy"
          >
            <Icon name="download" className="size-4" />
            Descargar
          </a>
          <a
            href={props.pdfUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Ver el PDF"
            className="grid size-10 place-items-center rounded-lg border border-outline bg-white text-navy hover:border-navy"
          >
            <Icon name="eye" className="size-4" />
          </a>
        </div>
      </div>

      <div className={`${tile} border-teal/40 bg-mint/[0.08]`}>
        <span className="grid size-10 place-items-center rounded-xl bg-[#25d366]/15 text-[#128c4b]">
          <Icon name="chat" className="size-5" />
        </span>
        <div>
          <p className="font-medium">WhatsApp</p>
          <p className="text-[13px] text-muted">
            {props.whatsApp.ready
              ? `Desde el número del centro al ${props.whatsApp.phone}. El PDF va protegido: se abre con ${props.whatsApp.keyLabel}.`
              : canShareFiles
                ? "Comparte el PDF desde este teléfono y elige WhatsApp."
                : "Abre el chat del paciente y adjunta el PDF descargado."}
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-2">
          {props.whatsApp.ready ? (
            <ActionForm action={sendLabReportWhatsApp} className="flex flex-col gap-2">
              <input type="hidden" name="report" value={props.id} />
              <SubmitButton icon="send" pendingLabel="Enviando…">
                {props.sentBefore ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
              </SubmitButton>
            </ActionForm>
          ) : null}
          {canShareFiles ? (
            <button
              type="button"
              onClick={share}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ${
                props.whatsApp.ready ? "border border-outline bg-white text-navy hover:border-navy" : "bg-navy text-white hover:bg-teal"
              }`}
            >
              <Icon name="share" className="size-4" />
              Compartir el PDF
            </button>
          ) : (
            <a
              href={chat}
              target="_blank"
              rel="noreferrer"
              onClick={() => void logLabDelivery(props.id, "share")}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium ${
                props.whatsApp.ready ? "border border-outline bg-white text-navy hover:border-navy" : "bg-navy text-white hover:bg-teal"
              }`}
            >
              <Icon name="external" className="size-4" />
              {props.phoneDigits ? "Abrir el chat del paciente" : "Abrir WhatsApp"}
            </a>
          )}
          {shared && <p className="text-[12px] text-[#135c62]">{shared}</p>}
          {!props.whatsApp.ready && (
            <p className="text-[12px] leading-snug text-stone">
              Envío automático: {props.whatsApp.reason}{" "}
              {props.whatsApp.fixable === "patient" ? (
                <a href={props.patientHref} className="font-medium text-teal hover:text-navy">
                  Ver ficha
                </a>
              ) : props.whatsApp.fixable === "settings" && props.canConfigure ? (
                <a href="/dashboard/whatsapp" className="font-medium text-teal hover:text-navy">
                  Configurar
                </a>
              ) : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
