"use client";

import type { ReactNode } from "react";

/**
 * An on/off switch on a native checkbox, so it works in any form (name,
 * defaultChecked) or controlled (checked, onCheckedChange).
 */
export function Switch({
  name,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  description,
}: {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className={`group inline-flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          name={name}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-10 rounded-full bg-outline transition-colors duration-200 peer-checked:bg-teal peer-focus-visible:shadow-[0_0_0_3px_rgba(27,42,85,0.18)]" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(27,42,85,0.3)] transition-transform duration-200 ease-out peer-checked:translate-x-4" />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-navy">{label}</span>}
          {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
