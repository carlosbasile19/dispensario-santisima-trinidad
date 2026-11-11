import Image from "next/image";

import { BioanalisisLogo } from "@/components/service-logo";
import { LAB_INFO } from "@/lib/lab/config";
import { clockTime, dayShort, documentOf, fullName, stampDay, stampTime } from "@/lib/lab/format";
import { FLAG_INFO, flagFor, formatAge, referenceLines, type PatientFacts } from "@/lib/lab/reference";
import { PATIENT_TYPE_LABEL, groupRows, printedSections, reportNumber } from "@/lib/lab/report";
import type { ReportContent, ReportPatient, ReportRow, ReportSigner } from "@/lib/lab/types";
import mark from "../../../public/images/brand/mark.png";

// The printed boleta: the clinic's half-sheet result slip, as its Excel
// templates print it (header, Nº de examen, the patient strip, one table
// per exam, the bioanalyst's signature and the address box), only cleaner.
//
// Results are laid out in half-sheet panels. Two panels share a Letter or
// A4 sheet, which is folded in half with the results inside; the portada
// (cover) prints on the back of the first sheet. "Media carta" prints one
// panel per half-letter page. Panels are measured in inches, so what is on
// screen is what comes out of the printer.

export type Paper = "carta" | "a4" | "media";

export const PAPERS: Record<Paper, { label: string; hint: string; width: string; height: string; panel: number }> = {
  carta: { label: "Carta", hint: "Dos boletas por hoja, para doblar", width: "8.5in", height: "11in", panel: 5.5 },
  a4: { label: "A4", hint: "Dos boletas por hoja, para doblar", width: "210mm", height: "297mm", panel: 5.846 },
  media: { label: "Media carta", hint: "Una boleta por hoja", width: "8.5in", height: "5.5in", panel: 5.5 },
};

export type BoletaReport = {
  number: number;
  revision: number;
  status: "draft" | "final";
  patient: ReportPatient;
  facts: PatientFacts;
  content: ReportContent;
  signer: ReportSigner | null;
  finalizedAt: string | null;
  /** When the copy is printed (the boleta's FECHA and HORA). */
  printedAt: string;
};

// Pagination ------------------------------------------------------------------

/** One line of a panel: a section title, the column heads, a sub-heading, a row or a pair of short answers. */
type Line =
  | { kind: "title"; title: string; continued: boolean }
  | { kind: "head" }
  | { kind: "group"; title: string }
  | { kind: "row"; row: ReportRow }
  | { kind: "pairs"; rows: ReportRow[] };

const PX = 96; // CSS pixels per inch
const ROW = 15; // a result line, in px
const HEIGHTS = { title: 24, head: 17, group: 17 } as const;
/** Padding, header, patient strip and foot of a panel, in inches (measured in Chrome: 474 − 145 − 6 − 54 px leaves 269 px of results). */
const CHROME = 2.75;

const charsFit = (text: string, perLine: number) => Math.max(1, Math.ceil(text.length / perLine));

function rowLines(row: ReportRow, facts: PatientFacts) {
  if (isSentence(row, facts)) return charsFit(row.value, 92);
  const reference = referenceLines(row, facts).reduce((sum, line) => sum + charsFit(line, 34), 0);
  return Math.max(charsFit(row.label, 40) + (row.method ? 1 : 0), reference, charsFit(row.value, 20));
}

const lineHeight = (line: Line, facts: PatientFacts) =>
  line.kind === "row" ? rowLines(line.row, facts) * ROW : line.kind === "pairs" ? ROW : HEIGHTS[line.kind];

const isSentence = (row: ReportRow, facts: PatientFacts) => row.kind === "text" && !row.unit && referenceLines(row, facts).length === 0;
const isPair = (row: ReportRow, facts: PatientFacts) =>
  row.kind !== "number" && !row.unit && !row.method && referenceLines(row, facts).length === 0 && row.value.length <= 26;

/** The report's lines, split into panels that fit half a sheet. */
export function paginate(content: ReportContent, facts: PatientFacts, paper: Paper): Line[][] {
  const capacity = (PAPERS[paper].panel - CHROME) * PX;
  const panels: Line[][] = [[]];
  let used = 0;
  const current = () => panels[panels.length - 1];
  const fits = (h: number) => used + h <= capacity;
  const push = (line: Line, h: number) => {
    current().push(line);
    used += h;
  };
  const newPanel = () => {
    panels.push([]);
    used = 0;
  };

  for (const section of printedSections(content.sections)) {
    const groups = groupRows(section.rows);
    const table = groups.some((g) => g.rows.some((row) => !isPair(row, facts) && !isSentence(row, facts)));
    const lines: Line[] = [];
    for (const group of groups) {
      if (group.title) lines.push({ kind: "group", title: group.title });
      const pairs = group.rows.length > 1 && group.rows.every((row) => isPair(row, facts));
      if (pairs) for (let i = 0; i < group.rows.length; i += 2) lines.push({ kind: "pairs", rows: group.rows.slice(i, i + 2) });
      else for (const row of group.rows) lines.push({ kind: "row", row });
    }

    const opening = HEIGHTS.title + (table ? HEIGHTS.head : 0);
    // A section starts on a new panel unless its title and first lines fit.
    const firstLines = lines.slice(0, 2).reduce((sum, line) => sum + lineHeight(line, facts), 0);
    if (current().length && !fits(opening + firstLines)) newPanel();
    push({ kind: "title", title: section.title, continued: false }, HEIGHTS.title);
    if (table) push({ kind: "head" }, HEIGHTS.head);

    for (const line of lines) {
      const h = lineHeight(line, facts);
      if (!fits(h)) {
        newPanel();
        push({ kind: "title", title: section.title, continued: true }, HEIGHTS.title);
        if (table) push({ kind: "head" }, HEIGHTS.head);
      }
      push(line, h);
    }
    if (section.note.trim()) {
      const h = charsFit(section.note, 100) * 13 + 6;
      if (!fits(h)) newPanel();
      current().push({ kind: "row", row: noteRow(section.note) });
      used += h;
    }
  }
  if (content.notes.trim()) {
    const h = charsFit(content.notes, 100) * 13 + HEIGHTS.title;
    if (!fits(h)) newPanel();
    push({ kind: "title", title: "Observaciones", continued: false }, HEIGHTS.title);
    current().push({ kind: "row", row: noteRow(content.notes) });
    used += h - HEIGHTS.title;
  }
  return panels.filter((panel) => panel.length);
}

const noteRow = (text: string): ReportRow => ({
  id: `note-${text.length}`,
  test: null,
  label: "",
  unit: "",
  kind: "text",
  value: text.trim(),
  rules: [],
  refText: "",
  normal: [],
  flag: null,
  derive: null,
  decimals: null,
  method: "",
  note: "",
  group: "",
});

// Pieces of a panel ------------------------------------------------------------------

function Box({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`flex h-[17px] min-w-0 items-center truncate border border-black/70 px-1.5 text-[9.5px] leading-none ${className}`}>{children}</span>;
}

function Flag({ row, facts }: { row: ReportRow; facts: PatientFacts }) {
  const flag = flagFor(row, facts);
  if (!flag) return null;
  return (
    <span className="ml-1 text-[9px] font-semibold" title={FLAG_INFO[flag].label}>
      {FLAG_INFO[flag].arrow}
    </span>
  );
}

function PanelLine({ line, facts }: { line: Line; facts: PatientFacts }) {
  if (line.kind === "title") {
    return (
      <p className="h-[24px] border-b border-black pt-[5px] text-center text-[11px] font-semibold tracking-[0.06em] uppercase">
        {line.title}
        {line.continued && <span className="ml-1 text-[8.5px] font-normal tracking-normal normal-case">(continuación)</span>}
      </p>
    );
  }
  if (line.kind === "head") {
    return (
      <div className="grid h-[17px] grid-cols-[38%_17%_13%_32%] items-end border-b border-black/60 pb-[2px] text-[8px] tracking-[0.06em] uppercase">
        <span>Análisis</span>
        <span>Resultado</span>
        <span>Unidad</span>
        <span>Valor normal</span>
      </div>
    );
  }
  if (line.kind === "group") {
    return <p className="h-[17px] pt-[5px] text-[8.5px] font-semibold tracking-[0.06em] uppercase">{line.title}:</p>;
  }
  if (line.kind === "pairs") {
    return (
      <div className="grid h-[15px] grid-cols-2 gap-x-6 text-[9.5px] leading-[15px]">
        {line.rows.map((row) => (
          <div key={row.id} className="grid min-w-0 grid-cols-[48%_52%]">
            <span className="truncate uppercase">{row.label}</span>
            <span className="truncate font-medium">
              {row.value}
              <Flag row={row} facts={facts} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  const { row } = line;
  if (!row.label) {
    return <p className="py-[3px] text-[9px] leading-[13px] whitespace-pre-line italic">{row.value}</p>;
  }
  if (isSentence(row, facts)) {
    return (
      <div className="grid grid-cols-[38%_62%] text-[9.5px] leading-[15px]">
        <span className="uppercase">{row.label}</span>
        <span className="font-medium">{row.value}</span>
      </div>
    );
  }
  const reference = referenceLines(row, facts);
  return (
    <div className="grid grid-cols-[38%_17%_13%_32%] text-[9.5px] leading-[15px]">
      <span className="pr-2 uppercase">
        {row.label}
        {row.method && <span className="block text-[8px] leading-[13px] normal-case italic">({row.method})</span>}
      </span>
      <span className="font-medium">
        {row.value}
        <Flag row={row} facts={facts} />
      </span>
      <span>{row.unit}</span>
      <span className="text-[9px]">
        {reference.map((text, i) => (
          <span key={i} className="block">
            {text}
          </span>
        ))}
      </span>
    </div>
  );
}

function Header({ report, page, pages }: { report: BoletaReport; page: number; pages: number }) {
  const { patient, content } = report;
  return (
    <header className="shrink-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Image src={mark} alt="" className="h-[46px] w-auto" sizes="40px" />
          <div className="leading-tight">
            {/* The clinic first: the laboratory is one of its services. */}
            <p className="text-[9.5px] font-semibold tracking-[0.04em] uppercase">{LAB_INFO.clinicKind}</p>
            <p className="font-serif text-[15px] font-semibold">{LAB_INFO.clinicName}, C. A.</p>
            <p className="text-[9px]">
              {LAB_INFO.name} · RIF {LAB_INFO.rif}
            </p>
          </div>
        </div>
        <div className="pt-1 text-center">
          <p className="text-[17px] font-bold tracking-[0.12em] uppercase">Resultado de exámenes</p>
          <p className="mt-0.5 text-[8.5px] tracking-[0.08em] uppercase">
            {report.status === "draft" ? "Borrador sin validar · no entregar" : `Hoja ${page} de ${pages}${report.revision > 1 ? ` · revisión ${report.revision}` : ""}`}
          </p>
        </div>
        <div className="w-[1.25in] text-center">
          <p className="text-[8.5px] tracking-[0.06em] uppercase">Nº examen</p>
          <p className="mt-0.5 border border-black/70 py-[2px] font-mono text-[12px]">{reportNumber(report.number)}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr_auto_1fr_auto_1.6fr] items-center gap-x-1.5 text-[8.5px] uppercase">
        <span>Fecha:</span>
        <Box>{dayShort(stampDay(report.printedAt))}</Box>
        <span className="ml-2">Hora:</span>
        <Box>{stampTime(report.printedAt)}</Box>
        <span className="ml-2">Tipo de paciente:</span>
        <Box className="normal-case">{PATIENT_TYPE_LABEL[content.patientType]}</Box>
      </div>
      <p className="mt-1.5 border-t-2 border-black pt-[2px] text-center text-[10px] font-semibold tracking-[0.08em] uppercase">Datos del paciente</p>
      <div className="grid grid-cols-[1.1fr_2.6fr_0.55fr_0.75fr_1fr_0.9fr] gap-x-1.5 border-t border-black/60 pt-[2px] text-[8px] uppercase">
        <span>Cédula</span>
        <span>Nombre</span>
        <span>Sexo</span>
        <span>Edad</span>
        <span>Fecha / muestra</span>
        <span>Hora / muestra</span>
        <Box>{documentOf(patient) ?? "—"}</Box>
        <Box className="font-medium uppercase">{fullName(patient)}</Box>
        <Box>{patient.sex ?? "—"}</Box>
        <Box>{formatAge(patient.birth_date, content.sampledDay) ?? "—"}</Box>
        <Box>{dayShort(content.sampledDay)}</Box>
        <Box>{clockTime(content.sampledTime)}</Box>
      </div>
      <p className="mt-1 h-[13px] truncate text-[8.5px] leading-[13px]">{content.requestedBy ? `Médico solicitante: ${content.requestedBy}` : ""}</p>
    </header>
  );
}

function Foot({ report }: { report: BoletaReport }) {
  const signer = report.signer;
  return (
    <footer className="mt-auto flex shrink-0 items-end justify-between gap-6 pt-1.5">
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[7.5px]">↑ alto · ↓ bajo · • fuera de lo normal, según el valor de referencia</p>
        <p className="rounded-md border border-black/70 px-2 py-[3px] text-center text-[9px]">
          {LAB_INFO.address}. Tlf.: {LAB_INFO.phones.join(" · ")}
        </p>
      </div>
      <div className="w-[2.5in] shrink-0 text-center text-[8px] leading-[11px] uppercase">
        <div className="mx-auto mb-1 h-[22px] w-[2.1in] border-b border-black/70" />
        {signer ? (
          <>
            <p className="font-semibold">{signer.name}</p>
            <p>{[signer.id_number, signer.registry, signer.college].filter(Boolean).join(" · ")}</p>
          </>
        ) : (
          <p>Bioanalista</p>
        )}
      </div>
    </footer>
  );
}

/** One half-sheet slip. */
export function BoletaPanel({ report, lines, page, pages }: { report: BoletaReport; lines: Line[]; page: number; pages: number }) {
  return (
    <section className="relative flex h-full flex-col overflow-hidden px-[0.42in] pt-[0.3in] pb-[0.26in] text-black">
      <Header report={report} page={page} pages={pages} />
      <div className="mt-1.5 min-h-0 flex-1 overflow-hidden">
        {lines.map((line, i) => (
          <PanelLine key={i} line={line} facts={report.facts} />
        ))}
      </div>
      <Foot report={report} />
      {report.status === "draft" && (
        <p aria-hidden="true" className="pointer-events-none absolute inset-0 grid -rotate-12 place-items-center text-[64px] font-bold tracking-[0.2em] text-black/[0.06]">
          BORRADOR
        </p>
      )}
    </section>
  );
}

/** The cover, on the back of the first sheet: outside once folded. */
export function Portada({ report }: { report: BoletaReport }) {
  return (
    <section className="flex h-full flex-col items-center px-[0.6in] pt-[0.4in] pb-[0.3in] text-center text-black">
      <div className="flex w-full items-start justify-between text-[11px]">
        <span className="tracking-[0.12em] uppercase">{LAB_INFO.clinic}</span>
        <span>Fecha: {dayShort(stampDay(report.printedAt))}</span>
      </div>
      <div className="mt-3">
        <BioanalisisLogo size="sm" />
      </div>
      <p className="mt-3 font-serif text-[24px] italic">{LAB_INFO.legalName}</p>
      <p className="mt-1 text-[10px] tracking-[0.14em] uppercase">{LAB_INFO.name}</p>
      <p className="mt-4 text-[10px] tracking-[0.14em] uppercase">Paciente</p>
      <p className="mt-1 text-[18px] font-semibold uppercase">{fullName(report.patient)}</p>
      <p className="mt-1 font-mono text-[11px]">Nº {reportNumber(report.number)}</p>
      <p className="mt-auto w-full rounded-md border border-black/70 px-2 py-[3px] text-[9.5px]">
        {LAB_INFO.address}. Tlf.: {LAB_INFO.phones.join(" · ")}
      </p>
    </section>
  );
}

/** Tick marks at both edges of the fold line. */
function FoldMarks() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between">
      <span className="h-px w-[0.28in] bg-black/40" />
      <span className="text-[7px] tracking-[0.2em] text-black/35 uppercase print:hidden">doblar aquí</span>
      <span className="h-px w-[0.28in] bg-black/40" />
    </div>
  );
}

/**
 * Every printed page of the boleta, in order. Folded papers: the front of
 * each sheet (two panels), and with `cover` the back of the first one.
 */
export function BoletaPages({ report, paper, cover }: { report: BoletaReport; paper: Paper; cover: boolean }) {
  const panels = paginate(report.content, report.facts, paper);
  const pages = panels.length;
  const size = PAPERS[paper];
  const sheet = (key: string, children: React.ReactNode, fold = false) => (
    <div key={key} className="boleta-sheet relative bg-white" style={{ width: size.width, height: size.height }}>
      {children}
      {fold && <FoldMarks />}
    </div>
  );
  const half = (key: string, children: React.ReactNode) => (
    <div key={key} className="h-1/2">
      {children}
    </div>
  );

  if (paper === "media") {
    return (
      <>
        {cover && sheet("cover", <Portada report={report} />)}
        {panels.map((lines, i) => sheet(`p${i}`, <BoletaPanel report={report} lines={lines} page={i + 1} pages={pages} />))}
      </>
    );
  }

  const out: React.ReactNode[] = [];
  for (let i = 0; i < panels.length; i += 2) {
    out.push(
      sheet(
        `s${i}`,
        <>
          {half("a", <BoletaPanel report={report} lines={panels[i]} page={i + 1} pages={pages} />)}
          {panels[i + 1] && half("b", <BoletaPanel report={report} lines={panels[i + 1]} page={i + 2} pages={pages} />)}
        </>,
        true,
      ),
    );
    if (cover && i === 0) out.push(sheet("cover", <>{half("a", <Portada report={report} />)}</>));
  }
  return <>{out}</>;
}

/** How many sheets of paper a printing takes. */
export function sheetCount(report: BoletaReport, paper: Paper) {
  const panels = paginate(report.content, report.facts, paper).length;
  return paper === "media" ? panels : Math.ceil(panels / 2);
}

