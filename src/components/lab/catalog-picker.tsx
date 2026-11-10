"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/crm/icons";
import { CATEGORIES, CATEGORY, PANEL, TESTS, panelTests } from "@/lib/lab/catalog";
import { panelSize, searchCatalog } from "@/lib/lab/search";
import type { CategoryKey } from "@/lib/lab/types";
import { Dialog } from "./dialog";

// "Agregar exámenes": the whole catalog in a dialog. A search box, one chip
// per area, the area's profiles as cards (a profile adds all its tests) and
// its single tests as a checklist. What the report already has shows as
// added. Nothing changes until "Agregar al informe".

export type CatalogChoice = { panels: string[]; tests: string[] };

const CHIP = "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium transition-colors";

export function CatalogPicker({
  open,
  onClose,
  onAdd,
  present,
  initialCategory = "all",
  suggested = [],
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (choice: CatalogChoice) => void;
  /** Tests already in the report. */
  present: Set<string>;
  initialCategory?: CategoryKey | "all";
  /** Panels suggested by the visit's services. */
  suggested?: string[];
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Agregar exámenes"
      description="Elige perfiles completos o pruebas sueltas. Puedes quitar cualquier prueba después."
      icon="flask"
      tone="teal"
      size="xl"
    >
      <PickerBody key={String(open)} onAdd={onAdd} onClose={onClose} present={present} initialCategory={initialCategory} suggested={suggested} />
    </Dialog>
  );
}

function PickerBody({
  onAdd,
  onClose,
  present,
  initialCategory,
  suggested,
}: {
  onAdd: (choice: CatalogChoice) => void;
  onClose: () => void;
  present: Set<string>;
  initialCategory: CategoryKey | "all";
  suggested: string[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryKey | "all">(initialCategory);
  const [panels, setPanels] = useState<Set<string>>(new Set());
  const [tests, setTests] = useState<Set<string>>(new Set());
  const { panels: foundPanels, tests: foundTests } = useMemo(() => searchCatalog(query, category), [query, category]);

  const chosenTests = useMemo(() => {
    const all = new Set(tests);
    for (const key of panels) for (const test of panelTests(PANEL[key])) all.add(test);
    for (const test of present) all.delete(test);
    return all;
  }, [panels, tests, present]);

  const togglePanel = (key: string) =>
    setPanels((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleTest = (key: string) =>
    setTests((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const counts = useMemo(() => {
    const map = new Map<CategoryKey, number>();
    for (const test of Object.values(TESTS)) map.set(test.category, (map.get(test.category) ?? 0) + 1);
    return map;
  }, []);

  const done = () => {
    onAdd({ panels: [...panels], tests: [...tests] });
    onClose();
  };

  const suggestions = suggested.filter((key) => PANEL[key]);

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-6 flex flex-col gap-3 bg-white px-6 pb-3">
        <label className="relative block">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: hemoglobina, perfil lipídico, orina, VDRL…"
            aria-label="Buscar en el catálogo"
            className="h-11 w-full rounded-xl border border-outline bg-white pr-3 pl-9 text-sm outline-none focus:border-navy focus:shadow-[0_0_0_3px_rgba(27,42,85,0.1)]"
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Áreas">
          <button
            type="button"
            role="tab"
            aria-selected={category === "all"}
            onClick={() => setCategory("all")}
            className={`${CHIP} ${category === "all" ? "border-navy bg-navy text-white" : "border-outline bg-white text-ink hover:border-navy"}`}
          >
            Todas
          </button>
          {CATEGORIES.filter((c) => counts.get(c.key)).map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={category === c.key}
              onClick={() => setCategory(c.key)}
              className={`${CHIP} ${category === c.key ? "border-navy bg-navy text-white" : "border-outline bg-white text-ink hover:border-navy"}`}
            >
              {c.short}
              <span className={`ml-1.5 text-[11px] ${category === c.key ? "text-white/70" : "text-stone"}`}>{counts.get(c.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {!query && category === "all" && suggestions.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium tracking-[0.06em] text-teal uppercase">
            <Icon name="calendar-check" className="size-4" />
            De la cita del paciente
          </h3>
          <PanelGrid keys={suggestions} chosen={panels} present={present} onToggle={togglePanel} />
        </section>
      )}

      {foundPanels.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12px] font-medium tracking-[0.06em] text-stone uppercase">Perfiles</h3>
          <PanelGrid keys={foundPanels.map((p) => p.key)} chosen={panels} present={present} onToggle={togglePanel} />
        </section>
      )}

      <section>
        <h3 className="mb-2 text-[12px] font-medium tracking-[0.06em] text-stone uppercase">Pruebas</h3>
        {foundTests.length ? (
          <ul className="grid gap-x-4 sm:grid-cols-2">
            {foundTests.map((test) => {
              const added = present.has(test.key);
              const checked = added || tests.has(test.key) || [...panels].some((key) => panelTests(PANEL[key]).includes(test.key));
              return (
                <li key={test.key}>
                  <label
                    className={`flex min-h-11 items-center gap-3 border-b border-line py-2 text-sm ${added ? "cursor-default text-stone" : "cursor-pointer hover:text-teal"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={added}
                      onChange={() => toggleTest(test.key)}
                      className="size-4 shrink-0 accent-[#1e7e86]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{test.label}</span>
                      <span className="block truncate text-[12px] text-stone">
                        {CATEGORY[test.category].short}
                        {test.unit ? ` · ${test.unit}` : ""}
                        {test.derive ? " · se calcula" : ""}
                      </span>
                    </span>
                    {added && <span className="text-[12px] text-teal">En el informe</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl bg-cream px-4 py-6 text-center text-sm text-muted">
            No hay pruebas con esa búsqueda. Puedes agregar una prueba personalizada desde cualquier sección.
          </p>
        )}
      </section>

      <div className="sticky -bottom-6 -mx-6 -mb-6 flex flex-col gap-3 border-t border-line bg-white/95 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {chosenTests.size ? (
            <>
              <span className="font-medium text-navy">{chosenTests.size}</span> {chosenTests.size === 1 ? "prueba nueva" : "pruebas nuevas"} para el informe
            </>
          ) : (
            "Marca los perfiles o las pruebas que se hizo el paciente."
          )}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-outline bg-white px-4 text-sm font-medium text-navy hover:border-navy">
            Cancelar
          </button>
          <button
            type="button"
            onClick={done}
            disabled={!chosenTests.size}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-teal disabled:opacity-50"
          >
            <Icon name="plus" className="size-4" />
            Agregar al informe
          </button>
        </div>
      </div>
    </div>
  );
}

function PanelGrid({
  keys,
  chosen,
  present,
  onToggle,
}: {
  keys: string[];
  chosen: Set<string>;
  present: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {keys.map((key) => {
        const panel = PANEL[key];
        const all = panelTests(panel);
        const inReport = all.every((test) => present.has(test));
        const selected = chosen.has(key);
        return (
          <li key={key}>
            <button
              type="button"
              aria-pressed={selected || inReport}
              disabled={inReport}
              onClick={() => onToggle(key)}
              className={`flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                inReport
                  ? "cursor-default border-line bg-cream text-stone"
                  : selected
                    ? "border-teal bg-mint/15 shadow-[0_0_0_1px_var(--color-teal)]"
                    : "border-line bg-white hover:border-navy"
              }`}
            >
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${
                  selected || inReport ? "border-teal bg-teal text-white" : "border-outline bg-white"
                }`}
              >
                {(selected || inReport) && <Icon name="check" className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-navy">{panel.title}</span>
                <span className="mt-0.5 block text-[12px] text-muted">
                  {inReport ? "Ya está en el informe" : panel.description ?? `${CATEGORY[panel.category].short} · ${panelSize(panel)} pruebas`}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] text-ink">{panelSize(panel)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
