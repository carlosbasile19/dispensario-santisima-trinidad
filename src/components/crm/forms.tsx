"use client";

import { createContext, startTransition, useActionState, useContext, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import type { FormAction, FormState } from "@/lib/crm/form-state";
import { Icon, type IconName } from "./icons";
import { useModal } from "./modal";

// Form building blocks for the platform. Every mutation is a Server Action
// that answers a FormState; ActionForm shows its error or confirmation.

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-[13px] text-muted ${className}`}>
      {label}
      {children}
      {hint && <span className="text-[12px] text-stone">{hint}</span>}
    </label>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-[#b03a36]">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="text-sm text-[#135c62]">
        {state.message}
      </p>
    );
  }
  return null;
}

const Pending = createContext(false);
const Answer = createContext<FormState>(undefined);

/**
 * A form bound to a Server Action, with its answer shown under the fields.
 * It dispatches the action itself, so React does not clear what was typed
 * when the action answers an error; `resetOnSuccess` clears it after a
 * confirmation. Inside a modal, a confirmation closes the modal and errors
 * show in its ModalActions row. Before hydration it still submits as a plain form.
 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const modal = useModal();
  const [state, dispatch, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    const result = await action(previous, formData);
    if (resetOnSuccess && result?.message) ref.current?.reset();
    if (modal && result?.message) modal.close();
    return result;
  }, undefined);

  return (
    <form
      ref={ref}
      action={dispatch}
      onSubmit={(event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => dispatch(formData));
      }}
      className={className}
    >
      <Pending value={pending}>
        <Answer value={state}>{children}</Answer>
      </Pending>
      {!modal && <FormMessage state={state} />}
    </form>
  );
}

/**
 * The foot of a form in a modal: the form's error on the left, Cancelar
 * and the given buttons on the right.
 */
export function ModalActions({ children }: { children: ReactNode }) {
  const modal = useModal();
  const state = useContext(Answer);
  return (
    <div className="-mx-6 mt-6 -mb-6 flex flex-col gap-3 border-t border-line bg-cream/70 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:rounded-b-2xl sm:pb-4">
      <div className="min-w-0 flex-1">
        <FormMessage state={state} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => modal?.close()}
          className="h-10 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy"
        >
          Cancelar
        </button>
        {children}
      </div>
    </div>
  );
}

const BUTTON = {
  primary: "bg-navy text-white hover:bg-teal",
  secondary: "border border-outline bg-white text-navy hover:border-navy",
  danger: "border border-coral/40 bg-white text-[#b03a36] hover:border-coral",
  destructive: "bg-[#b03a36] text-white hover:bg-coral",
} as const;

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  icon,
  size = "md",
  disabled,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof BUTTON;
  icon?: IconName;
  size?: "sm" | "md";
  disabled?: boolean;
  name?: string;
  value?: string;
}) {
  const dispatching = useContext(Pending);
  const { pending: submitting } = useFormStatus();
  const pending = dispatching || submitting;
  const height = size === "sm" ? "h-9 px-3 text-[13px]" : "h-10 px-4 text-sm";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-60 ${height} ${BUTTON[variant]}`}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
