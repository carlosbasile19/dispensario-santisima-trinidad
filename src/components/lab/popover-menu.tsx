"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/crm/icons";

// A small menu under a button: the row actions of the results editor.

export type MenuItem = {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  tone?: "danger";
  checked?: boolean;
  hint?: string;
};

export function PopoverMenu({
  label,
  items,
  trigger,
  align = "right",
  className = "",
}: {
  /** Accessible name of the button. */
  label: string;
  items: (MenuItem | "separator")[];
  trigger: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={className}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className={`picker-panel absolute top-full z-40 mt-1 min-w-[220px] rounded-xl border border-line bg-white p-1 shadow-[0_16px_40px_-16px_rgba(27,42,85,0.35)] ${align === "right" ? "right-0" : "left-0"}`}
          data-side="bottom"
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <div key={`sep-${i}`} className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.checked}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] ${
                  item.tone === "danger" ? "text-[#b03a36] hover:bg-coral/10" : "text-ink hover:bg-sand hover:text-navy"
                }`}
              >
                {item.checked !== undefined ? (
                  <span className={`grid size-4 place-items-center ${item.checked ? "text-teal" : "text-transparent"}`}>
                    <Icon name="check" className="size-4" />
                  </span>
                ) : (
                  item.icon && <Icon name={item.icon} className="size-4" />
                )}
                <span className="min-w-0 flex-1">
                  {item.label}
                  {item.hint && <span className="block text-[11px] text-stone">{item.hint}</span>}
                </span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
