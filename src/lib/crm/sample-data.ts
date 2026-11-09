// Sample data for the first design of the admin platform. Every person,
// appointment and amount here is invented. It is replaced by Supabase tables
// (with RLS per role) when the data model is built.

/** The sample data describes one working day. */
export const SAMPLE_DAY = "Lunes 9 de noviembre";

export type Doctor = { id: string; name: string; specialty: string; room: string; hours: string };

export const DOCTORS: Doctor[] = [
  { id: "d1", name: "Dr. José Morales", specialty: "Medicina general", room: "Consultorio 1", hours: "Lun a vie · 7:30am a 1:00pm" },
  { id: "d2", name: "Dra. Andreína Rojas", specialty: "Odontología", room: "Consultorio 2", hours: "Lun a vie · 8:00am a 1:00pm" },
  { id: "d3", name: "Dr. Luis Carvajal", specialty: "Ecografía y electrocardiograma", room: "Sala de estudios", hours: "Lun, mié y vie · 7:30am a 12:00pm" },
  { id: "d4", name: "Lcda. María Guevara", specialty: "Bioanálisis", room: "Laboratorio", hours: "Lun a vie · 7:30am a 11:00am" },
];

export const doctorById = (id: string) => DOCTORS.find((d) => d.id === id)!;

export type ClinicalNote = { date: string; doctorId: string; title: string; text: string };

export type Patient = {
  id: string;
  name: string;
  cedula: string;
  age: number;
  sex: "F" | "M";
  phone: string;
  address: string;
  doctorId: string;
  since: string;
  lastVisit: string;
  nextVisit: string | null;
  // Clinical data: only for roles with clinical access to this patient.
  conditions: string[];
  allergies: string[];
  medication: string[];
  bloodType: string;
  notes: ClinicalNote[];
};

export const PATIENTS: Patient[] = [
  {
    id: "p-1042", name: "Carmen Salazar", cedula: "V-8.943.210", age: 67, sex: "F", phone: "0414-555 0142",
    address: "Vista Hermosa, Ciudad Bolívar", doctorId: "d1", since: "mar 2025", lastVisit: "27 oct 2026", nextVisit: "Hoy · 8:00am",
    conditions: ["Hipertensión", "Diabetes tipo 2"], allergies: ["Penicilina"], medication: ["Losartán 50 mg", "Metformina 850 mg"], bloodType: "O+",
    notes: [
      { date: "27 oct 2026", doctorId: "d1", title: "Control de tensión", text: "TA 138/86. Buena adherencia al tratamiento. Se solicita perfil lipídico y glicemia en ayunas." },
      { date: "28 oct 2026", doctorId: "d4", title: "Resultados de laboratorio", text: "Glicemia 118 mg/dL. Colesterol total 204 mg/dL. Resultados entregados a la paciente." },
      { date: "12 ago 2026", doctorId: "d3", title: "Electrocardiograma", text: "Ritmo sinusal, FC 72 lpm. Sin alteraciones agudas." },
    ],
  },
  {
    id: "p-1043", name: "Luis Alberto Figuera", cedula: "V-12.604.877", age: 52, sex: "M", phone: "0424-555 0178",
    address: "Los Próceres, Ciudad Bolívar", doctorId: "d1", since: "ene 2026", lastVisit: "14 oct 2026", nextVisit: "Hoy · 8:30am",
    conditions: ["Hipertensión"], allergies: [], medication: ["Amlodipina 5 mg"], bloodType: "A+",
    notes: [{ date: "14 oct 2026", doctorId: "d1", title: "Consulta general", text: "Cefalea ocasional. TA 142/90. Se ajusta dosis y se indica control en cuatro semanas." }],
  },
  {
    id: "p-1044", name: "Mariángel Rondón", cedula: "V-27.118.452", age: 24, sex: "F", phone: "0412-555 0111",
    address: "La Sabanita, Ciudad Bolívar", doctorId: "d2", since: "sep 2026", lastVisit: "30 sep 2026", nextVisit: "Hoy · 8:00am",
    conditions: ["Caries en molar 36"], allergies: ["Látex"], medication: [], bloodType: "B+",
    notes: [{ date: "30 sep 2026", doctorId: "d2", title: "Evaluación odontológica", text: "Caries oclusal en 36. Se planifica resina. Se indica limpieza previa." }],
  },
  {
    id: "p-1045", name: "José Gregorio Marcano", cedula: "V-6.221.905", age: 74, sex: "M", phone: "0416-555 0163",
    address: "Vista Hermosa, Ciudad Bolívar", doctorId: "d1", since: "jun 2025", lastVisit: "3 nov 2026", nextVisit: "Hoy · 9:00am",
    conditions: ["Diabetes tipo 2", "Adulto mayor"], allergies: [], medication: ["Glibenclamida 5 mg"], bloodType: "O-",
    notes: [{ date: "3 nov 2026", doctorId: "d1", title: "Control de diabetes", text: "Glicemia capilar 156 mg/dL. Se refuerza plan de alimentación. Se pide HbA1c." }],
  },
  {
    id: "p-1046", name: "Yusmary Bolívar", cedula: "V-19.870.336", age: 35, sex: "F", phone: "0424-555 0190",
    address: "Marhuanta, Ciudad Bolívar", doctorId: "d3", since: "oct 2026", lastVisit: "20 oct 2026", nextVisit: "Hoy · 8:30am",
    conditions: ["Control prenatal"], allergies: [], medication: ["Ácido fólico"], bloodType: "A+",
    notes: [{ date: "20 oct 2026", doctorId: "d3", title: "Ecosonograma obstétrico", text: "Gestación de 18 semanas, acorde. Sin hallazgos de alarma. Control en cuatro semanas." }],
  },
  {
    id: "p-1047", name: "Pedro Luis Cedeño", cedula: "V-15.332.698", age: 44, sex: "M", phone: "0412-555 0127",
    address: "Agua Salada, Ciudad Bolívar", doctorId: "d2", since: "jul 2026", lastVisit: "19 oct 2026", nextVisit: "Hoy · 9:00am",
    conditions: ["Gingivitis"], allergies: [], medication: [], bloodType: "O+",
    notes: [{ date: "19 oct 2026", doctorId: "d2", title: "Limpieza dental", text: "Tartrectomía y profilaxis. Se refuerza técnica de cepillado. Control en seis meses." }],
  },
  {
    id: "p-1048", name: "Ana Karina Yépez", cedula: "V-22.540.119", age: 29, sex: "F", phone: "0414-555 0155",
    address: "El Perú, Ciudad Bolívar", doctorId: "d1", since: "nov 2026", lastVisit: "Primera visita", nextVisit: "Hoy · 10:00am",
    conditions: [], allergies: [], medication: [], bloodType: "Sin registrar", notes: [],
  },
  {
    id: "p-1049", name: "Rafael Antonio Mata", cedula: "V-9.415.760", age: 61, sex: "M", phone: "0426-555 0134",
    address: "Los Coquitos, Ciudad Bolívar", doctorId: "d3", since: "abr 2026", lastVisit: "22 sep 2026", nextVisit: "Hoy · 9:30am",
    conditions: ["Arritmia en estudio"], allergies: ["AINEs"], medication: ["Bisoprolol 2,5 mg"], bloodType: "AB+",
    notes: [{ date: "22 sep 2026", doctorId: "d3", title: "Electrocardiograma", text: "Extrasístoles ventriculares aisladas. Se sugiere Holter y control con medicina general." }],
  },
  {
    id: "p-1050", name: "Daniela Sofía Guzmán", cedula: "V-31.207.584", age: 9, sex: "F", phone: "0412-555 0102",
    address: "Vista Hermosa, Ciudad Bolívar", doctorId: "d2", since: "ago 2026", lastVisit: "5 oct 2026", nextVisit: "Hoy · 10:30am",
    conditions: ["Odontopediatría"], allergies: [], medication: [], bloodType: "O+",
    notes: [{ date: "5 oct 2026", doctorId: "d2", title: "Control odontopediátrico", text: "Aplicación de flúor. Sellantes pendientes en primeros molares." }],
  },
  {
    id: "p-1051", name: "Nelson Enrique Brito", cedula: "V-11.098.243", age: 56, sex: "M", phone: "0424-555 0119",
    address: "La Paragua, Ciudad Bolívar", doctorId: "d1", since: "feb 2026", lastVisit: "8 oct 2026", nextVisit: "12 nov · 8:00am",
    conditions: ["Chequeo preventivo"], allergies: [], medication: [], bloodType: "A-",
    notes: [{ date: "8 oct 2026", doctorId: "d1", title: "Chequeo preventivo", text: "Examen físico sin hallazgos. Se solicita laboratorio completo y electrocardiograma." }],
  },
];

export const patientById = (id: string) => PATIENTS.find((p) => p.id === id);

export type PatientDocument = { id: string; patientId: string; name: string; kind: string; date: string; size: string };

/** Files attached to a patient record: results, reports, prescriptions. */
export const DOCUMENTS: PatientDocument[] = [
  { id: "doc-1", patientId: "p-1042", name: "Perfil lipídico y glicemia", kind: "Resultado de laboratorio", date: "28 oct 2026", size: "PDF · 184 KB" },
  { id: "doc-2", patientId: "p-1042", name: "Récipe: Losartán y Metformina", kind: "Receta", date: "27 oct 2026", size: "PDF · 92 KB" },
  { id: "doc-3", patientId: "p-1042", name: "Electrocardiograma", kind: "Informe de estudio", date: "12 ago 2026", size: "PDF · 1,2 MB" },
  { id: "doc-4", patientId: "p-1043", name: "Récipe: Amlodipina", kind: "Receta", date: "14 oct 2026", size: "PDF · 88 KB" },
  { id: "doc-5", patientId: "p-1044", name: "Radiografía periapical 36", kind: "Imagen", date: "30 sep 2026", size: "JPG · 640 KB" },
  { id: "doc-6", patientId: "p-1044", name: "Presupuesto de tratamiento", kind: "Presupuesto", date: "30 sep 2026", size: "PDF · 76 KB" },
  { id: "doc-7", patientId: "p-1046", name: "Ecosonograma obstétrico · 18 semanas", kind: "Informe de estudio", date: "20 oct 2026", size: "PDF · 2,1 MB" },
  { id: "doc-8", patientId: "p-1047", name: "Indicaciones de higiene oral", kind: "Indicaciones", date: "19 oct 2026", size: "PDF · 64 KB" },
  { id: "doc-9", patientId: "p-1049", name: "Electrocardiograma", kind: "Informe de estudio", date: "22 sep 2026", size: "PDF · 1,1 MB" },
  { id: "doc-10", patientId: "p-1050", name: "Consentimiento del representante", kind: "Consentimiento", date: "5 oct 2026", size: "PDF · 110 KB" },
  { id: "doc-11", patientId: "p-1051", name: "Orden de laboratorio y electrocardiograma", kind: "Orden", date: "8 oct 2026", size: "PDF · 70 KB" },
];

export type AppointmentStatus = "pendiente" | "confirmada" | "en_sala" | "en_consulta" | "atendida" | "no_asistio";
export type PaymentStatus = "pagado" | "por_cobrar" | "cashea";

export type Appointment = {
  id: string;
  time: string; // "HH:MM", 24h
  minutes: number;
  patientId: string;
  doctorId: string;
  service: string;
  status: AppointmentStatus;
  payment: PaymentStatus;
  price: number;
};

/** Today's agenda. */
export const APPOINTMENTS: Appointment[] = [
  { id: "a1", time: "07:30", minutes: 30, patientId: "p-1051", doctorId: "d4", service: "Perfil 20", status: "atendida", payment: "pagado", price: 18 },
  { id: "a2", time: "08:00", minutes: 30, patientId: "p-1042", doctorId: "d1", service: "Control de hipertensión", status: "atendida", payment: "pagado", price: 15 },
  { id: "a3", time: "08:00", minutes: 60, patientId: "p-1044", doctorId: "d2", service: "Resina dental", status: "atendida", payment: "cashea", price: 35 },
  { id: "a4", time: "08:30", minutes: 30, patientId: "p-1043", doctorId: "d1", service: "Consulta general", status: "en_consulta", payment: "pagado", price: 15 },
  { id: "a5", time: "08:30", minutes: 30, patientId: "p-1046", doctorId: "d3", service: "Ecosonograma obstétrico", status: "atendida", payment: "pagado", price: 25 },
  { id: "a6", time: "09:00", minutes: 30, patientId: "p-1045", doctorId: "d1", service: "Control de diabetes", status: "en_sala", payment: "por_cobrar", price: 15 },
  { id: "a7", time: "09:00", minutes: 60, patientId: "p-1047", doctorId: "d2", service: "Limpieza dental", status: "en_consulta", payment: "pagado", price: 25 },
  { id: "a8", time: "09:30", minutes: 30, patientId: "p-1049", doctorId: "d3", service: "Electrocardiograma", status: "en_sala", payment: "pagado", price: 20 },
  { id: "a9", time: "09:30", minutes: 30, patientId: "p-1042", doctorId: "d4", service: "Glicemia y perfil lipídico", status: "confirmada", payment: "por_cobrar", price: 12 },
  { id: "a10", time: "10:00", minutes: 30, patientId: "p-1048", doctorId: "d1", service: "Consulta general · primera vez", status: "confirmada", payment: "por_cobrar", price: 15 },
  { id: "a11", time: "10:30", minutes: 30, patientId: "p-1050", doctorId: "d2", service: "Odontopediatría", status: "confirmada", payment: "por_cobrar", price: 20 },
  { id: "a12", time: "11:00", minutes: 30, patientId: "p-1051", doctorId: "d1", service: "Chequeo preventivo", status: "pendiente", payment: "por_cobrar", price: 40 },
  { id: "a13", time: "11:00", minutes: 30, patientId: "p-1046", doctorId: "d3", service: "Ecosonograma abdominal", status: "no_asistio", payment: "por_cobrar", price: 25 },
];

export type Movement = { id: string; time: string; patientId: string; concept: string; method: string; amount: number; status: "cobrado" | "por_cobrar" };

export const MOVEMENTS: Movement[] = [
  { id: "R-2291", time: "7:34am", patientId: "p-1051", concept: "Perfil 20", method: "Pago móvil", amount: 18, status: "cobrado" },
  { id: "R-2292", time: "8:02am", patientId: "p-1042", concept: "Control de hipertensión", method: "Efectivo USD", amount: 15, status: "cobrado" },
  { id: "R-2293", time: "8:05am", patientId: "p-1044", concept: "Resina dental · inicial", method: "Cashea", amount: 14, status: "cobrado" },
  { id: "R-2294", time: "8:31am", patientId: "p-1043", concept: "Consulta general", method: "Punto de venta", amount: 15, status: "cobrado" },
  { id: "R-2295", time: "8:33am", patientId: "p-1046", concept: "Ecosonograma obstétrico", method: "Zelle", amount: 25, status: "cobrado" },
  { id: "R-2296", time: "9:04am", patientId: "p-1047", concept: "Limpieza dental", method: "Pago móvil", amount: 25, status: "cobrado" },
  { id: "R-2297", time: "9:28am", patientId: "p-1049", concept: "Electrocardiograma", method: "Efectivo USD", amount: 20, status: "cobrado" },
  { id: "R-2298", time: "9:05am", patientId: "p-1045", concept: "Control de diabetes", method: "Sin definir", amount: 15, status: "por_cobrar" },
];

/** Income per weekday for the current week (sample). */
export const WEEK_INCOME = [
  { day: "Lun", amount: 132, today: true },
  { day: "Mar", amount: 0 },
  { day: "Mié", amount: 0 },
  { day: "Jue", amount: 0 },
  { day: "Vie", amount: 0 },
];
export const LAST_WEEK_INCOME = [
  { day: "Lun", amount: 412 },
  { day: "Mar", amount: 368 },
  { day: "Mié", amount: 455 },
  { day: "Jue", amount: 390 },
  { day: "Vie", amount: 521 },
];

export type Service = { area: string; name: string; minutes: number; price: number };

export const SERVICES: Service[] = [
  { area: "Medicina general", name: "Consulta general", minutes: 30, price: 15 },
  { area: "Medicina general", name: "Control de hipertensión o diabetes", minutes: 30, price: 15 },
  { area: "Medicina general", name: "Chequeo preventivo", minutes: 30, price: 40 },
  { area: "Estudios", name: "Ecosonograma", minutes: 30, price: 25 },
  { area: "Estudios", name: "Electrocardiograma", minutes: 30, price: 20 },
  { area: "Odontología", name: "Evaluación odontológica", minutes: 30, price: 10 },
  { area: "Odontología", name: "Limpieza dental", minutes: 60, price: 25 },
  { area: "Odontología", name: "Resina dental", minutes: 60, price: 35 },
  { area: "Bioanálisis", name: "Hematología completa", minutes: 15, price: 6 },
  { area: "Bioanálisis", name: "Perfil 20", minutes: 15, price: 18 },
  { area: "Bioanálisis", name: "Examen de orina", minutes: 15, price: 4 },
];
