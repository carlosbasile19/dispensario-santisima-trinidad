"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/crm/icons";

// A dialog opened from code, with the look of the platform's <Modal> (same
// <dialog class="modal">, bottom sheet on phones). The content mounts only
// while it is open.

const TONES = {
  navy: "bg-frost text-navy",
  teal: "bg-mint/30 text-[#135c62]",
  coral: "bg-coral/10 text-[#b03a36]",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  tone = "navy",
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  icon?: IconName;
  tone?: keyof typeof TONES;
  size?: "md" | "lg" | "xl";
  children: ReactNode;
  /** Sticky foot (buttons). */
  footer?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const width = size === "xl" ? "sm:w-[860px]" : size === "lg" ? "sm:w-[640px]" : "sm:w-[480px]";

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onPointerDown={(event) => {
        pressedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pressedOnBackdrop.current && event.target === event.currentTarget) onClose();
        pressedOnBackdrop.current = false;
      }}
      className="modal"
    >
      {open && (
        <div
          className={`modal-panel flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-white text-navy shadow-[0_24px_64px_-24px_rgba(27,42,85,0.5)] sm:max-h-[calc(100dvh-48px)] sm:rounded-2xl ${width}`}
        >
          <div className="flex shrink-0 items-start gap-4 px-6 pt-6 pb-4">
            {icon && (
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
                <Icon name={icon} className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id={`${id}-title`} className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
                {title}
              </h2>
              {description && <div className="mt-1 text-sm leading-relaxed text-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-stone hover:bg-sand hover:text-navy"
            >
              <Icon name="x" className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-col gap-3 border-t border-line bg-cream/70 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end sm:pb-4">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
