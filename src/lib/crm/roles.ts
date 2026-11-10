// Access model for the admin platform. Four roles, one permission table.
// The sidebar, every page guard and the "Roles y permisos" matrix all read
// from here, so a change to a role is made in one place.

import type { IconName } from "@/components/crm/icons";

export const ROLES = ["doctor", "director", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** "all": every patient · "own": only the doctor's own patients · "none": hidden. */
export type Scope = "all" | "own" | "none";

export type Permissions = {
  /** Agenda and patient list: whose appointments and patients are listed. */
  schedule: Exclude<Scope, "none">;
  /** Clinical data (history, diagnoses, notes, results): whose can be read. */
  clinical: Scope;
  /** Clinical data: whose can be written (new notes, changes). */
  editClinical: Scope;
  /** Open and download patient documents (results, reports, prescriptions). */
  documents: Scope;
  /** Book, move and check in appointments; register patients. */
  manageSchedule: boolean;
  /** Take payments at the front desk and set today's BCV rate. */
  collectPayments: boolean;
  /** Calendarios: create the booking calendars and edit their hours, services and links. */
  manageCalendars: boolean;
  /** Laboratorio: build, validate and correct lab result reports (everyone who sees a patient can print and send them). */
  labReports: boolean;
  /** Contabilidad: the price list, any day's BCV rate, voiding payments. */
  accounting: boolean;
  management: boolean;
  members: boolean;
};

export const ROLE_INFO: Record<
  Role,
  { label: string; short: string; description: string; permissions: Permissions }
> = {
  doctor: {
    label: "Médico",
    short: "Médico",
    description: "Atiende su agenda y ve la historia clínica de sus propios pacientes.",
    permissions: {
      schedule: "own",
      clinical: "own",
      editClinical: "own",
      documents: "own",
      manageSchedule: false,
      collectPayments: false,
      labReports: true,
      manageCalendars: false,
      accounting: false,
      management: false,
      members: false,
    },
  },
  director: {
    label: "Director médico",
    short: "Director",
    description: "Ve la agenda y la historia clínica de todos los pacientes del centro.",
    permissions: {
      schedule: "all",
      clinical: "all",
      editClinical: "all",
      documents: "all",
      manageSchedule: false,
      collectPayments: false,
      labReports: false,
      manageCalendars: false,
      accounting: false,
      management: false,
      members: false,
    },
  },
  staff: {
    label: "Personal operativo",
    short: "Operativo",
    description: "Agenda citas y cobra. Ve los datos y descarga documentos, sin modificarlos.",
    permissions: {
      schedule: "all",
      clinical: "all",
      editClinical: "none",
      documents: "all",
      manageSchedule: true,
      collectPayments: true,
      labReports: false,
      manageCalendars: false,
      accounting: false,
      management: false,
      members: false,
    },
  },
  admin: {
    label: "Administrador",
    short: "Admin",
    description: "Acceso completo, más contabilidad, gestión del centro y miembros.",
    permissions: {
      schedule: "all",
      clinical: "all",
      editClinical: "all",
      documents: "all",
      manageSchedule: true,
      collectPayments: true,
      labReports: true,
      manageCalendars: true,
      accounting: true,
      management: true,
      members: true,
    },
  },
};

export const can = (role: Role) => ROLE_INFO[role].permissions;

/** Icon of each role in the role pickers. */
export const ROLE_ICON: Record<Role, IconName> = {
  doctor: "stethoscope",
  director: "star",
  staff: "calendar",
  admin: "shield",
};

/** The roles as picker options, each with what it can do. */
export const roleOptions = () =>
  ROLES.map((role) => ({ value: role, label: ROLE_INFO[role].label, description: ROLE_INFO[role].description, icon: ROLE_ICON[role] }));

export type NavIcon = "home" | "calendar" | "slots" | "patients" | "flask" | "ledger" | "building" | "chat" | "team" | "key";
export type NavItem = { href: string; label: string; icon: NavIcon };
export type NavGroup = { title: string; items: NavItem[] };

/** Sidebar for a role. Sections a role cannot open are not listed at all. */
export function navFor(role: Role): NavGroup[] {
  const p = can(role);
  const groups: NavGroup[] = [
    {
      title: "Clínica",
      items: [
        { href: "/dashboard", label: "Inicio", icon: "home" },
        { href: "/dashboard/agenda", label: "Agenda", icon: "calendar" },
        { href: "/dashboard/calendarios", label: p.schedule === "own" ? "Mi calendario" : "Calendarios", icon: "slots" },
        { href: "/dashboard/pacientes", label: "Pacientes", icon: "patients" },
        { href: "/dashboard/laboratorio", label: "Laboratorio", icon: "flask" },
      ],
    },
  ];
  const adminItems: NavItem[] = [];
  if (p.accounting) adminItems.push({ href: "/dashboard/contabilidad", label: "Contabilidad", icon: "ledger" });
  if (p.management) adminItems.push({ href: "/dashboard/gestion", label: "Gestión", icon: "building" });
  if (p.management) adminItems.push({ href: "/dashboard/whatsapp", label: "WhatsApp", icon: "chat" });
  if (p.members) adminItems.push({ href: "/dashboard/miembros", label: "Miembros", icon: "team" });
  if (adminItems.length) groups.push({ title: "Administración", items: adminItems });
  groups.push({ title: "Cuenta", items: [{ href: "/dashboard/cuenta", label: "Mi cuenta", icon: "key" }] });
  return groups;
}

type Level = "full" | "own" | "read" | "none";
const scopeLevel = (scope: Scope): Level => (scope === "all" ? "full" : scope);

/** Rows of the "Roles y permisos" matrix, derived from the table above. */
export const PERMISSION_MATRIX: { group: string; rows: { label: string; level: (role: Role) => Level }[] }[] = [
  {
    group: "Clínica",
    rows: [
      { label: "Ver agenda y lista de pacientes", level: (r) => (can(r).schedule === "all" ? "full" : "own") },
      { label: "Agendar, mover y registrar llegadas", level: (r) => (can(r).manageSchedule ? "full" : "none") },
      {
        label: "Historia clínica, diagnósticos y resultados",
        level: (r) => {
          const { clinical, editClinical } = can(r);
          return clinical !== "none" && editClinical === "none" ? "read" : scopeLevel(clinical);
        },
      },
      { label: "Ver y descargar documentos", level: (r) => scopeLevel(can(r).documents) },
      {
        label: "Informes de laboratorio: crear, validar y corregir",
        level: (r) => (can(r).labReports ? (can(r).schedule === "all" ? "full" : "own") : "read"),
      },
      { label: "Cobrar en recepción y cargar la tasa BCV del día", level: (r) => (can(r).collectPayments ? "full" : "none") },
      {
        label: "Calendarios de reserva: horarios, servicios y enlaces",
        level: (r) => (can(r).manageCalendars ? "full" : can(r).schedule === "all" ? "read" : "own"),
      },
    ],
  },
  {
    group: "Administración",
    rows: [
      { label: "Contabilidad: tarifas, tasas BCV y anular cobros", level: (r) => (can(r).accounting ? "full" : "none") },
      { label: "Gestión del centro", level: (r) => (can(r).management ? "full" : "none") },
      { label: "Miembros y permisos", level: (r) => (can(r).members ? "full" : "none") },
    ],
  },
];
