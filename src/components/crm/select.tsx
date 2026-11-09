"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { normalize, panelClass, useFloatingPanel } from "./floating";
import { Icon, type IconName } from "./icons";
import { Avatar } from "./ui";

// The platform's dropdown. A button that opens a listbox panel: options can
// carry an icon or a person's initials, a second line and a detail on the
// right (a price), grouped under headings, with a search field for long
// lists. The value travels in a regular input named `name`, so it works in
// any form, takes part in `required` validation and follows form.reset().

export type SelectOption = {
  value: string;
  label: string;
  /** Second line under the label. */
  description?: string;
  /** Right-aligned detail, such as a price. */
  meta?: string;
  /** Leading icon in a soft tile. */
  icon?: IconName;
  /** Leading initials of a person's name. */
  avatar?: string;
  /** Heading the option is listed under; a group's options must be adjacent. */
  group?: string;
  /** Extra words that search and type-ahead match, e.g. "14:00". */
  keywords?: string;
  disabled?: boolean;
};

type Props = {
  options: SelectOption[];
  name?: string;
  /** Controlled value. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Search field in the panel. By default on from 9 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Icon shown in the trigger before the label (the options keep theirs). */
  triggerIcon?: IconName;
  /** Submit the surrounding form as soon as a value is chosen. */
  submitOnChange?: boolean;
  size?: "sm" | "md";
  /** Accessible name when the select is not inside a <label>. */
  "aria-label"?: string;
  className?: string;
  /** Minimum width of the panel in pixels (it is never narrower than the trigger). */
  panelMinWidth?: number;
  emptyText?: string;
};

const TRIGGER_SIZE = {
  md: "h-10 px-3 text-sm gap-2.5",
  sm: "h-9 px-2.5 text-[13px] gap-2",
} as const;

export function Select({
  options,
  name,
  value: controlled,
  defaultValue = "",
  onValueChange,
  placeholder = "Elige una opción",
  required = false,
  disabled = false,
  searchable,
  searchPlaceholder = "Buscar…",
  triggerIcon,
  submitOnChange = false,
  size = "md",
  "aria-label": ariaLabel,
  className = "",
  panelMinWidth = 240,
  emptyText = "Sin resultados",
}: Props) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [invalid, setInvalid] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const submitPending = useRef(false);

  const withSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const visible = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const haystack = normalize([o.label, o.description, o.meta, o.group, o.keywords].filter(Boolean).join(" "));
      return words.every((word) => haystack.includes(word));
    });
  }, [options, query]);

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  }, []);
  const dismiss = useCallback(() => close(false), [close]);

  useFloatingPanel({ open, triggerRef, panelRef, onDismiss: dismiss, minWidth: panelMinWidth, maxHeight: 360 });

  const firstEnabled = (list: SelectOption[], from = 0, step = 1) => {
    for (let i = from; i >= 0 && i < list.length; i += step) if (!list[i].disabled) return i;
    return -1;
  };

  const openPanel = () => {
    if (disabled) return;
    const index = visible.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : firstEnabled(visible));
    setOpen(true);
  };

  // On open: focus the search field or the list, and show the chosen option.
  useEffect(() => {
    if (!open) return;
    (withSearch ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
    const chosen = document.getElementById(optionId(Math.max(active, 0)));
    chosen?.scrollIntoView({ block: "center" });
    // Only when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId is stable for this instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  // A form reset brings an uncontrolled select back to its default value.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form || controlled !== undefined) return;
    const onReset = () => setUncontrolled(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  useEffect(() => {
    if (!submitPending.current) return;
    submitPending.current = false;
    inputRef.current?.form?.requestSubmit();
  }, [value]);

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return;
    if (controlled === undefined) setUncontrolled(option.value);
    if (option.value !== value) {
      onValueChange?.(option.value);
      if (submitOnChange) submitPending.current = true;
    }
    setInvalid(false);
    close(true);
  };

  const move = (step: number) => {
    if (!visible.length) return;
    let next = active;
    for (let n = 0; n < visible.length; n++) {
      next = (next + step + visible.length) % visible.length;
      if (!visible[next].disabled) break;
    }
    setActive(next);
  };

  const typeAhead = (key: string) => {
    const now = Date.now();
    typed.current = { text: (now - typed.current.at > 700 ? "" : typed.current.text) + key.toLowerCase(), at: now };
    const text = normalize(typed.current.text);
    const index = visible.findIndex(
      (o) =>
        !o.disabled &&
        (normalize(o.label).startsWith(text) || (o.keywords ?? "").split(/\s+/).some((k) => normalize(k).startsWith(text))),
    );
    if (index >= 0) setActive(index);
    return index;
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openPanel();
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey && !withSearch) {
      // Type-ahead on the closed select picks the match directly.
      const index = typeAhead(event.key);
      if (index >= 0) choose(visible[index]);
    }
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        if (!withSearch) {
          event.preventDefault();
          setActive(firstEnabled(visible));
        }
        break;
      case "End":
        if (!withSearch) {
          event.preventDefault();
          setActive(firstEnabled(visible, visible.length - 1, -1));
        }
        break;
      case "Enter":
        event.preventDefault();
        choose(visible[active]);
        break;
      case " ":
        if (!withSearch) {
          event.preventDefault();
          choose(visible[active]);
        }
        break;
      case "Escape":
        // Handled here so an open modal behind the panel stays open.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
      default:
        if (!withSearch && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) typeAhead(event.key);
    }
  };

  // Group the visible options, keeping each option's index in `visible`.
  const groups: { name?: string; items: { option: SelectOption; index: number }[] }[] = [];
  visible.forEach((option, index) => {
    const last = groups.at(-1);
    if (last && last.name === option.group) last.items.push({ option, index });
    else groups.push({ name: option.group, items: [{ option, index }] });
  });

  const activeId = open && active >= 0 && visible[active] ? optionId(active) : undefined;

  return (
    <div className={`relative min-w-0 ${className}`} data-picker-open={open || undefined}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={onTriggerKeyDown}
        className={`group flex w-full min-w-0 items-center rounded-lg border bg-white text-left text-navy outline-none transition-[border-color,box-shadow] focus-visible:border-navy focus-visible:shadow-[0_0_0_3px_rgba(27,42,85,0.1)] disabled:cursor-not-allowed disabled:bg-sand disabled:text-stone ${
          open ? "border-navy shadow-[0_0_0_3px_rgba(27,42,85,0.1)]" : invalid ? "border-coral" : "border-outline hover:border-navy/50"
        } ${TRIGGER_SIZE[size]}`}
      >
        {triggerIcon && <Icon name={triggerIcon} className="size-4 text-teal" />}
        {!triggerIcon && selected?.icon && <Icon name={selected.icon} className="size-4 text-teal" />}
        {!triggerIcon && !selected?.icon && selected?.avatar && <Avatar name={selected.avatar} size="xs" />}
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-stone"}`}>{selected?.label ?? placeholder}</span>
        {selected?.meta && <span className="shrink-0 font-mono text-[12px] text-muted">{selected.meta}</span>}
        <Icon name="chevrons" className="size-4 text-stone transition-colors group-hover:text-navy" />
      </button>

      {/* The value for the form. Kept focusable-less but rendered, so the
          browser can point its "required" message at the trigger. */}
      <input
        ref={inputRef}
        name={name}
        value={value}
        required={required}
        onChange={() => {}}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          triggerRef.current?.focus();
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full opacity-0"
      />

      {open && (
        <div
          ref={panelRef}
          popover="manual"
          onKeyDown={onPanelKeyDown}
          // The panel sits inside the field's <label>: keep its clicks from
          // re-activating the trigger.
          onClick={(event) => event.preventDefault()}
          className={panelClass}
        >
          {withSearch && (
            <div className="border-b border-line p-2">
              <div className="flex h-9 items-center gap-2 rounded-lg bg-cream px-2.5 text-sm">
                <Icon name="search" className="size-4 text-stone" />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listboxId}
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-navy outline-none placeholder:text-stone"
                />
              </div>
            </div>
          )}
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={withSearch ? undefined : -1}
            aria-activedescendant={withSearch ? undefined : activeId}
            aria-label={ariaLabel}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 outline-none"
          >
            {groups.map((group, g) => (
              <div key={`${group.name ?? ""}-${g}`} role="group" aria-label={group.name} className={g ? "mt-1 border-t border-line pt-1" : ""}>
                {group.name && (
                  <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.08em] text-stone uppercase" aria-hidden="true">
                    {group.name}
                  </p>
                )}
                {group.items.map(({ option, index }) => (
                  <OptionRow
                    key={option.value}
                    id={optionId(index)}
                    option={option}
                    selected={option.value === value}
                    active={index === active}
                    onPoint={() => !option.disabled && setActive(index)}
                    onChoose={() => choose(option)}
                  />
                ))}
              </div>
            ))}
            {visible.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{emptyText}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  id,
  option,
  selected,
  active,
  onPoint,
  onChoose,
}: {
  id: string;
  option: SelectOption;
  selected: boolean;
  active: boolean;
  onPoint: () => void;
  onChoose: () => void;
}) {
  const rich = Boolean(option.description || option.icon || option.avatar);
  let leading: ReactNode = null;
  if (option.icon) {
    leading = (
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
          selected ? "bg-teal text-white" : "bg-frost text-navy"
        }`}
      >
        <Icon name={option.icon} className="size-4" />
      </span>
    );
  } else if (option.avatar) {
    leading = <Avatar name={option.avatar} size="sm" />;
  }
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      onPointerMove={onPoint}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onChoose}
      className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm transition-colors select-none ${
        rich ? "py-2" : "py-1.5 min-h-9"
      } ${active ? "bg-frost/70" : ""} ${option.disabled ? "cursor-not-allowed opacity-45" : ""}`}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${selected ? "font-medium" : ""}`}>{option.label}</span>
        {option.description && <span className="mt-0.5 block truncate text-[12px] text-muted">{option.description}</span>}
      </span>
      {option.meta && <span className="shrink-0 font-mono text-[12px] text-ink">{option.meta}</span>}
      <Icon name="check" className={`size-4 shrink-0 text-teal ${selected ? "" : "invisible"}`} />
    </div>
  );
}
