"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

import { pageHref } from "@/lib/crm/pagination";
import { Icon } from "./icons";

/** A GET form still works before hydration; typing navigates after a short pause. */
export function SearchForm({ path, query, filters = {}, placeholder, label }: {
  path: string;
  query: string;
  filters?: Record<string, string>;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastSubmitted = useRef(query);
  const filterKey = JSON.stringify(filters);
  const previousScope = useRef(`${path}:${filterKey}`);

  useEffect(() => {
    const scope = `${path}:${filterKey}`;
    if (query !== lastSubmitted.current || scope !== previousScope.current) {
      if (timer.current) clearTimeout(timer.current);
      if (input.current) input.current.value = query;
      lastSubmitted.current = query;
    }
    previousScope.current = scope;
  }, [query, path, filterKey]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function search(value: string) {
    if (timer.current) clearTimeout(timer.current);
    const next = value.trim().slice(0, 80);
    if (next === lastSubmitted.current) return;
    lastSubmitted.current = next;
    startTransition(() => router.replace(pageHref(path, { ...filters, q: next }, 1), { scroll: false }));
  }

  return (
    <form action={path} aria-busy={pending} className="flex w-full gap-2 sm:w-auto" onSubmit={(event) => {
      event.preventDefault();
      search(input.current?.value ?? "");
    }}>
      {Object.entries(filters).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <input ref={input} type="search" name="q" defaultValue={query} maxLength={80} placeholder={placeholder} aria-label={label}
        className="h-9 min-w-0 flex-1 rounded-lg border border-outline bg-white px-3 text-sm outline-none focus:border-navy sm:w-[240px] sm:flex-none"
        onChange={(event) => {
          if (timer.current) clearTimeout(timer.current);
          const value = event.currentTarget.value;
          timer.current = setTimeout(() => search(value), 350);
        }}
      />
      <button type="submit" aria-label="Buscar" className="grid size-9 shrink-0 place-items-center rounded-lg border border-outline bg-white hover:border-navy pointer-coarse:size-11">
        <Icon name="search" className="size-4" />
      </button>
      <span className="sr-only" role="status">{pending ? "Buscando…" : ""}</span>
    </form>
  );
}
