import "../scripts/lib/load-typescript.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { arrayItemReader } = await import("../src/lib/lab/json-stream.ts");
const { applyDictation, emptyDictation, missingFromPanels, normalizeDictation, normalizeResult } = await import("../src/lib/lab/dictation.ts");
const { detectMentions, sessionText } = await import("../src/lib/lab/dictation-detect.ts");
const { DICTATION_SCHEMA, DICTATION_SYSTEM, dictationUserTurn } = await import("../src/lib/lab/dictation-prompt.ts");
const { TEST_LIST } = await import("../src/lib/lab/catalog.ts");
const { addPanel } = await import("../src/lib/lab/report.ts");
const { PANEL } = await import("../src/lib/lab/catalog.ts");

const result = (fields) => ({ test: "otro", value: "", heard: "", check: "ok", why: "", label: "", unit: "", category: "otros", ...fields });

test("results are read as soon as each one is complete, whatever the chunks", () => {
  const answer = JSON.stringify({
    results: [
      result({ test: "hemoglobina", value: "13,5", heard: 'dijo "trece coma cinco" {sic}' }),
      result({ test: "otro", label: "Prueba [rara]", value: "}{", heard: "\\ barra" }),
      result({ test: "plaquetas", value: "250.000" }),
    ],
    panels: ["hematologia_completa"],
    notes: "results: [no es esto]",
  });
  for (const size of [1, 3, 7, 64, answer.length]) {
    const items = [];
    const push = arrayItemReader("results", (item) => items.push(item));
    for (let i = 0; i < answer.length; i += size) push(answer.slice(i, i + size));
    assert.deepEqual(
      items.map((item) => item.value),
      ["13,5", "}{", "250.000"],
      `chunks of ${size}`,
    );
  }
});

test("only the named array is read", () => {
  const items = [];
  const push = arrayItemReader("results", (item) => items.push(item));
  push('{"panels":[{"a":1}],"results":[{"test":"urea","value":"30"}],"unclear":[{"b":2}]}');
  assert.deepEqual(items, [{ test: "urea", value: "30" }]);
});

test("each result is checked against the catalog and written in the house style", () => {
  assert.deepEqual(normalizeResult(result({ test: "hemoglobina", value: "13.5", heard: "hemoglobina trece coma cinco" })), {
    id: "t:hemoglobina",
    test: "hemoglobina",
    label: "Hemoglobina",
    category: "hematologia",
    unit: "g/dL",
    kind: "number",
    value: "13,5",
    heard: "hemoglobina trece coma cinco",
    doubt: null,
  });
  assert.equal(normalizeResult(result({ test: "plaquetas", value: "250 mil" })).value, "250.000");
  assert.equal(normalizeResult(result({ test: "leucocitos", value: "7500" })).value, "7.500");
  assert.equal(normalizeResult(result({ test: "glicemia", value: "95 mg/dL" })).value, "95");
  assert.equal(normalizeResult(result({ test: "orina_glucosa", value: "trazas" })).value, "TRAZAS", "a listed answer, as listed");
  assert.equal(normalizeResult(result({ test: "orina_leucocitos", value: "2 - 4 x cmp" })).value, "2 - 4 x CMP");
  assert.equal(normalizeResult(result({ test: "hiv", value: "no reactivo" })).value, "NO REACTIVO", "other answers in capitals");
  assert.equal(normalizeResult(result({ test: "hemoglobina", value: "   " })), null, "no value, no result");
});

test("a doubt comes from Claude or from a figure the test cannot have", () => {
  assert.equal(normalizeResult(result({ test: "plaquetas", value: "250.000", check: "revisar", why: "Se interpretó 250 como 250.000/mm³." })).doubt, "Se interpretó 250 como 250.000/mm³.");
  assert.match(normalizeResult(result({ test: "hemoglobina", value: "135" })).doubt, /¿Valor correcto\? Lo esperable está entre 1 y 25 g\/dL/);
  assert.equal(normalizeResult(result({ test: "potasio", value: "4,1", check: "revisar", why: "" })).doubt, "Revisa este valor.");
});

test("a test the catalog lacks becomes a hand-typed one; an unknown key without a name is dropped", () => {
  const custom = normalizeResult(result({ test: "otro", label: "Lactato", value: "1,8", unit: "mmol/L", category: "quimica" }));
  assert.equal(custom.id, "c:lactato");
  assert.equal(custom.test, null);
  assert.equal(custom.kind, "number");
  assert.equal(custom.category, "quimica");
  assert.equal(normalizeResult(result({ test: "inventada", label: "", value: "3" })), null);
  assert.equal(normalizeResult(result({ test: "otro", label: "Nota", value: "Hemolizada", category: "no-existe" })).category, "otros");
});

test("the whole answer: last value wins, panels and details checked", () => {
  const dictation = normalizeDictation({
    results: [result({ test: "hemoglobina", value: "12" }), result({ test: "urea", value: "30" }), result({ test: "hemoglobina", value: "13,5" })],
    panels: ["hematologia_completa", "no_existe", "hematologia_completa"],
    section_notes: [
      { category: "hematologia", note: "Leve anisocitosis." },
      { category: "hematologia", note: "Leve anisocitosis." },
      { category: "nada", note: "x" },
    ],
    notes: " Muestra en ayunas. ",
    requested_by: "Dra. Pérez",
    patient_type: "seguro",
    sampled_day: "2026-11-12",
    sampled_time: "07:30",
    unclear: ["algo raro", ""],
  });
  assert.deepEqual(
    dictation.results.map((r) => [r.test, r.value]),
    [
      ["hemoglobina", "13,5"],
      ["urea", "30"],
    ],
  );
  assert.match(dictation.results[0].doubt, /Se dictó dos veces \(12 y 13,5\)/);
  assert.deepEqual(dictation.panels, ["hematologia_completa"]);
  assert.deepEqual(dictation.sectionNotes, [{ category: "hematologia", note: "Leve anisocitosis." }]);
  assert.equal(dictation.notes, "Muestra en ayunas.");
  assert.equal(dictation.patientType, "seguro");
  assert.equal(dictation.sampledTime, "07:30");
  assert.deepEqual(dictation.unclear, ["algo raro"]);

  const odd = normalizeDictation({ patient_type: "vip", sampled_day: "12/11/2026", sampled_time: "25:00" });
  assert.equal(odd.patientType, null);
  assert.equal(odd.sampledDay, null);
  assert.equal(odd.sampledTime, null);
  assert.deepEqual(normalizeDictation("not json"), emptyDictation());
});

const content = (sections = []) => ({ sections, notes: "", patientType: "contado", requestedBy: "", sampledDay: "2026-11-12", sampledTime: "08:00" });

test("applying adds the named panels and fills each dictated row", () => {
  const dictation = normalizeDictation({
    results: [
      result({ test: "hemoglobina", value: "13,5" }),
      result({ test: "hematocrito", value: "41" }),
      result({ test: "chcm", value: "33" }),
      result({ test: "glicemia", value: "95" }),
      result({ test: "otro", label: "Lactato", value: "1,8", unit: "mmol/L", category: "quimica" }),
    ],
    panels: ["hematologia_completa"],
    section_notes: [{ category: "hematologia", note: "Leve anisocitosis." }],
    notes: "Muestra en ayunas.",
    requested_by: "Dra. Pérez",
    patient_type: "seguro",
  });
  const { content: next, touched } = applyDictation(content(), dictation);
  const blood = next.sections.find((s) => s.category === "hematologia");
  const chemistry = next.sections.find((s) => s.category === "quimica");
  assert.equal(blood.title, "Hematología completa");
  assert.equal(blood.rows.length, PANEL.hematologia_completa.groups[0].tests.length, "the whole panel, dictated or not");
  assert.equal(blood.rows.find((r) => r.test === "hemoglobina").value, "13,5");
  const chcm = blood.rows.find((r) => r.test === "chcm");
  assert.equal(chcm.value, "33");
  assert.equal(chcm.derive, null, "a computed row keeps the dictated figure");
  assert.equal(blood.note, "Leve anisocitosis.");
  assert.equal(chemistry.rows.find((r) => r.test === "glicemia").value, "95");
  const lactate = chemistry.rows.find((r) => r.label === "Lactato");
  assert.equal(lactate.test, null);
  assert.equal(lactate.unit, "mmol/L");
  assert.equal(touched.length, 5);
  assert.equal(next.notes, "Muestra en ayunas.");
  assert.equal(next.requestedBy, "Dra. Pérez");
  assert.equal(next.patientType, "seguro");
  assert.equal(next.sampledTime, "08:00", "not said, not changed");
});

test("applying again updates the same rows instead of adding new ones", () => {
  const first = applyDictation(content(), normalizeDictation({ results: [result({ test: "otro", label: "Lactato", value: "1,8", category: "quimica" })], notes: "Ayunas." })).content;
  const again = applyDictation(
    first,
    normalizeDictation({ results: [result({ test: "otro", label: "lactato", value: "2,1", category: "quimica" })], notes: "Ayunas.", section_notes: [{ category: "orina", note: "Muestra turbia." }] }),
  ).content;
  const rows = again.sections.flatMap((s) => s.rows).filter((r) => r.label.toLowerCase() === "lactato");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, "2,1");
  assert.equal(again.notes, "Ayunas.\nOrina completa: Muestra turbia.", "a note is not repeated; one for a missing exam goes to the general notes");
});

test("the panel tests nobody dictated are listed for the review", () => {
  const dictation = normalizeDictation({ results: [result({ test: "hemoglobina", value: "13" })], panels: ["perfil_lipidico"] });
  const [missing] = missingFromPanels([], dictation);
  assert.equal(missing.panel, "Perfil lipídico");
  assert.equal(missing.category, "quimica");
  assert.deepEqual(missing.tests, ["Colesterol total", "HDL-colesterol", "Triglicéridos"], "computed tests are not asked for");
  const filled = addPanel([], PANEL.perfil_lipidico).map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, value: r.test === "hdl" ? "50" : r.value })) }));
  assert.deepEqual(missingFromPanels(filled, dictation)[0].tests, ["Colesterol total", "Triglicéridos"]);
});

test("tests named while speaking show up with the figure said after them", () => {
  assert.deepEqual(detectMentions("Hematología completa hemoglobina 13,5 hematocrito 41, plaquetas 250 mil. TGO 25 y orina glucosa negativo"), [
    { label: "Hemoglobina", value: "13,5" },
    { label: "Hematocrito", value: "41" },
    { label: "Plaquetas", value: "250 mil" },
    { label: "Transaminasa oxalacética (TGO)", value: "25" },
    { label: "Glucosa", value: "NEGATIVO" },
  ]);
  assert.deepEqual(detectMentions("hemoglobina 12, no perdón, hemoglobina 13"), [{ label: "Hemoglobina", value: "13" }], "a correction keeps one chip");
  assert.deepEqual(
    detectMentions("leucocitos 12.400 segmentados 60 linfocitos 30 eosinófilos 2 monocitos 8. Orina: leucocitos 2 a 4 por campo").map((m) => `${m.label} ${m.value}`),
    ["Leucocitos 12.400", "Segmentados 60", "Linfocitos 30", "Eosinófilos 2", "Monocitos 8", "Leucocitos 2"],
    "the same name much later is another test",
  );
  assert.deepEqual(detectMentions("buenos días"), []);
});

const final = (transcript) => ({ isFinal: true, 0: { transcript } });
const interim = (transcript) => ({ isFinal: false, 0: { transcript } });
const list = (...results) => Object.assign(results, { length: results.length });

test("speech: settled phrases and words in progress; Android's repeated phrases merge", () => {
  assert.deepEqual(sessionText(list(final("hemoglobina 13,5"), final("hematocrito 41"), interim("plaquetas"))), {
    settled: "hemoglobina 13,5 hematocrito 41",
    pending: "plaquetas",
  });
  assert.equal(sessionText(list(final("negativo"), final("negativo"))).settled, "negativo negativo", "a word said twice stays twice");
  assert.equal(sessionText(list(final("hemoglobina"), final("hemoglobina 13,5"), final("hemoglobina 13,5 hematocrito 41")), true).settled, "hemoglobina 13,5 hematocrito 41");
});

test("the schema meets structured outputs' rules and knows every test", () => {
  const objects = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "object") objects.push(node);
    for (const value of Object.values(node)) walk(value);
  };
  walk(DICTATION_SCHEMA);
  assert.ok(objects.length >= 3);
  for (const object of objects) {
    assert.equal(object.additionalProperties, false);
    assert.deepEqual([...object.required].sort(), Object.keys(object.properties).sort(), "every property required");
  }
  const keys = DICTATION_SCHEMA.properties.results.items.properties.test.enum;
  assert.equal(keys.length, TEST_LIST.length + 1);
  assert.ok(keys.includes("otro"));
  assert.equal(Object.keys(DICTATION_SCHEMA.properties)[0], "results", "results stream first");
  for (const t of TEST_LIST) assert.ok(DICTATION_SYSTEM.includes(`| ${t.key} | ${t.label} |`), t.key);
});

test("the request names the patient's sex and age, never who they are", () => {
  const turn = dictationUserTurn({
    transcript: "hemoglobina 13",
    facts: { sex: "F", age: 34 },
    today: "2026-11-12",
    now: "10:42",
    sections: addPanel([], PANEL.perfil_lipidico),
  });
  assert.match(turn, /sexo femenino, edad 34 años/);
  assert.match(turn, /Hoy es 2026-11-12; son las 10:42/);
  assert.match(turn, /- quimica: colesterol_total, hdl, ldl, vldl, trigliceridos/);
  assert.match(turn, /<dictado>\nhemoglobina 13\n<\/dictado>/);
});
