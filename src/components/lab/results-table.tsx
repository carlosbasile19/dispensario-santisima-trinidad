import { CATEGORY } from "@/lib/lab/catalog";
import { flagFor, referenceLines, type PatientFacts } from "@/lib/lab/reference";
import { groupRows, printedSections } from "@/lib/lab/report";
import type { ReportSection } from "@/lib/lab/types";
import { FlagBadge } from "./section-editor";

/** A validated report's results, read-only, as the team checks them before handing them out. */
export function ResultsTable({ sections, facts }: { sections: ReportSection[]; facts: PatientFacts }) {
  return (
    <div className="flex flex-col gap-5">
      {printedSections(sections).map((section) => (
        <section key={section.id} className="overflow-hidden rounded-xl border border-line bg-white">
          <header className="border-b border-line px-5 py-3">
            <p className="text-[11px] tracking-[0.12em] text-teal uppercase">{CATEGORY[section.category].short}</p>
            <h3 className="font-serif text-[19px] leading-tight">{section.title}</h3>
          </header>
          {groupRows(section.rows).map((group, i) => (
            <div key={`${group.title}-${i}`}>
              {group.title && (
                <p className="bg-cream/70 px-5 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.1em] text-[#135c62] uppercase">{group.title}</p>
              )}
              <ul className="divide-y divide-line">
                {group.rows.map((row) => {
                  const flag = flagFor(row, facts);
                  const reference = referenceLines(row, facts);
                  return (
                    <li
                      key={row.id}
                      className={`grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-x-4 gap-y-1 px-5 py-2.5 text-sm sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_90px] ${flag ? "bg-coral/[0.04]" : ""}`}
                    >
                      <span className="min-w-0 text-navy">
                        {row.label}
                        {row.method && <span className="block text-[11px] text-stone italic">{row.method}</span>}
                      </span>
                      <span className={`min-w-0 font-medium ${flag ? "text-[#b03a36]" : ""}`}>
                        {row.value} {row.unit && <span className="font-normal text-muted">{row.unit}</span>}
                      </span>
                      <span className="col-span-2 min-w-0 text-[12px] text-muted sm:col-span-1">{reference.join(" · ")}</span>
                      <span className="hidden sm:block">{flag && <FlagBadge flag={flag} />}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {section.note.trim() && <p className="border-t border-line bg-cream/50 px-5 py-2.5 text-[13px] text-ink italic">{section.note}</p>}
        </section>
      ))}
    </div>
  );
}
