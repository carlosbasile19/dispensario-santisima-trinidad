// The branded PDF of a lab report: the one patients receive by WhatsApp.
// A navy band with the clinic's mark, the patient card, a summary of what is
// out of range, then each section with its results, units, reference
// intervals and a range bar, and the bioanalyst's validation at the end.
// Every page repeats the patient, the report number and "Página x de y".
//
// Layout is react-pdf (flexbox), sized in points on a US Letter page.

import { Document, Image, Page, Path, Rect, Circle, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";

import { CATEGORY } from "../catalog";
import { LAB_DISCLAIMER, LAB_INFO } from "../config";
import { clockTime, dayLong, documentOf, fullName, sexLabel, stampLong } from "../format";
import { FLAG_INFO, flagFor, formatAge, rangeBar, referenceLines, type PatientFacts } from "../reference";
import { PATIENT_TYPE_LABEL, groupRows, printedSections, reportNumber, tally } from "../report";
import type { SignatureImage } from "../signature";
import type { Flag, ReportContent, ReportPatient, ReportRow, ReportSigner } from "../types";

export const PDF_FONTS = { sans: "Instrument Sans", serif: "Newsreader", mono: "JetBrains Mono", script: "Great Vibes" } as const;

const C = {
  navy: "#1b2a55",
  navySoft: "#2a3b6e",
  teal: "#1e7e86",
  tealDark: "#135c62",
  mint: "#7fd3d6",
  mintSoft: "#d6f0f0",
  cream: "#faf8f4",
  sand: "#f1ede4",
  line: "#e6e0d4",
  hair: "#efeae1",
  ink: "#3d4250",
  muted: "#5a5e69",
  stone: "#8a8475",
  mist: "#b4bfd6",
  alert: "#b03a36",
  alertSoft: "#fbeceb",
  alertTint: "#fdf6f5",
  white: "#ffffff",
};

const M = 40; // side margin
const TOP = 58; // room for the running header on pages 2+
const BOTTOM = 62; // room for the footer

const s = StyleSheet.create({
  page: { paddingTop: TOP, paddingBottom: BOTTOM, paddingHorizontal: M, fontFamily: PDF_FONTS.sans, fontSize: 9, color: C.ink, backgroundColor: C.white },

  // Page 1 band
  band: { marginTop: -TOP, marginHorizontal: -M, backgroundColor: C.navy, paddingHorizontal: M, paddingTop: 26, paddingBottom: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bandBrand: { flexDirection: "row", alignItems: "center" },
  bandMark: { width: 40, height: 54, marginRight: 14 },
  brandName: { fontFamily: PDF_FONTS.serif, fontSize: 21, color: C.white, lineHeight: 1.1 },
  brandCaps: { fontSize: 6.6, letterSpacing: 1.9, color: C.mist, fontWeight: 600, marginTop: 3 },
  brandScript: { fontFamily: PDF_FONTS.script, fontSize: 19, color: C.mint, marginTop: 1, lineHeight: 1.15 },
  bandRight: { alignItems: "flex-end" },
  bandEyebrow: { fontSize: 6.6, letterSpacing: 1.9, color: C.mist, fontWeight: 600 },
  bandTitle: { fontFamily: PDF_FONTS.serif, fontSize: 17, color: C.white, marginTop: 3 },
  bandNumber: { marginTop: 6, flexDirection: "row", alignItems: "center" },
  numberPill: { borderRadius: 9, borderWidth: 0.8, borderColor: C.mint, paddingHorizontal: 7, paddingVertical: 2.5, fontFamily: PDF_FONTS.mono, fontSize: 8, color: C.mint },
  revisionPill: { marginLeft: 5, borderRadius: 9, backgroundColor: C.mint, paddingHorizontal: 7, paddingVertical: 2.5, fontSize: 7, fontWeight: 600, color: C.navy },
  accent: { marginHorizontal: -M, height: 3, backgroundColor: C.teal },

  // Running header (pages 2+)
  runner: { position: "absolute", top: 20, left: M, right: M, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 0.6, borderBottomColor: C.line },
  runnerBrand: { flexDirection: "row", alignItems: "center" },
  runnerMark: { width: 11, height: 15, marginRight: 6 },
  runnerText: { fontSize: 7.5, color: C.navy, fontWeight: 600 },
  runnerMuted: { fontSize: 7.5, color: C.stone },

  // Draft
  draftBanner: { marginTop: 14, borderRadius: 6, backgroundColor: C.alertSoft, paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center" },
  draftText: { fontSize: 8, color: C.alert, fontWeight: 600 },
  watermarkBox: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  watermark: { fontSize: 88, fontWeight: 700, color: "#b03a36", opacity: 0.07, transform: "rotate(-32deg)", letterSpacing: 8 },

  // Patient card
  card: { marginTop: 18, borderRadius: 10, backgroundColor: C.cream, borderWidth: 0.8, borderColor: C.line, paddingVertical: 14, paddingHorizontal: 16 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingBottom: 10, borderBottomWidth: 0.6, borderBottomColor: C.line },
  label: { fontSize: 6.3, letterSpacing: 1.2, color: C.stone, fontWeight: 600, textTransform: "uppercase" },
  patientName: { fontFamily: PDF_FONTS.serif, fontSize: 18, color: C.navy, marginTop: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  cell: { width: "25%", paddingTop: 8, paddingRight: 8 },
  value: { fontSize: 9.2, color: C.navy, marginTop: 2.5 },

  // Summary
  summary: { marginTop: 14, flexDirection: "row" },
  stat: { flexGrow: 1, flexBasis: 0, borderRadius: 8, borderWidth: 0.8, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 10, marginRight: 8 },
  statLast: { marginRight: 0 },
  statValue: { fontFamily: PDF_FONTS.serif, fontSize: 17, color: C.navy, marginTop: 1 },
  statAlert: { borderColor: "#efc9c6", backgroundColor: C.alertTint },
  flaggedList: { marginTop: 8, borderRadius: 8, backgroundColor: C.alertTint, borderWidth: 0.8, borderColor: "#efc9c6", paddingVertical: 8, paddingHorizontal: 10 },
  flaggedItem: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  flaggedText: { fontSize: 8.4, color: C.ink },

  // Sections
  section: { marginTop: 20 },
  sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 6, borderBottomWidth: 1.2, borderBottomColor: C.navy },
  eyebrow: { fontSize: 6.3, letterSpacing: 1.6, color: C.teal, fontWeight: 600, textTransform: "uppercase" },
  sectionTitle: { fontFamily: PDF_FONTS.serif, fontSize: 14.5, color: C.navy, marginTop: 2 },
  sectionCount: { fontSize: 7, color: C.stone },
  columns: { flexDirection: "row", paddingTop: 6, paddingBottom: 4, borderBottomWidth: 0.6, borderBottomColor: C.line },
  colLabel: { fontSize: 6.1, letterSpacing: 1, color: C.stone, fontWeight: 600, textTransform: "uppercase" },
  group: { flexDirection: "row", alignItems: "center", paddingTop: 9, paddingBottom: 3 },
  groupDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.teal, marginRight: 5 },
  groupText: { fontSize: 6.8, letterSpacing: 1.2, color: C.tealDark, fontWeight: 600, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 4.4, borderBottomWidth: 0.5, borderBottomColor: C.hair },
  pairs: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  pair: { width: "48.5%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4.4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.hair },
  pairLabel: { fontSize: 8.6, color: C.navy, paddingRight: 6, flexShrink: 1 },
  pairValue: { flexDirection: "row", alignItems: "center", flexShrink: 0, maxWidth: "62%" },
  rowFlagged: { backgroundColor: C.alertTint },
  cTest: { width: "35%", paddingRight: 8, paddingLeft: 4 },
  cResult: { width: "19%", paddingRight: 6, flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  cUnit: { width: "10%", paddingRight: 6 },
  cRef: { width: "23%", paddingRight: 6 },
  cBar: { width: "13%", alignItems: "flex-end", paddingRight: 4 },
  cWide: { width: "65%", paddingRight: 4 },
  testLabel: { fontSize: 8.8, color: C.navy },
  testMethod: { fontSize: 6.6, color: C.stone, fontStyle: "italic", marginTop: 1.5 },
  result: { fontSize: 9.6, fontWeight: 600, color: C.navy },
  resultAlert: { color: C.alert },
  textResult: { fontSize: 8.8, color: C.navy, lineHeight: 1.35 },
  unit: { fontSize: 7.6, color: C.muted },
  ref: { fontSize: 7.4, color: C.ink, lineHeight: 1.3 },
  pill: { marginLeft: 5, borderRadius: 6, backgroundColor: C.alertSoft, paddingHorizontal: 4.5, paddingVertical: 1.5, flexDirection: "row", alignItems: "center" },
  pillText: { fontSize: 6, fontWeight: 700, color: C.alert, letterSpacing: 0.6 },
  sectionNote: { marginTop: 8, borderRadius: 6, backgroundColor: C.cream, paddingVertical: 6, paddingHorizontal: 9 },
  sectionNoteText: { fontSize: 8, color: C.ink, fontStyle: "italic", lineHeight: 1.35 },

  // Observations and validation
  notes: { marginTop: 18, borderRadius: 8, borderWidth: 0.8, borderColor: C.line, paddingVertical: 10, paddingHorizontal: 12 },
  notesText: { fontSize: 8.6, color: C.ink, lineHeight: 1.4, marginTop: 4 },
  sign: { marginTop: 26, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  signLeft: { width: "48%" },
  signRight: { width: "44%", alignItems: "center" },
  check: { flexDirection: "row", alignItems: "center" },
  checkText: { fontSize: 8.6, color: C.tealDark, fontWeight: 600, marginLeft: 5 },
  signMeta: { fontSize: 7.6, color: C.muted, marginTop: 3, lineHeight: 1.35 },
  // Its foot just touches the line, as a pen signature does.
  signImage: { width: 170, height: 56, objectFit: "contain", marginBottom: -4 },
  signLine: { width: "100%", height: 0.9, backgroundColor: C.navy, marginBottom: 6 },
  signName: { fontFamily: PDF_FONTS.serif, fontSize: 12.5, color: C.navy },
  signTitle: { fontSize: 7.8, color: C.muted, marginTop: 2 },
  signIds: { fontSize: 7, color: C.stone, marginTop: 2, textAlign: "center" },
  end: { marginTop: 22, flexDirection: "row", alignItems: "center" },
  endLine: { flexGrow: 1, height: 0.6, backgroundColor: C.line },
  endText: { fontSize: 6.6, letterSpacing: 1.6, color: C.stone, marginHorizontal: 8, fontWeight: 600 },
  disclaimer: { marginTop: 8, fontSize: 6.8, color: C.stone, textAlign: "center", lineHeight: 1.35 },

  // Footer
  footer: { position: "absolute", bottom: 22, left: M, right: M, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 8, borderTopWidth: 0.6, borderTopColor: C.line },
  footerStrong: { fontSize: 7, color: C.navy, fontWeight: 600 },
  footerText: { fontSize: 6.8, color: C.stone, marginTop: 2 },
  footerPage: { fontSize: 7, color: C.navy, fontWeight: 600, textAlign: "right" },
});

export type PdfReport = {
  number: number;
  revision: number;
  status: "draft" | "final";
  patient: ReportPatient;
  facts: PatientFacts;
  content: ReportContent;
  signer: ReportSigner | null;
  finalizedAt: string | null;
  /** When this copy was made (drafts). */
  generatedAt: string;
  /** The signer's handwritten signature, drawn over the line of a validated report. */
  signature?: SignatureImage | null;
};

export type PdfAssets = { markWhite: Buffer; markNavy: Buffer };

/** A copy that asks for a key before it opens (the one sent by WhatsApp). */
export type PdfLock = { userPassword: string; ownerPassword: string };

// AES-128 (PDF 1.7), which every phone's PDF viewer opens. The patient's key
// opens it to read, print and copy; nothing else needs the owner's key.
const lockProps = (lock: PdfLock) => ({
  pdfVersion: "1.7" as const,
  userPassword: lock.userPassword,
  ownerPassword: lock.ownerPassword,
  permissions: {
    printing: "highResolution" as const,
    copying: true,
    contentAccessibility: true,
    modifying: false,
    annotating: false,
    fillingForms: false,
    documentAssembly: false,
  },
});

function Arrow({ flag, color }: { flag: Flag; color: string }) {
  if (flag === "A") {
    return (
      <Svg width={5} height={5} viewBox="0 0 10 10">
        <Circle cx={5} cy={5} r={4} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={6} height={6} viewBox="0 0 10 10">
      <Path d={flag === "H" ? "M5 1 L9.2 8.4 L0.8 8.4 Z" : "M5 9 L9.2 1.6 L0.8 1.6 Z"} fill={color} />
    </Svg>
  );
}

function FlagPill({ flag }: { flag: Flag }) {
  return (
    <View style={s.pill}>
      <Arrow flag={flag} color={C.alert} />
      <Text style={[s.pillText, { marginLeft: 2.5 }]}>{FLAG_INFO[flag].label.toUpperCase()}</Text>
    </View>
  );
}

function RangeBar({ row, facts, flagged }: { row: ReportRow; facts: PatientFacts; flagged: boolean }) {
  const bar = rangeBar(row, facts);
  if (!bar) return null;
  const W = 58;
  const H = 10;
  const y = 3.5;
  const x = (t: number) => 3 + t * (W - 6);
  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={3} y={y} width={W - 6} height={3} rx={1.5} fill="#e9e4da" />
      <Rect x={x(bar.start)} y={y} width={Math.max(2, x(bar.end) - x(bar.start))} height={3} rx={1.5} fill="#a9dcdb" />
      <Circle cx={x(bar.value)} cy={y + 1.5} r={3.1} fill={flagged ? C.alert : C.navy} stroke={C.white} strokeWidth={1.1} />
    </Svg>
  );
}

function ResultRow({ row, facts }: { row: ReportRow; facts: PatientFacts }) {
  const flag = flagFor(row, facts);
  const reference = referenceLines(row, facts);
  const wide = isSentence(row, facts);
  return (
    <View style={flag ? [s.row, s.rowFlagged] : s.row} wrap={false}>
      <View style={s.cTest}>
        <Text style={s.testLabel}>{row.label}</Text>
        {row.method ? <Text style={s.testMethod}>{row.method}</Text> : null}
        {row.note ? <Text style={s.testMethod}>{row.note}</Text> : null}
      </View>
      {wide ? (
        <View style={s.cWide}>
          <Text style={flag ? [s.textResult, s.resultAlert] : s.textResult}>{row.value}</Text>
        </View>
      ) : (
        <>
          <View style={s.cResult}>
            <Text style={flag ? [row.kind === "text" ? s.textResult : s.result, s.resultAlert] : row.kind === "text" ? s.textResult : s.result}>{row.value}</Text>
            {flag ? <FlagPill flag={flag} /> : null}
          </View>
          <View style={s.cUnit}>
            <Text style={s.unit}>{row.unit}</Text>
          </View>
          <View style={s.cRef}>
            {reference.map((line, i) => (
              <Text key={i} style={s.ref}>
                {line}
              </Text>
            ))}
          </View>
          <View style={s.cBar}>
            <RangeBar row={row} facts={facts} flagged={Boolean(flag)} />
          </View>
        </>
      )}
    </View>
  );
}

/** A qualitative answer with no unit or interval ("Color: AMARILLA"), laid out two per line. */
function Pair({ row, facts }: { row: ReportRow; facts: PatientFacts }) {
  const flag = flagFor(row, facts);
  return (
    <View style={flag ? [s.pair, s.rowFlagged] : s.pair} wrap={false}>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.pairLabel}>{row.label}</Text>
        {row.method ? <Text style={s.testMethod}>{row.method}</Text> : null}
      </View>
      <View style={s.pairValue}>
        <Text style={flag ? [s.result, s.resultAlert, { fontSize: 8.8 }] : [s.result, { fontSize: 8.8 }]}>{row.value}</Text>
        {flag ? <FlagPill flag={flag} /> : null}
      </View>
    </View>
  );
}

/** A finding written as a sentence, printed across the row. */
const isSentence = (row: ReportRow, facts: PatientFacts) => row.kind === "text" && !row.unit && referenceLines(row, facts).length === 0;

function Group({ group, facts }: { group: { title: string; rows: ReportRow[]; pairs: boolean }; facts: PatientFacts }) {
  return (
    <View>
      {group.title ? (
        <View style={s.group} wrap={false} minPresenceAhead={24}>
          <View style={s.groupDot} />
          <Text style={s.groupText}>{group.title}</Text>
        </View>
      ) : null}
      {group.pairs ? (
        <View style={s.pairs}>
          {group.rows.map((row) => (
            <Pair key={row.id} row={row} facts={facts} />
          ))}
        </View>
      ) : (
        group.rows.map((row) => <ResultRow key={row.id} row={row} facts={facts} />)
      )}
    </View>
  );
}

const isPair = (row: ReportRow, facts: PatientFacts) =>
  row.kind !== "number" && !row.unit && !row.note && referenceLines(row, facts).length === 0 && row.value.length <= 30;

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export function LabReportDocument({ report, assets, lock }: { report: PdfReport; assets: PdfAssets; lock?: PdfLock }) {
  const { patient, facts, content, signer } = report;
  const number = reportNumber(report.number);
  const name = fullName(patient);
  const draft = report.status === "draft";
  const sections = printedSections(content.sections);
  const { results, flagged } = tally(sections, facts);
  const age = formatAge(patient.birth_date, content.sampledDay);
  const issued = report.finalizedAt ?? report.generatedAt;

  return (
    <Document
      title={`Resultados de laboratorio · Nº ${number}`}
      author={LAB_INFO.legalName}
      subject={`Informe de laboratorio de ${name}`}
      creator={LAB_INFO.legalName}
      producer={LAB_INFO.legalName}
      language="es-VE"
      {...(lock ? lockProps(lock) : {})}
    >
      <Page size="LETTER" style={s.page} wrap>
        {/* Pages 2+: who and which report, so a loose page is never anonymous. */}
        <View
          style={s.runner}
          fixed
          render={({ pageNumber }) =>
            pageNumber === 1 ? null : (
              <>
                <View style={s.runnerBrand}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt */}
                  <Image src={{ data: assets.markNavy, format: "png" }} style={s.runnerMark} />
                  <Text style={s.runnerText}>Centro Médico Integral Santísima Trinidad · Laboratorio clínico</Text>
                </View>
                <Text style={s.runnerMuted}>
                  {name}
                  {documentOf(patient) ? ` · ${documentOf(patient)}` : ""} · Nº {number}
                </Text>
              </>
            )
          }
        />

        <View style={s.band}>
          <View style={s.bandBrand}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt */}
            <Image src={{ data: assets.markWhite, format: "png" }} style={s.bandMark} />
            <View>
              <Text style={s.brandName}>Santísima Trinidad</Text>
              <Text style={s.brandCaps}>CENTRO MÉDICO INTEGRAL</Text>
              <Text style={s.brandScript}>Bioanálisis</Text>
            </View>
          </View>
          <View style={s.bandRight}>
            <Text style={s.bandEyebrow}>LABORATORIO CLÍNICO</Text>
            <Text style={s.bandTitle}>Informe de resultados</Text>
            <View style={s.bandNumber}>
              <Text style={s.numberPill}>Nº {number}</Text>
              {report.revision > 1 ? <Text style={s.revisionPill}>Revisión {report.revision}</Text> : null}
            </View>
          </View>
        </View>
        <View style={s.accent} />

        {draft ? (
          <View style={s.draftBanner}>
            <Text style={s.draftText}>Borrador sin validar. No es un informe oficial: no lo entregues al paciente.</Text>
          </View>
        ) : null}

        <View style={s.card}>
          <View style={s.cardTop}>
            <View>
              <Text style={s.label}>Paciente</Text>
              <Text style={s.patientName}>{name}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.label}>Emitido</Text>
              <Text style={s.value}>{stampLong(issued)}</Text>
            </View>
          </View>
          <View style={s.grid}>
            <Cell label="Documento" value={documentOf(patient) ?? "Sin documento"} />
            <Cell label="Edad" value={age ?? "—"} />
            <Cell label="Sexo" value={sexLabel(patient.sex) ?? "—"} />
            <Cell label="Tipo de paciente" value={PATIENT_TYPE_LABEL[content.patientType]} />
            <Cell label="Fecha de la muestra" value={dayLong(content.sampledDay)} />
            <Cell label="Hora de la muestra" value={clockTime(content.sampledTime)} />
            <Cell label="Médico solicitante" value={content.requestedBy || "—"} />
            <Cell label="Informe" value={`Nº ${number}${report.revision > 1 ? ` · rev. ${report.revision}` : ""}`} />
          </View>
        </View>

        <View style={s.summary} wrap={false}>
          <View style={s.stat}>
            <Text style={s.label}>Resultados</Text>
            <Text style={s.statValue}>{results}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.label}>Dentro del rango</Text>
            <Text style={s.statValue}>{results - flagged.length}</Text>
          </View>
          <View style={flagged.length ? [s.stat, s.statLast, s.statAlert] : [s.stat, s.statLast]}>
            <Text style={flagged.length ? [s.label, { color: C.alert }] : s.label}>Fuera del rango</Text>
            <Text style={flagged.length ? [s.statValue, { color: C.alert }] : s.statValue}>{flagged.length}</Text>
          </View>
        </View>
        {flagged.length ? (
          <View style={s.flaggedList} wrap={false}>
            <Text style={[s.label, { color: C.alert }]}>Para revisar con tu médico</Text>
            {flagged.slice(0, 8).map(({ row, flag }) => (
              <View key={row.id} style={s.flaggedItem}>
                <Arrow flag={flag} color={C.alert} />
                <Text style={[s.flaggedText, { marginLeft: 5 }]}>
                  <Text style={{ fontWeight: 600, color: C.navy }}>{row.label}</Text>
                  {`  ${row.value}${row.unit ? ` ${row.unit}` : ""} · ${FLAG_INFO[flag].label.toLowerCase()}`}
                </Text>
              </View>
            ))}
            {flagged.length > 8 ? <Text style={[s.flaggedText, { marginTop: 3 }]}>y {flagged.length - 8} más, marcados abajo.</Text> : null}
          </View>
        ) : null}

        {sections.map((section) => {
          const groups = groupRows(section.rows).map((group) => ({
            ...group,
            pairs: group.rows.length > 1 && group.rows.every((row) => isPair(row, facts)),
          }));
          const hasTable = groups.some((group) => !group.pairs && group.rows.some((row) => !isSentence(row, facts)));
          // The heading travels with the first rows, so a section never starts at the foot of a page.
          const [first, ...rest] = groups;
          const leadCount = first.pairs ? 4 : 3;
          const lead = { ...first, rows: first.rows.slice(0, leadCount) };
          const tail = { ...first, title: "", rows: first.rows.slice(leadCount) };
          return (
            <View key={section.id} style={s.section}>
              <View wrap={false}>
                <View style={s.sectionHead}>
                  <View>
                    <Text style={s.eyebrow}>{CATEGORY[section.category]?.short ?? "Laboratorio"}</Text>
                    <Text style={s.sectionTitle}>{section.title}</Text>
                  </View>
                  <Text style={s.sectionCount}>
                    {section.rows.length} {section.rows.length === 1 ? "resultado" : "resultados"}
                  </Text>
                </View>
                {hasTable ? (
                  <View style={s.columns}>
                    <Text style={[s.colLabel, s.cTest]}>Prueba</Text>
                    <Text style={[s.colLabel, s.cResult]}>Resultado</Text>
                    <Text style={[s.colLabel, s.cUnit]}>Unidad</Text>
                    <Text style={[s.colLabel, s.cRef]}>Valor de referencia</Text>
                    <Text style={[s.colLabel, s.cBar, { textAlign: "right" }]}>Rango</Text>
                  </View>
                ) : null}
                <Group group={lead} facts={facts} />
              </View>
              {tail.rows.length ? <Group group={tail} facts={facts} /> : null}
              {rest.map((group, index) => (
                <Group key={`${group.title}-${index}`} group={group} facts={facts} />
              ))}
              {section.note.trim() ? (
                <View style={s.sectionNote} wrap={false}>
                  <Text style={s.sectionNoteText}>{section.note.trim()}</Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {content.notes.trim() ? (
          <View style={s.notes} wrap={false}>
            <Text style={s.label}>Observaciones</Text>
            <Text style={s.notesText}>{content.notes.trim()}</Text>
          </View>
        ) : null}

        <View wrap={false}>
          <View style={s.sign}>
            <View style={s.signLeft}>
              {draft ? (
                <Text style={[s.checkText, { color: C.alert, marginLeft: 0 }]}>Pendiente de validación</Text>
              ) : (
                <View style={s.check}>
                  <Svg width={11} height={11} viewBox="0 0 24 24">
                    <Circle cx={12} cy={12} r={11} fill={C.mintSoft} />
                    <Path d="M7 12.5l3.2 3.2L17 9" stroke={C.tealDark} strokeWidth={2.2} fill="none" />
                  </Svg>
                  <Text style={s.checkText}>Validado por el laboratorio</Text>
                </View>
              )}
              <Text style={s.signMeta}>
                {draft ? `Copia generada el ${stampLong(report.generatedAt)}` : `El ${report.finalizedAt ? stampLong(report.finalizedAt) : "—"}`}
                {"\n"}Informe Nº {number}
                {report.revision > 1 ? ` · revisión ${report.revision}: reemplaza las versiones anteriores de este informe.` : ""}
              </Text>
            </View>
            {signer ? (
              <View style={s.signRight}>
                {!draft && report.signature ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image has no alt
                  <Image src={{ data: report.signature.data, format: report.signature.format }} style={s.signImage} />
                ) : null}
                <View style={s.signLine} />
                <Text style={s.signName}>{signer.name}</Text>
                <Text style={s.signTitle}>{signer.title}</Text>
                <Text style={s.signIds}>{[signer.id_number, signer.registry, signer.college].filter(Boolean).join(" · ")}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.end}>
            <View style={s.endLine} />
            <Text style={s.endText}>FIN DEL INFORME</Text>
            <View style={s.endLine} />
          </View>
          <Text style={s.disclaimer}>{LAB_DISCLAIMER}</Text>
        </View>

        {draft ? (
          <View style={s.watermarkBox} fixed>
            <Text style={s.watermark}>BORRADOR</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <View>
            <Text style={s.footerStrong}>
              {LAB_INFO.legalName} · RIF {LAB_INFO.rif}
            </Text>
            <Text style={s.footerText}>
              {LAB_INFO.address} · {LAB_INFO.phones.join(" · ")}
            </Text>
          </View>
          <View>
            <Text style={s.footerPage} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
            <Text style={[s.footerText, { textAlign: "right" }]}>Nº {number}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
