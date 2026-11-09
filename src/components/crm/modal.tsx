"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "./icons";

// Modals of the platform, on the native <dialog>: focus stays inside, Escape
// closes, the page behind is inert. On phones the panel rises from the
// bottom as a sheet. The content mounts on open, so every opening starts
// with a fresh form. A form inside (ActionForm) closes the modal when its
// action confirms, and shows its errors next to the buttons.

type ModalApi = { close: () => void };
const ModalContext = createContext<ModalApi | null>(null);

/** The modal around a component, if any. */
export const useModal = () => useContext(ModalContext);

const TRIGGERS = {
  link: "inline-flex items-center gap-1.5 text-[13px] font-medium text-teal hover:text-navy",
  quiet: "inline-flex items-center gap-1.5 text-[13px] font-medium text-stone hover:text-[#b03a36]",
  secondary:
    "inline-flex h-9 items-center gap-2 rounded-lg border border-outline bg-white px-3 text-[13px] font-medium text-navy hover:border-navy",
  primary: "inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal",
} as const;

const TONES = {
  navy: "bg-frost text-navy",
  teal: "bg-mint/30 text-[#135c62]",
  coral: "bg-coral/10 text-[#b03a36]",
} as const;

export function Modal({
  trigger,
  triggerIcon,
  triggerVariant = "link",
  triggerLabel,
  title,
  description,
  icon,
  tone = "navy",
  size = "md",
  children,
}: {
  /** What the trigger button says. */
  trigger: ReactNode;
  triggerIcon?: IconName;
  triggerVariant?: keyof typeof TRIGGERS;
  /** Accessible name of the trigger when its text is not enough ("Editar" → "Editar Consulta general"). */
  triggerLabel?: string;
  title: string;
  description?: ReactNode;
  /** Icon in a soft tile beside the title. */
  icon?: IconName;
  tone?: keyof typeof TONES;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressedOnBackdrop = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  const close = () => ref.current?.close();
  const width = size === "sm" ? "sm:w-[400px]" : size === "lg" ? "sm:w-[640px]" : "sm:w-[480px]";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className={TRIGGERS[triggerVariant]}
      >
        {triggerIcon && <Icon name={triggerIcon} className="size-4" />}
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onPointerDown={(event) => {
          pressedOnBackdrop.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          // A press and release on the dim backdrop (the dialog box itself, outside the panel).
          if (pressedOnBackdrop.current && event.target === event.currentTarget) close();
          pressedOnBackdrop.current = false;
        }}
        className="modal"
      >
        {open && (
          <ModalContext value={{ close }}>
            <div
              className={`modal-panel flex max-h-[calc(100dvh-24px)] w-full flex-col overflow-y-auto rounded-t-2xl border border-line bg-white text-navy shadow-[0_24px_64px_-24px_rgba(27,42,85,0.5)] sm:max-h-[calc(100dvh-48px)] sm:rounded-2xl ${width}`}
            >
              <div className="flex items-start gap-4 px-6 pt-6 pb-4">
                {icon && (
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}>
                    <Icon name={icon} className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id={`${id}-title`} className="font-serif text-[22px] leading-tight tracking-[-0.01em]">
                    {title}
                  </h2>
                  {description && (
                    <p id={`${id}-description`} className="mt-1 text-sm leading-relaxed text-muted">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Cerrar"
                  className="-mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-lg text-stone hover:bg-sand hover:text-navy"
                >
                  <Icon name="x" className="size-4" />
                </button>
              </div>
              <div className="px-6 pb-6">{children}</div>
            </div>
          </ModalContext>
        )}
      </dialog>
    </>
  );
}
