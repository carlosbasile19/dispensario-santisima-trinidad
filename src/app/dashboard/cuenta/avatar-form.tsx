"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/crm/ui";
import { removeAvatar, uploadAvatar, type AvatarFormState } from "../actions";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

const button =
  "h-9 rounded-lg border border-outline bg-white px-3.5 text-sm font-medium hover:border-navy disabled:opacity-60";

// The member's own profile photo: pick an image, preview it, and upload it to
// Supabase Storage through the uploadAvatar action.
export function AvatarForm({ name, src }: { name: string; src: string | null }) {
  const [uploadState, upload, uploading] = useActionState<AvatarFormState, FormData>(uploadAvatar, undefined);
  const [removeState, remove, removing] = useActionState<AvatarFormState, FormData>(removeAvatar, undefined);
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
      setClientError("La foto debe ser JPG, PNG o WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setClientError("La foto no puede pesar más de 2 MB.");
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

  return (
    <div className="flex flex-wrap items-center gap-4 px-5 py-5">
      {/* The local preview shows only while uploading; afterwards the refreshed page brings the stored photo. */}
      <Avatar name={name} src={uploading && preview ? preview : src} size="lg" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <form ref={formRef} action={upload}>
            <input
              ref={inputRef}
              name="avatar"
              type="file"
              accept={TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              onChange={onPick}
            />
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={button}>
              {uploading ? "Subiendo…" : src ? "Cambiar foto" : "Subir foto"}
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
        <p className="text-[12px] text-muted">JPG, PNG o WebP de hasta 2 MB.</p>
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
