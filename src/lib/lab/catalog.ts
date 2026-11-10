// The laboratory's catalog: every test the clinic reports, with its unit,
// reference values and usual answers, taken from the clinic's own Excel
// boletas (hematología, química, the "formato corto" lists of qualitative
// and quantitative tests). Panels are the combinations the clinic prints
// most, one per sheet of those workbooks ("Perfil de rutina", "Orina
// completa"…). Reference values are the laboratory's: change them here.
//
// A report copies a test's unit and reference rules when the test is added,
// so editing this file never changes a report already issued.

import type { CategoryDef, CategoryKey, PanelDef, RefRule, TestDef } from "./types";

// Categories, in the order their sections print ----------------------------------

export const CATEGORIES: readonly CategoryDef[] = [
  { key: "hematologia", title: "Hematología", short: "Hematología" },
  { key: "coagulacion", title: "Coagulación", short: "Coagulación" },
  { key: "quimica", title: "Química sanguínea", short: "Química" },
  { key: "diabetes", title: "Perfil diabético", short: "Diabetes" },
  { key: "tiroides", title: "Perfil tiroideo", short: "Tiroides" },
  { key: "hierro", title: "Estudio de hierro", short: "Hierro" },
  { key: "orina", title: "Orina completa", short: "Orina" },
  { key: "orina_especial", title: "Orina casual y de 24 horas", short: "Orina 24 h" },
  { key: "heces", title: "Examen de heces", short: "Heces" },
  { key: "inmunologia", title: "Inmuno-serología", short: "Serología" },
  { key: "anticuerpos", title: "Anticuerpos e inmunoglobulinas", short: "Anticuerpos" },
  { key: "marcadores", title: "Marcadores tumorales", short: "Marcadores" },
  { key: "hormonas", title: "Hormonas", short: "Hormonas" },
  { key: "cardiologia", title: "Estudio cardiológico", short: "Cardiología" },
  { key: "farmacos", title: "Fármacos, tóxicos y vitaminas", short: "Fármacos" },
  { key: "microbiologia", title: "Bacteriología", short: "Bacteriología" },
  { key: "otros", title: "Otros exámenes", short: "Otros" },
];

export const CATEGORY: Record<CategoryKey, CategoryDef> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  CategoryKey,
  CategoryDef
>;

export const categoryOrder = (key: CategoryKey) => CATEGORIES.findIndex((c) => c.key === key);

// Answer lists, as in the clinic's spreadsheets -------------------------------------

const NEG_POS = ["NEGATIVO", "POSITIVO"] as const;
const REACTIVE = ["NO REACTIVO", "REACTIVO"] as const;
const URINE_CHEMISTRY = ["NEGATIVO", "TRAZAS", "POSITIVO (1+)", "POSITIVO (2+)", "POSITIVO (3+)"] as const;
const PER_FIELD = [
  "0 - 2 x CMP", "1 - 3 x CMP", "2 - 4 x CMP", "3 - 5 x CMP", "4 - 6 x CMP", "5 - 7 x CMP", "6 - 8 x CMP",
  "7 - 9 x CMP", "8 - 10 x CMP", "10 - 12 x CMP", "11 - 13 x CMP", "12 - 15 x CMP", "13 - 15 x CMP",
  "15 - 17 x CMP", "17 - 20 x CMP", "18 - 20 x CMP", "20 - 23 x CMP", "20 - 25 x CMP", "23 - 25 x CMP",
  "25 - 30 x CMP", "30 - 35 x CMP", "40 - 45 x CMP", "50 - 60 x CMP", "INCONTABLES x CMP",
] as const;
const AMOUNTS = ["ESCASOS", "MODERADOS", "ABUNDANTES", "NO VISIBLES"] as const;
const DILUTIONS_8_16 = "< 1:8 diluciones: NEGATIVO\n> 1:16 diluciones: POSITIVO";

// Builders ----------------------------------------------------------------------

type Extra = Partial<Omit<TestDef, "key" | "label" | "category" | "kind">>;

const range = (low: number, high: number, extra: Partial<RefRule> = {}): RefRule => ({ low, high, ...extra });
const upTo = (high: number, extra: Partial<RefRule> = {}): RefRule => ({ high, ...extra });
const bySex = (male: [number, number], female: [number, number]): RefRule[] => [
  { sex: "M", low: male[0], high: male[1] },
  { sex: "F", low: female[0], high: female[1] },
];

const TESTS_LIST: TestDef[] = [];

function num(category: CategoryKey, key: string, label: string, unit: string, ref: RefRule[] | null, extra: Extra = {}) {
  TESTS_LIST.push({ key, label, category, kind: "number", unit, ...(ref ? { ref } : {}), ...extra });
}
function opt(category: CategoryKey, key: string, label: string, options: readonly string[], extra: Extra = {}) {
  TESTS_LIST.push({ key, label, category, kind: "option", options, ...extra });
}
function txt(category: CategoryKey, key: string, label: string, extra: Extra = {}) {
  TESTS_LIST.push({ key, label, category, kind: "text", ...extra });
}
/** A qualitative test whose normal answer is NEGATIVO. */
function qual(category: CategoryKey, key: string, label: string, extra: Extra = {}) {
  opt(category, key, label, NEG_POS, { normal: ["NEGATIVO"], ...extra });
}

// Hematología ----------------------------------------------------------------------

num("hematologia", "hemoglobina", "Hemoglobina", "g/dL", bySex([12, 17], [11, 15]), { plausible: [1, 25], keywords: "hb" });
num("hematologia", "hematocrito", "Hematocrito", "%", bySex([40, 52], [35, 47]), { plausible: [5, 75], keywords: "hto" });
num("hematologia", "globulos_rojos", "Glóbulos rojos", "millones/mm³", null, { plausible: [0.5, 9], keywords: "eritrocitos hematies gr" });
// VCM and HCM are typed (the editor offers to compute them when the red cell count was measured).
num("hematologia", "vcm", "VCM", "fL", [range(82, 92)], { decimals: 1, plausible: [40, 160], keywords: "volumen corpuscular medio" });
num("hematologia", "hcm", "HCM", "pg", [range(25, 31)], { decimals: 1, plausible: [10, 50], keywords: "hemoglobina corpuscular media" });
num("hematologia", "chcm", "CHCM", "g/dL", [range(30, 36)], { derive: "chcm", decimals: 1, plausible: [20, 45], keywords: "concentracion" });
num("hematologia", "plaquetas", "Plaquetas", "/mm³", [range(145000, 450000)], { plausible: [1000, 2000000] });
num("hematologia", "leucocitos", "Leucocitos", "/mm³", [range(5000, 10000)], { plausible: [100, 200000], keywords: "glóbulos blancos gb" });
num("hematologia", "segmentados", "Segmentados", "%", null, { plausible: [0, 100], keywords: "neutrófilos" });
num("hematologia", "linfocitos", "Linfocitos", "%", null, { plausible: [0, 100] });
num("hematologia", "eosinofilos", "Eosinófilos", "%", null, { plausible: [0, 100] });
num("hematologia", "monocitos", "Monocitos", "%", null, { plausible: [0, 100] });
num("hematologia", "basofilos", "Basófilos", "%", null, { plausible: [0, 100] });
num("hematologia", "vsg_1", "VSG 1.ª hora", "mm", null, { plausible: [0, 150], keywords: "eritrosedimentacion sedimentacion" });
num("hematologia", "vsg_2", "VSG 2.ª hora", "mm", null, { plausible: [0, 150] });
num("hematologia", "katz", "Índice de Katz", "mm", null, { derive: "katz", decimals: 1 });
opt("hematologia", "drepanocitos", "Drepanocitos", ["NO SE OBSERVARON", "SE OBSERVARON"], { normal: ["NO SE OBSERVARON"] });
opt("hematologia", "gota_gruesa", "Gota gruesa", ["NO SE OBSERVARON HEMATOZOARIOS", "POSITIVO P. VIVAX", "POSITIVO P. FALCIPARUM"], {
  normal: ["NO SE OBSERVARON HEMATOZOARIOS"],
  keywords: "paludismo malaria",
});

// Coagulación ---------------------------------------------------------------------

num("coagulacion", "pt_control", "Tiempo control", "seg", null, { plausible: [5, 60] });
num("coagulacion", "pt_paciente", "Tiempo paciente", "seg", null, { plausible: [5, 200] });
num("coagulacion", "pt_actividad", "Actividad", "%", null, { derive: "pt_actividad", decimals: 0 });
num("coagulacion", "pt_razon", "Razón P/C", "", null, { derive: "pt_razon", decimals: 2 });
num("coagulacion", "isi", "ISI", "", null, { plausible: [0.8, 3] });
num("coagulacion", "inr", "INR", "", null, { derive: "inr", decimals: 2 });
num("coagulacion", "ptt_control", "Tiempo control", "seg", null, { plausible: [10, 80] });
num("coagulacion", "ptt_paciente", "Tiempo paciente", "seg", null, { plausible: [10, 250] });
num("coagulacion", "fibrinogeno", "Fibrinógeno", "mg/dL", [range(200, 400)], { plausible: [20, 1500] });

// Química sanguínea -----------------------------------------------------------------

num("quimica", "glicemia", "Glicemia", "mg/dL", [range(70, 110)], { plausible: [10, 1500], keywords: "glucosa basal" });
num("quimica", "urea", "Urea", "mg/dL", [range(10, 40)], { plausible: [1, 500] });
num("quimica", "creatinina", "Creatinina", "mg/dL", [range(0.5, 1.5)], { plausible: [0.1, 30] });
num("quimica", "colesterol_total", "Colesterol total", "mg/dL", [upTo(220)], { plausible: [30, 1000] });
num("quimica", "hdl", "HDL-colesterol", "mg/dL", bySex([27, 78], [33, 98]), { plausible: [5, 200] });
num("quimica", "ldl", "LDL-colesterol", "mg/dL", [range(66, 178)], { derive: "ldl", decimals: 0, plausible: [0, 900] });
num("quimica", "vldl", "VLDL-colesterol", "mg/dL", [range(5, 40)], { derive: "vldl", decimals: 0 });
num("quimica", "trigliceridos", "Triglicéridos", "mg/dL", [range(40, 165)], { plausible: [10, 5000] });
num("quimica", "acido_urico", "Ácido úrico", "mg/dL", bySex([3.7, 7], [2.5, 6]), { plausible: [0.5, 25] });
num("quimica", "indice_ct_hdl", "Riesgo colesterol total / HDL", "", null, {
  derive: "indice_ct_hdl",
  decimals: 2,
  refText: "Hombres — mitad: 3,43 · normal: 4,97 · doble: 9,55 · triple: 23,4\nMujeres — mitad: 3,27 · normal: 4,44 · doble: 7,05 · triple: 11,04",
  keywords: "indice aterogenico riesgo cardiaco",
});
num("quimica", "indice_ldl_hdl", "Riesgo LDL / HDL", "", null, {
  derive: "indice_ldl_hdl",
  decimals: 2,
  refText: "Hombres — mitad: 1 · normal: 3,55 · doble: 6,25 · triple: 7,99\nMujeres — mitad: 1,47 · normal: 3,22 · doble: 5,03 · triple: 6,14",
  keywords: "riesgo cardiaco",
});
num("quimica", "calcio", "Calcio", "mg/dL", [range(8.5, 10.4)], { plausible: [2, 20] });
num("quimica", "fosforo", "Fósforo", "mg/dL", [range(2.5, 4.8, { minAge: 18, label: "Adultos" }), range(3.7, 7, { maxAge: 18, label: "Niños" })], {
  plausible: [0.5, 20],
});
num("quimica", "magnesio", "Magnesio", "mEq/L", [range(1.3, 2.5)], { plausible: [0.2, 10] });
num("quimica", "sodio", "Sodio", "mEq/L", [range(135, 145)], { plausible: [100, 200] });
num("quimica", "potasio", "Potasio", "mEq/L", [range(3.5, 5)], { plausible: [1, 10] });
num("quimica", "cloro", "Cloro", "mEq/L", [range(95, 106)], { plausible: [60, 150] });
num("quimica", "bilirrubina_total", "Bilirrubina total", "mg/dL", [range(0.2, 1.2)], { plausible: [0, 50] });
num("quimica", "bilirrubina_directa", "Bilirrubina directa", "mg/dL", [range(0, 0.5)], { plausible: [0, 40] });
num("quimica", "bilirrubina_indirecta", "Bilirrubina indirecta", "mg/dL", null, { derive: "bilirrubina_indirecta", decimals: 2 });
num("quimica", "tgo", "Transaminasa oxalacética (TGO)", "U/L", [upTo(40)], { plausible: [0, 10000], keywords: "ast got" });
num("quimica", "tgp", "Transaminasa pirúvica (TGP)", "U/L", [upTo(38)], { plausible: [0, 10000], keywords: "alt gpt" });
num("quimica", "proteinas_totales", "Proteínas totales", "g/dL", [range(6.2, 8.5)], { plausible: [1, 15] });
num("quimica", "albumina", "Albúmina", "g/dL", [range(3.5, 5.3)], { plausible: [0.5, 8] });
num("quimica", "globulina", "Globulina", "g/dL", [range(2.4, 3.2)], { derive: "globulina", decimals: 1 });
num("quimica", "relacion_ag", "Relación A/G", "", [range(1.2, 2)], { derive: "relacion_ag", decimals: 2 });
num("quimica", "fosfatasa_alcalina", "Fosfatasa alcalina", "U/L", [range(30, 123)], { plausible: [1, 5000] });
num("quimica", "fosfatasa_acida_total", "Fosfatasa ácida total", "U/L", [range(0, 5.7)]);
num("quimica", "fosfatasa_acida_prostatica", "Fosfatasa ácida prostática", "U/L", [range(0, 1.2)]);
num("quimica", "ldh", "LDH (lactato deshidrogenasa)", "U/L", [range(207, 414)], { plausible: [10, 10000] });
num("quimica", "ck_total", "CK total (creatinfosfoquinasa)", "U/L", bySex([15, 110], [15, 90]), { plausible: [1, 100000], keywords: "cpk" });
num("quimica", "ck_mb", "CK-MB", "U/L", [range(0, 25)], { keywords: "cpk mb isoenzima" });
num("quimica", "amilasa", "Amilasa", "U/L", [range(20, 160)], { plausible: [1, 10000] });
num("quimica", "lipasa", "Lipasa", "U/L", [range(0, 30)]);
num("quimica", "ggt", "Gamma glutamil transferasa (GGT)", "U/L", bySex([10, 71], [6, 42]), { keywords: "gamma gt" });

// Perfil diabético ------------------------------------------------------------------

num("diabetes", "hba1c", "Hemoglobina glicosilada (HbA1c)", "%", [range(4, 6.3)], { plausible: [2, 20], keywords: "hb glicada" });
num("diabetes", "glicemia_post_1h", "Glicemia postprandial (1 hora)", "mg/dL", [range(70, 150)], { plausible: [10, 1500] });
num("diabetes", "glicemia_post_2h", "Glicemia postprandial (2 horas)", "mg/dL", [{ below: 140, text: "Normal: menor de 140" }], {
  refText: "Intermedio: 140 – 200\nDiabetes mellitus: mayor de 200",
  plausible: [10, 1500],
});
num("diabetes", "insulina_basal", "Insulinemia basal", "µUI/mL", [range(4.3, 19.9)]);
num("diabetes", "insulina_30", "Insulinemia 30 min", "µUI/mL", [range(12.5, 116)]);
num("diabetes", "insulina_60", "Insulinemia 60 min", "µUI/mL", [range(25, 231)]);
num("diabetes", "insulina_120", "Insulinemia 120 min", "µUI/mL", [range(18, 276)]);
num("diabetes", "insulina_180", "Insulinemia 180 min", "µUI/mL", [range(16, 166)]);

// Perfil tiroideo -------------------------------------------------------------------

num("tiroides", "t3_total", "T3 total", "ng/dL", [range(80, 200)]);
num("tiroides", "t4_total", "T4 total", "µg/dL", [range(4.5, 12)]);
num("tiroides", "tsh", "TSH ultrasensible", "µUI/mL", [range(0.35, 5.5)], { keywords: "tshus tirotropina" });
num("tiroides", "t3_libre", "T3 libre", "pg/mL", [range(2.3, 4.2)]);
num("tiroides", "t4_libre", "T4 libre", "ng/dL", [range(0.89, 1.76)]);
num("tiroides", "tiroglobulina", "Tiroglobulina", "ng/mL", [range(0, 3)]);

// Estudio de hierro ---------------------------------------------------------------

num("hierro", "hierro", "Hierro sérico", "µg/dL", [range(60, 150)], { keywords: "ferremia" });
num("hierro", "hierro_insaturado", "Hierro insaturado (UIBC)", "µg/dL", [range(130, 365)]);
num("hierro", "tibc", "Capacidad total de fijación (TIBC)", "µg/dL", null, { derive: "tibc", decimals: 0 });
num("hierro", "saturacion_transferrina", "Saturación de la transferrina", "%", [range(30, 50)], { derive: "saturacion_transferrina", decimals: 0 });
num("hierro", "transferrina", "Transferrina", "mg/dL", [range(250, 450)]);
num("hierro", "ferritina", "Ferritina", "ng/mL", bySex([25, 400], [11, 120]));

// Orina completa --------------------------------------------------------------------

opt("orina", "orina_aspecto", "Aspecto", ["CLARA", "LIG. TURBIDEZ", "MOD. TURBIDEZ", "TURBIO"]);
opt("orina", "orina_olor", "Olor", ["SUI GÉNERIS", "AMONIACAL", "FÉTIDO"], { default: "SUI GÉNERIS" });
opt("orina", "orina_color", "Color", ["AMARILLA", "AMBAR", "ROJIZO", "ANARANJADO", "PARDO"]);
opt("orina", "orina_ph", "pH", ["ÁCIDA (5)", "ÁCIDA (6)", "NEUTRO (7)", "ALCALINO (8)"], { keywords: "reaccion" });
opt("orina", "orina_densidad", "Densidad", ["1.000", "1.005", "1.010", "1.015", "1.020", "1.025", "1.030"]);
opt("orina", "orina_proteinas", "Proteínas", URINE_CHEMISTRY, { normal: ["NEGATIVO"], default: "NEGATIVO" });
opt("orina", "orina_hemoglobina", "Hemoglobina", URINE_CHEMISTRY, { normal: ["NEGATIVO"], default: "NEGATIVO" });
opt("orina", "orina_acetona", "Acetona", URINE_CHEMISTRY, { normal: ["NEGATIVO"], default: "NEGATIVO", keywords: "cetonas" });
opt("orina", "orina_glucosa", "Glucosa", URINE_CHEMISTRY, { normal: ["NEGATIVO"], default: "NEGATIVO" });
opt("orina", "orina_nitritos", "Nitritos", NEG_POS, { normal: ["NEGATIVO"], default: "NEGATIVO" });
opt("orina", "orina_urobilinogeno", "Urobilinógeno", ["NORMAL", "AUMENTADO"], { normal: ["NORMAL"], default: "NORMAL" });
opt("orina", "orina_pigmentos", "Pigmentos biliares", URINE_CHEMISTRY, { normal: ["NEGATIVO"], default: "NEGATIVO", keywords: "bilirrubina" });
opt("orina", "orina_leucocitos", "Leucocitos", PER_FIELD);
opt("orina", "orina_hematies", "Hematíes", PER_FIELD, { keywords: "eritrocitos" });
opt("orina", "orina_bacterias", "Bacterias", ["ESCASAS x CMP", "MODERADAS x CMP", "ABUNDANTES x CMP", "INCONTABLES x CMP"]);
opt("orina", "orina_celulas", "Células epiteliales", [
  "PLANAS ESC. x CMP", "PLANAS MOD. x CMP", "PLANAS ABTS. x CMP", "PLANAS Y REDONDAS ESC. x CMP",
  "PLANAS Y REDONDAS MOD. x CMP", "PLANAS Y REDONDAS ABTS. x CMP", "PLANAS MOD. Y REDONDAS ESC. x CMP",
  "PLANAS ABTS. Y REDONDAS ESC. x CMP", "PLANAS ESC. Y REDONDAS MOD. x CMP",
]);
opt("orina", "orina_cristales", "Cristales", ["NO SE OBSERVARON", "OXALATO DE CALCIO", "URATOS AMORFOS", "FOSFATOS AMORFOS", "ÁCIDO ÚRICO"]);
opt("orina", "orina_cilindros", "Cilindros", ["NO SE OBSERVARON", "HIALINOS", "GRANULOSOS", "LEUCOCITARIOS", "HEMÁTICOS"]);
opt("orina", "orina_moco", "Filamentos de moco", ["ESCASOS", "MODERADOS", "ABUNDANTES"]);
txt("orina", "orina_otros", "Otros");

// Orina casual y de 24 horas ----------------------------------------------------------

txt("orina_especial", "orina_na_k_cl", "Sodio, potasio y cloro (orina casual)", { refText: "No se reportan valores referenciales" });
num("orina_especial", "orina_calcio", "Calcio (orina casual)", "mg/dL", null, { refText: "No se reportan valores referenciales" });
num("orina_especial", "orina_fosforo", "Fósforo (orina casual)", "mg/dL", null, { refText: "No se reportan valores referenciales" });
num("orina_especial", "orina_acido_urico", "Ácido úrico (orina casual)", "mg/dL", null, { refText: "No se reportan valores referenciales" });
num("orina_especial", "catecolaminas", "Catecolaminas (orina casual)", "µg/dL", [range(0, 100)]);
num("orina_especial", "microalbuminuria", "Microalbuminuria (orina casual)", "mg/dL", [range(0.8, 2.2)]);
num("orina_especial", "indice_ca_creat", "Índice calcio / creatinina", "", [{ below: 0.2 }]);
num("orina_especial", "indice_au_creat", "Índice ácido úrico / creatinina", "", [{ below: 0.4 }]);
num("orina_especial", "indice_prot_creat", "Índice proteínas / creatinina", "", [{ below: 0.13 }]);
num("orina_especial", "calciuria", "Calciuria (orina de 24 h)", "mg/24 h", null, { refText: "Sin dieta: 100 – 300\nCon dieta: 50 – 150" });
num("orina_especial", "fosfaturia", "Fosfaturia (orina de 24 h)", "mg/24 h", [range(700, 1500)]);
num("orina_especial", "uricosuria", "Uricosuria (orina de 24 h)", "mg/24 h", [range(250, 750)]);
num("orina_especial", "citraturia", "Citraturia (orina de 24 h)", "mg/24 h", [range(25, 50)]);
num("orina_especial", "oxalaturia", "Oxalaturia (orina de 24 h)", "mg/24 h", [range(8, 40)]);
num("orina_especial", "magnesio_24h", "Magnesio (orina de 24 h)", "mg/24 h", [range(60, 120)]);
num("orina_especial", "urea_24h", "Urea (orina de 24 h)", "g/24 h", [range(20, 40)]);
num("orina_especial", "depuracion_urea", "Depuración de urea", "mL/min", null, { refText: "Máxima: 60 – 100\nEstándar: 40 – 65" });
num("orina_especial", "depuracion_creatinina", "Depuración de creatinina", "mL/min", [range(90, 140)]);
num("orina_especial", "proteinuria_24h", "Proteinuria (orina de 24 h)", "mg/24 h", [range(10, 100)]);
num("orina_especial", "cobre_24h", "Cobre (orina de 24 h)", "µg/24 h", [range(0, 160)]);
num("orina_especial", "microalbuminuria_24h", "Microalbuminuria (orina de 24 h)", "mg/24 h", [range(0.8, 2.2)]);
num("orina_especial", "cetoesteroides", "17-cetoesteroides (orina de 24 h)", "mg/24 h", [range(6, 12)]);
num("orina_especial", "hidroxiesteroides", "17-hidroxiesteroides (orina de 24 h)", "mg/24 h", [range(3, 15)]);
num("orina_especial", "vma", "Ácido vanilmandélico (orina de 24 h)", "mg/24 h", [range(1.45, 7.98)]);
num("orina_especial", "cortisol_libre_24h", "Cortisol libre (orina de 24 h)", "µg/24 h", [range(1.37, 5.5)]);

// Examen de heces ---------------------------------------------------------------------

opt("heces", "heces_aspecto", "Aspecto", ["HETEROGÉNEO", "HOMOGÉNEO"]);
opt("heces", "heces_color", "Color", ["AMARILLO", "MARRÓN", "GRIS", "NEGRUZCO", "BLANQUECINO", "VERDE"]);
opt("heces", "heces_consistencia", "Consistencia", ["BLANDA", "PASTOSA", "DIARREICA", "DURA"]);
opt("heces", "heces_olor", "Olor", ["FECAL", "FÉTIDO"], { default: "FECAL" });
opt("heces", "heces_moco", "Moco", AMOUNTS);
opt("heces", "heces_sangre", "Sangre", AMOUNTS, { default: "NO VISIBLES" });
opt("heces", "heces_restos", "Restos alimenticios", AMOUNTS, { keywords: "residuos" });
txt("heces", "heces_microscopico", "Análisis microscópico", {
  default: "NO SE OBSERVARON PARÁSITOS NI SUS FORMAS EVOLUTIVAS.",
  options: ["NO SE OBSERVARON PARÁSITOS NI SUS FORMAS EVOLUTIVAS."],
  keywords: "parasitos coproparasitologico",
});
opt("heces", "heces_mononucleares", "Leucograma fecal: mononucleares", ["NO SE OBSERVARON", "5 %", "10 %", "15 %", "20 %", "30 %", "40 %", "50 %"]);
opt("heces", "heces_polimorfonucleares", "Leucograma fecal: polimorfonucleares", ["NO SE OBSERVARON", "50 %", "60 %", "70 %", "80 %", "85 %", "90 %", "95 %"]);
qual("heces", "sangre_oculta", "Sangre oculta");
qual("heces", "azucares_reductores", "Azúcares reductores");
opt("heces", "heces_ph", "pH", ["5", "6", "7", "8"]);

// Inmuno-serología ----------------------------------------------------------------------

opt("inmunologia", "vdrl", "VDRL cualitativo", REACTIVE, { normal: ["NO REACTIVO"], keywords: "sifilis" });
txt("inmunologia", "vdrl_cuantitativo", "VDRL cuantitativo", { options: ["*****"], keywords: "diluciones sifilis" });
qual("inmunologia", "hiv", "HIV");
qual("inmunologia", "pcr", "Proteína C reactiva", { keywords: "pcr" });
qual("inmunologia", "ra_test", "R.A. Test (factor reumatoideo)", { keywords: "latex" });
opt("inmunologia", "embarazo", "Prueba de embarazo", NEG_POS, { keywords: "bhcg beta hcg" });
qual("inmunologia", "toxo_test", "Toxo test");
opt("inmunologia", "grupo_sanguineo", "Grupo sanguíneo", ["A", "B", "AB", "O"], { keywords: "tipiaje" });
opt("inmunologia", "factor_rh", "Factor Rh", ["POSITIVO", "NEGATIVO"], { keywords: "tipiaje" });
qual("inmunologia", "celulas_le", "Células LE");
qual("inmunologia", "dengue_igg", "Dengue IgG", { method: "Determinación por cromatografía" });
qual("inmunologia", "dengue_igm", "Dengue IgM", { method: "Determinación por cromatografía" });
qual("inmunologia", "paludismo", "Test de paludismo (P. falciparum / P. vivax)", { method: "Determinación por test pack", keywords: "malaria" });
opt("inmunologia", "toxoplasma", "Toxoplasma", ["NEGATIVO", "POSITIVO (1:128 dil)"], {
  normal: ["NEGATIVO"],
  method: "Método de hemaglutinación pasiva",
});
qual("inmunologia", "mono_test", "Mono test", { keywords: "mononucleosis" });
qual("inmunologia", "clamidia", "Test de clamidia bivalente", { note: "Incluye C. trachomatis y C. pneumoniae" });
qual("inmunologia", "h_pylori_igg", "Helicobacter pylori IgG", { method: "Determinación por quimioluminiscencia", refText: "< 1:8 diluciones: NEGATIVO\n> 1:8 diluciones: POSITIVO" });
qual("inmunologia", "h_pylori_igm", "Helicobacter pylori IgM", { method: "Determinación por quimioluminiscencia", refText: "< 1:8 diluciones: NEGATIVO\n> 1:8 diluciones: POSITIVO" });
qual("inmunologia", "h_pylori_sangre", "Helicobacter pylori en sangre (anticuerpos totales)", { method: "Determinación por test pack" });
qual("inmunologia", "h_pylori_heces", "Helicobacter pylori en heces (antígeno)", { method: "Determinación por test pack" });
qual("inmunologia", "ebv_igg", "Virus de Epstein-Barr IgG");
qual("inmunologia", "ebv_igm", "Virus de Epstein-Barr IgM");
qual("inmunologia", "ana", "Anticuerpos antinucleares (ANA)", { method: "Determinación por quimioluminiscencia", keywords: "lupus" });
qual("inmunologia", "anti_dna", "Anticuerpos anti-ADN (DNA)", { method: "Determinación por quimioluminiscencia", keywords: "lupus" });
qual("inmunologia", "smith", "Anti-Smith", { method: "Determinación por quimioluminiscencia", keywords: "lupus" });
qual("inmunologia", "hiv_duo", "HIV DUO", { method: "Test de cuarta generación: determinación inmunoenzimática por técnica ELFA" });
qual("inmunologia", "cocaina_suero", "Cocaína en suero", { method: "Determinación por test pack", keywords: "antidoping drogas" });
qual("inmunologia", "marihuana_suero", "Marihuana en suero", { method: "Determinación por test pack", keywords: "antidoping drogas" });
qual("inmunologia", "cocaina_orina", "Cocaína en orina", { method: "Determinación por test pack", keywords: "antidoping drogas" });
qual("inmunologia", "marihuana_orina", "Marihuana en orina", { method: "Determinación por test pack", keywords: "antidoping drogas" });
opt("inmunologia", "fta_abs", "F.T.A. absorbido", REACTIVE, {
  normal: ["NO REACTIVO"],
  refText: "Reactivo: +1 hasta +4",
  method: "Determinación por inmunofluorescencia",
  keywords: "sifilis",
});
qual("inmunologia", "leptospira", "Leptospira spp.", { method: "Detección de anticuerpos IgM por quimioluminiscencia" });
qual("inmunologia", "cmv_igg", "Citomegalovirus IgG", { refText: DILUTIONS_8_16 });
qual("inmunologia", "cmv_igm", "Citomegalovirus IgM", { refText: DILUTIONS_8_16 });
qual("inmunologia", "bence_jones", "Proteína de Bence Jones");
qual("inmunologia", "vph", "Marcador sérico VPH", { keywords: "virus papiloma humano" });
qual("inmunologia", "chagas", "Chagas (Machado Guerreiro)");
qual("inmunologia", "coombs_directo", "Coombs directo");
qual("inmunologia", "coombs_indirecto", "Coombs indirecto");
num("inmunologia", "rubeola_igg", "Rubéola IgG", "UI/mL", [{ below: 10, text: "Negativo: menor de 10" }], { refText: "Positivo: mayor de 10" });
num("inmunologia", "rubeola_igm", "Rubéola IgM", "UI/mL", [{ below: 0.8, text: "Negativo: menor de 0,80" }], { refText: "Positivo: mayor de 0,80" });
txt("inmunologia", "sarampion", "Sarampión IgG – IgM", { refText: "Positivo: 1:4 diluciones" });
num("inmunologia", "mycoplasma_igg", "Mycoplasma IgG", "mUI/mL", [range(0, 1.8)]);
num("inmunologia", "mycoplasma_igm", "Mycoplasma IgM", "mUI/mL", [range(0, 0.83)]);
num("inmunologia", "chlamydia_igg", "Chlamydias IgG", "mUI/mL", [range(0, 0.83)]);
num("inmunologia", "chlamydia_igm", "Chlamydias IgM", "mUI/mL", [range(0, 0.83)]);

// Anticuerpos e inmunoglobulinas ------------------------------------------------------------

num("anticuerpos", "toxo_igg", "Ac. antitoxoplasma IgG", "ng/dL", [range(600, 2000)]);
num("anticuerpos", "toxo_igm", "Ac. antitoxoplasma IgM", "ng/dL", [range(60, 220)]);
num("anticuerpos", "anticardiolipinas", "Ac. anticardiolipinas (IgG – IgM)", "mg/dL", [{ below: 10, text: "Negativo: menor de 10" }], {
  refText: "Positivo bajo: menor de 20\nPositivo moderado: menor de 80\nPositivo alto: mayor de 80",
});
num("anticuerpos", "antifosfolipidos", "Ac. antifosfolípidos", "mg/dL", [range(110, 250)]);
num("anticuerpos", "asto", "Ac. antiestreptolisina O (ASTO)", "U Todd", [range(0, 200)], { keywords: "antiestreptolisinas" });
num("anticuerpos", "antimicrosomales", "Ac. antimicrosomales", "U/mL", [range(0, 3)], { keywords: "anti tpo" });
num("anticuerpos", "antitiroglobulina", "Ac. antitiroglobulinas", "ng/mL", [range(0, 35)]);
num("anticuerpos", "antitiroideos", "Ac. antitiroideos", "ng/dL", [range(0, 3)]);
num("anticuerpos", "anti_ccp", "Anti CCP (péptidos citrulinados)", "UI/mL", [{ below: 20, text: "Negativo: menor de 20" }], {
  refText: "Positivo: mayor o igual a 20",
});
num("anticuerpos", "anti_adn_cuant", "Anti-ADN", "ng/dL", [range(0, 2.2)]);
num("anticuerpos", "ana_cuant", "Anticuerpos antinucleares (A.N.A.)", "ng/dL", [range(0, 3)]);
num("anticuerpos", "anti_musculo_liso", "Anti-músculo liso", "", [{ below: 0.2, text: "Negativo: menor de 0,2" }]);
num("anticuerpos", "ige", "Inmunoglobulina E (IgE)", "UI/mL", [
  range(0, 19, { maxAge: 2, label: "0 a 1 año" }),
  range(0, 101, { minAge: 2, maxAge: 9, label: "2 a 9 años" }),
  range(1.4, 300, { minAge: 9, maxAge: 16, label: "9 a 15 años" }),
  range(1, 183, { minAge: 16, label: "Adultos" }),
]);
num("anticuerpos", "igg", "Inmunoglobulina G (IgG)", "mg/dL", [range(500, 1200)]);
num("anticuerpos", "iga", "Inmunoglobulina A (IgA)", "mg/dL", [range(50, 350)]);
num("anticuerpos", "igm", "Inmunoglobulina M (IgM)", "mg/dL", [range(30, 230)]);
num("anticuerpos", "c3", "Complemento C3", "mg/dL", [range(52.6, 120)]);
num("anticuerpos", "c4", "Complemento C4", "mg/dL", [range(20.2, 49)]);
num("anticuerpos", "ch50", "Complemento hemolítico CH50", "UI/mL", [range(150, 250)]);
num("anticuerpos", "c1", "Complemento C1", "mg/dL", [range(18, 32)]);
num("anticuerpos", "crioglobulinas", "Crioglobulinas", "%", [range(0, 3)]);

// Marcadores tumorales -------------------------------------------------------------------

num("marcadores", "psa_total", "Antígeno prostático específico (PSA total)", "ng/mL", [range(0, 4)], {
  refText: "Por edad — menor de 40: 0,0 – 1,5 · 40 – 49: 0,0 – 2,5 · 50 – 59: 0,0 – 3,5 · 60 – 69: 0,0 – 4,5 · 70 – 79: 0,0 – 6,5",
});
num("marcadores", "psa_libre", "Antígeno prostático libre (PSA libre)", "ng/mL", [range(0.05, 0.25)]);
num("marcadores", "psa_indice", "Índice PSA libre / PSA total", "%", null, {
  derive: "psa_indice",
  decimals: 0,
  refText: "Menor de 7 %: asociación hasta 80 % con CA de próstata\nMayor de 25 %: asociación hasta 90 % con HPB",
});
num("marcadores", "cea", "Antígeno carcinoembrionario (CEA)", "ng/mL", null, { refText: "No fumadores: hasta 10\nFumadores: hasta 4,6" });
num("marcadores", "ca_15_3", "Ca 15-3", "U/mL", [range(0, 32)]);
num("marcadores", "ca_19_9", "Ca 19-9", "U/mL", [{ below: 33, text: "Menor de 33" }]);
num("marcadores", "ca_125", "Ca-125", "U/mL", [range(0, 34)]);
num("marcadores", "afp", "Alfa-fetoproteína", "UI/mL", null, {
  refText:
    "Mujer no embarazada: 1 – 7\nEmbarazada — semana 14: 0 – 23 · 15: 0 – 29 · 16: 0 – 32 · 17: 0 – 36 · 18: 0 – 42 · 19: 0 – 47 · 20: 0 – 54 · 21: 0 – 59 · 22: 0 – 60",
});

// Hormonas -----------------------------------------------------------------------------------

num("hormonas", "beta_hcg", "Gonadotrofina coriónica (fracción beta)", "mUI/mL", null, {
  refText:
    "Mujer no embarazada: 0 – 10\nEmbarazo — semana 1: 10 – 30 · 2: 30 – 100 · 3: 48 – 346 · 4: 268 – 1.073 · 5: 1.010 – 10.530 · 6: 11.634 – 100.154 · 7: 16.950 – 155.450 · 8: 64.200 – 258.200 · 9: 77.800 – 304.000\nMes 3: 26.000 – 244.000 · 4: 12.000 – 94.800 · 5: 3.700 – 59.100 · 6: 7.300 – 50.000 · 7: 6.300 – 79.100 · 8: 6.600 – 84.900 · 9: 4.200 – 106.200",
  keywords: "bhcg cuantitativa embarazo",
});
num("hormonas", "acth", "Hormona adrenocorticotropa (ACTH)", "pg/mL", [range(25, 100)]);
num("hormonas", "somatotropina_c", "Somatotropina C", "ng/dL", [range(1.3, 5)], { keywords: "somatomedina igf-1" });
num("hormonas", "pth", "Paratohormona (PTH)", "pg/mL", [range(10, 45)]);
num("hormonas", "cortisol_basal", "Cortisol basal", "µg/dL", [range(4.1, 22.4)]);
num("hormonas", "cortisol_no_basal", "Cortisol no basal", "µg/dL", [range(2.1, 11.2)]);
num("hormonas", "aldosterona", "Aldosterona", "ng/dL", [range(110, 190)]);
num("hormonas", "gh_basal", "Hormona de crecimiento basal", "ng/mL", [range(0, 7)]);
num("hormonas", "gh_ejercicio", "Hormona de crecimiento post-ejercicio (20 min)", "ng/mL", null);
num("hormonas", "testosterona_total", "Testosterona sérica", "ng/dL", bySex([241, 827], [14, 76]));
num("hormonas", "testosterona_libre", "Testosterona libre", "ng/mL", bySex([8, 12], [0.89, 2.2]));
num("hormonas", "dht", "Dihidrotestosterona", "µg/dL", bySex([80, 560], [35, 430]));
num("hormonas", "lh", "Hormona luteinizante (LH)", "mUI/mL", [range(1.5, 9.3, { sex: "M", label: "Hombres (20 – 70 años)" })], {
  refText: "Mujeres — fase folicular: 1,9 – 12,5 · mitad del ciclo: 8,7 – 76,3 · fase lútea: 0,5 – 16,9\nEmbarazo: < 0,1 – 1,5 · posmenopausia: 15,9 – 54 · anticonceptivos: 0,7 – 5,6",
});
num("hormonas", "fsh", "Hormona folículo estimulante (FSH)", "mUI/mL", [range(1.4, 18.1, { sex: "M", label: "Hombres (13 – 70 años)" })], {
  refText: "Mujeres — fase folicular: 2,5 – 10,2 · mitad del ciclo: 3,4 – 33,4 · fase lútea: 1,5 – 9,1\nEmbarazo: < 0,3 · posmenopausia: 23 – 116,3",
});
num("hormonas", "estradiol", "Estradiol sérico", "pg/mL", [{ sex: "M", high: 52, text: "ND – 52", label: "Hombres" }], {
  refText: "Mujeres — fase folicular: 11 – 69 (día -12) · 63 – 165 (día -4) · mitad del ciclo: 146 – 526\nFase lútea: 33 – 150 (día +2) · 68 – 196 (día +6) · 36 – 133 (día +12)",
});
num("hormonas", "progesterona", "Progesterona", "ng/mL", [range(0.28, 1.22, { sex: "M" })], {
  refText: "Mujeres — fase folicular: 0,15 – 1,40 · fase lútea: 3,34 – 25,56 · fase lútea media: 4,44 – 28,03\nPosmenopausia: ND – 0,73",
});
num("hormonas", "prolactina", "Prolactina", "ng/mL", [range(2.1, 17.7, { sex: "M" }), range(2.8, 29.2, { sex: "F", label: "Mujeres no embarazadas" })], {
  refText: "Embarazadas: 9,7 – 208,5 · posmenopausia: 1,8 – 20,3",
});
num("hormonas", "dhea", "DHEA", "µg/L", [range(2, 15)]);
num("hormonas", "dhea_so4", "DHEA-SO4", "ng/dL", bySex([80, 560], [35, 430]));
num("hormonas", "androstenediona", "Androstenediona", "ng/dL", [range(110, 190)]);
num("hormonas", "oh_progesterona", "17-OH progesterona", "ng/mL", [range(0.3, 4.2)]);

// Estudio cardiológico -------------------------------------------------------------------------

num("cardiologia", "troponina_t", "Troponina T", "ng/mL", [{ below: 5, text: "Negativo: menor de 5" }], { refText: "Positivo: mayor de 10" });
num("cardiologia", "troponina_i", "Troponina I", "ng/mL", [{ high: 0.5, text: "Positivo: mayor de 0,50" }]);
num("cardiologia", "dimero_d", "Dímero D", "ng/mL", [upTo(250)]);
num("cardiologia", "procalcitonina", "Procalcitonina", "ng/mL", [range(0, 0.5, { text: "0 – 0,5" })], {
  refText: "0,5 – 2,0: infección sistémica · 2,0 – 10: sepsis · 10 o más: choque séptico",
});
num("cardiologia", "mioglobina", "Mioglobina sérica", "µg/dL", [range(0, 3.3)]);

// Fármacos, tóxicos y vitaminas -------------------------------------------------------------------

num("farmacos", "fenitoina", "Fenitoína (Epamin)", "µg/mL", [range(10, 20)], { keywords: "dilantin" });
num("farmacos", "carbamazepina", "Carbamazepina (Tegretol)", "µg/mL", [range(8, 12)]);
num("farmacos", "acido_valproico", "Ácido valproico", "µg/mL", [range(50, 100, { minAge: 18, label: "Adultos" }), range(25, 59, { maxAge: 18, label: "Niños" })]);
num("farmacos", "digoxina", "Digoxina", "ng/mL", [range(0.8, 12)]);
num("farmacos", "fenobarbital", "Fenobarbital", "µg/mL", [range(25, 40)]);
num("farmacos", "teofilina", "Teofilina", "µg/mL", [range(20, 23)]);
num("farmacos", "ciclosporina", "Ciclosporina", "µg/dL", [range(203, 330)]);
num("farmacos", "plomo", "Plomo sérico", "mg/dL", [range(0.01, 0.08)]);
num("farmacos", "acetilcolinesterasa", "Acetilcolinesterasa", "U/L", [range(2500, 5000)]);
num("farmacos", "marihuana_sangre", "Marihuana en sangre", "ng/mL", [range(0, 1.75)]);
num("farmacos", "cocaina_sangre", "Cocaína en sangre", "ng/mL", [range(0, 2)]);
num("farmacos", "vitamina_b12", "Vitamina B12", "ng/dL", [range(20, 100)]);
num("farmacos", "folato", "Folato (ácido fólico)", "ng/mL", [range(2, 10)]);

// Bacteriología -----------------------------------------------------------------------------------------

txt("microbiologia", "gram", "Gram de secreción vaginal", {
  default: "No se observaron diplococos gram negativos.",
  options: ["No se observaron diplococos gram negativos."],
  method: "Tipo de muestra: secreción vaginal",
});
qual("microbiologia", "sars_cov2", "SARS-CoV-2 test rápido", { method: "Hisopado nasofaríngeo", keywords: "covid" });
txt("microbiologia", "cultivo", "Cultivo", { keywords: "urocultivo coprocultivo antibiograma" });

export const TESTS: Readonly<Record<string, TestDef>> = Object.fromEntries(TESTS_LIST.map((t) => [t.key, t]));
export const TEST_LIST: readonly TestDef[] = TESTS_LIST;

// Panels: the combinations the clinic prints -------------------------------------------------------------

const p = (key: string, category: CategoryKey, title: string, tests: string[], extra: Partial<PanelDef> = {}): PanelDef => ({
  key,
  category,
  title,
  groups: [{ tests }],
  ...extra,
});

const LIPIDS = ["colesterol_total", "hdl", "ldl", "vldl", "trigliceridos"];
const DIFFERENTIAL = ["segmentados", "linfocitos", "eosinofilos", "monocitos"];

export const PANELS: readonly PanelDef[] = [
  p("hematologia_completa", "hematologia", "Hematología completa", ["hemoglobina", "hematocrito", "vcm", "hcm", "chcm", "plaquetas", "leucocitos", ...DIFFERENTIAL], {
    description: "Serie roja, índices, plaquetas y fórmula leucocitaria",
    sectionTitle: "Hematología completa",
    keywords: "hemograma",
  }),
  p("hematologia_vsg", "hematologia", "Hematología completa + VSG", ["hemoglobina", "hematocrito", "vcm", "hcm", "chcm", "plaquetas", "leucocitos", ...DIFFERENTIAL, "vsg_1", "vsg_2", "katz"], {
    description: "Con velocidad de sedimentación e índice de Katz",
    sectionTitle: "Hematología completa",
    keywords: "hemograma eritrosedimentacion",
  }),
  p("hb_hto", "hematologia", "Hemoglobina y hematocrito", ["hemoglobina", "hematocrito", "vcm", "hcm", "chcm"], { description: "Con índices" }),
  p("formula_blanca", "hematologia", "Contaje y fórmula blanca", ["leucocitos", ...DIFFERENTIAL]),
  p("vsg", "hematologia", "Velocidad de sedimentación", ["vsg_1", "vsg_2", "katz"], { keywords: "eritrosedimentacion" }),
  p("frotis", "hematologia", "Drepanocitos y gota gruesa", ["drepanocitos", "gota_gruesa"]),

  {
    key: "coagulacion",
    category: "coagulacion",
    title: "Perfil de coagulación",
    description: "PT, PTT y fibrinógeno",
    groups: [
      { title: "Tiempo de protrombina (PT)", tests: ["pt_control", "pt_paciente", "pt_actividad", "pt_razon", "isi", "inr"] },
      { title: "Tiempo de tromboplastina parcial (PTT)", tests: ["ptt_control", "ptt_paciente"] },
      { tests: ["fibrinogeno"] },
    ],
  },
  { key: "pt", category: "coagulacion", title: "Tiempo de protrombina (PT)", groups: [{ title: "Tiempo de protrombina (PT)", tests: ["pt_control", "pt_paciente", "pt_actividad", "pt_razon", "isi", "inr"] }] },
  { key: "ptt", category: "coagulacion", title: "Tiempo de tromboplastina (PTT)", groups: [{ title: "Tiempo de tromboplastina parcial (PTT)", tests: ["ptt_control", "ptt_paciente"] }] },
  p("fibrinogeno", "coagulacion", "Fibrinógeno", ["fibrinogeno"]),

  p("perfil_rutina", "quimica", "Perfil de rutina", ["glicemia", "urea", "creatinina", ...LIPIDS, "acido_urico"], { description: "Glicemia, urea, creatinina, lípidos y ácido úrico" }),
  p("perfil_rutina_calcio", "quimica", "Perfil de rutina + calcio", ["glicemia", "urea", "creatinina", ...LIPIDS, "acido_urico", "calcio"]),
  p("glicemia", "quimica", "Glicemia", ["glicemia"]),
  p("gli_urea_crea", "quimica", "Glicemia, urea y creatinina", ["glicemia", "urea", "creatinina"], { keywords: "renal" }),
  p("perfil_lipidico", "quimica", "Perfil lipídico", LIPIDS, { keywords: "colesterol trigliceridos" }),
  p("lipidico_glicemia", "quimica", "Perfil lipídico + glicemia", ["glicemia", ...LIPIDS]),
  p("gli_col_tg", "quimica", "Glicemia, colesterol y triglicéridos", ["glicemia", "colesterol_total", "trigliceridos"]),
  p("gli_col_tg_au", "quimica", "Glicemia, colesterol, triglicéridos y ácido úrico", ["glicemia", "colesterol_total", "trigliceridos", "acido_urico"]),
  p("gli_u_c_c_t_a", "quimica", "Glicemia, urea, creatinina, colesterol, triglicéridos y ácido úrico", ["glicemia", "urea", "creatinina", "colesterol_total", "trigliceridos", "acido_urico"]),
  p("riesgo_cardiaco", "quimica", "Riesgo cardíaco", [...LIPIDS, "indice_ct_hdl", "indice_ldl_hdl"], { description: "Perfil lipídico con los índices de riesgo" }),
  p("perfil_hepatico", "quimica", "Perfil hepático", ["bilirrubina_total", "bilirrubina_directa", "bilirrubina_indirecta", "tgo", "tgp"], { keywords: "bilirrubinas" }),
  p("transaminasas", "quimica", "Transaminasas", ["tgo", "tgp"]),
  p("proteinas", "quimica", "Proteínas totales y fraccionadas", ["proteinas_totales", "albumina", "globulina", "relacion_ag"]),
  p("electrolitos", "quimica", "Electrolitos", ["sodio", "potasio", "cloro"]),
  p("enzimas", "quimica", "Fosfatasas", ["fosfatasa_alcalina", "fosfatasa_acida_total", "fosfatasa_acida_prostatica"]),

  p("perfil_diabetico", "diabetes", "Perfil diabético", ["glicemia", "glicemia_post_2h", "hba1c"]),
  p("curva_insulina", "diabetes", "Curva de insulina", ["insulina_basal", "insulina_30", "insulina_60", "insulina_120", "insulina_180"]),
  p("perfil_tiroideo", "tiroides", "Perfil tiroideo", ["t3_total", "t4_total", "tsh", "t3_libre", "t4_libre"]),
  p("estudio_hierro", "hierro", "Estudio de hierro", ["hierro", "hierro_insaturado", "tibc", "saturacion_transferrina", "transferrina", "ferritina"]),

  {
    key: "orina_completa",
    category: "orina",
    title: "Orina completa",
    description: "Caracteres físicos, análisis químico y examen microscópico",
    keywords: "uroanalisis examen de orina",
    groups: [
      { title: "Caracteres físicos", tests: ["orina_aspecto", "orina_olor", "orina_color", "orina_ph", "orina_densidad"] },
      {
        title: "Análisis químico",
        tests: ["orina_proteinas", "orina_hemoglobina", "orina_acetona", "orina_glucosa", "orina_nitritos", "orina_urobilinogeno", "orina_pigmentos"],
      },
      {
        title: "Examen microscópico",
        tests: ["orina_leucocitos", "orina_hematies", "orina_bacterias", "orina_celulas", "orina_cristales", "orina_cilindros", "orina_moco", "orina_otros"],
      },
    ],
  },
  p("orina_casual", "orina_especial", "Orina casual", ["orina_na_k_cl", "orina_calcio", "orina_fosforo", "orina_acido_urico", "microalbuminuria", "indice_ca_creat", "indice_au_creat", "indice_prot_creat"]),
  p("orina_24h", "orina_especial", "Orina de 24 horas", ["proteinuria_24h", "depuracion_creatinina", "calciuria", "uricosuria", "fosfaturia"]),

  {
    key: "heces",
    category: "heces",
    title: "Examen de heces",
    keywords: "coproanalisis heces parasitos",
    groups: [
      { title: "Caracteres físicos", tests: ["heces_aspecto", "heces_color", "heces_consistencia", "heces_olor", "heces_moco", "heces_sangre", "heces_restos"] },
      { title: "Análisis microscópico", tests: ["heces_microscopico"] },
    ],
  },
  {
    key: "heces_especiales",
    category: "heces",
    title: "Exámenes especiales de heces",
    groups: [{ title: "Exámenes especiales", tests: ["heces_mononucleares", "heces_polimorfonucleares", "sangre_oculta", "azucares_reductores", "heces_ph"] }],
  },

  p("serologia", "inmunologia", "VDRL, HIV, PCR y R.A. Test", ["vdrl", "vdrl_cuantitativo", "hiv", "pcr", "ra_test"], { keywords: "inmunologia" }),
  p("vdrl", "inmunologia", "VDRL", ["vdrl", "vdrl_cuantitativo"]),
  p("tipiaje", "inmunologia", "Tipiaje sanguíneo", ["grupo_sanguineo", "factor_rh"], { keywords: "grupo rh" }),
  p("dengue", "inmunologia", "Dengue", ["dengue_igg", "dengue_igm"]),
  p("helicobacter", "inmunologia", "Helicobacter pylori", ["h_pylori_igg", "h_pylori_igm"]),
  p("epstein_barr", "inmunologia", "Virus de Epstein-Barr", ["ebv_igg", "ebv_igm"]),
  p("antilupicos", "inmunologia", "Anticuerpos antilúpicos", ["ana", "anti_dna", "smith"], { keywords: "lupus" }),
  p("antidoping", "inmunologia", "Test antidoping", ["cocaina_suero", "marihuana_suero", "cocaina_orina", "marihuana_orina"]),
  p("citomegalovirus", "inmunologia", "Citomegalovirus", ["cmv_igg", "cmv_igm"]),
  p("coombs", "inmunologia", "Coombs", ["coombs_directo", "coombs_indirecto"]),

  p("inmunoglobulinas", "anticuerpos", "Inmunoglobulinas", ["ige", "igg", "iga", "igm"]),
  p("complemento", "anticuerpos", "Complemento", ["c3", "c4", "ch50", "c1"]),
  p("anticuerpos_tiroideos", "anticuerpos", "Anticuerpos tiroideos", ["antimicrosomales", "antitiroglobulina"]),
  p("psa", "marcadores", "Antígeno prostático (total y libre)", ["psa_total", "psa_libre", "psa_indice"]),
  p("hormonal_femenino", "hormonas", "Perfil hormonal femenino", ["lh", "fsh", "estradiol", "progesterona", "prolactina"]),
  p("androgenos", "hormonas", "Andrógenos", ["testosterona_total", "testosterona_libre", "dhea_so4", "androstenediona"]),
  p("cardiologico", "cardiologia", "Estudio cardiológico", ["ck_total", "ck_mb", "ldh", "troponina_i"]),
];

export const PANEL: Readonly<Record<string, PanelDef>> = Object.fromEntries(PANELS.map((panel) => [panel.key, panel]));

/** Every test key a panel adds, in order. */
export const panelTests = (panel: PanelDef) => panel.groups.flatMap((group) => group.tests);

/** Panels the catalog picker suggests first. */
export const FEATURED_PANELS = [
  "hematologia_completa",
  "perfil_rutina",
  "orina_completa",
  "heces",
  "perfil_lipidico",
  "gli_urea_crea",
  "serologia",
  "coagulacion",
  "perfil_hepatico",
  "tipiaje",
] as const;

/** Tests that, entered together, should add up to 100 %. */
export const DIFFERENTIAL_TESTS = [...DIFFERENTIAL, "basofilos"] as const;
