// Access model for the admin platform. Four roles, one permission table.
// The sidebar, every page guard and the "Roles y permisos" matrix all read
// from here, so a change to a role is made in one place.

export const ROLES = ["doctor", "director", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** "all": every patient · "own": only the doctor's own patients · "none": hidden. */
export type Scope = "all" | "own" | "none";

export type Permissions = {
  /** Agenda and patient list: whose appointments and patients are listed. */
  schedule: Exclude<Scope, "none">;
  /** Clinical data: history, diagnoses, notes, results. */
  clinical: Scope;
  /** Book, move and check in appointments; register patients. */
  manageSchedule: boolean;
  /** Identity documents are shown in full (otherwise masked). */
  fullIdentity: boolean;
  /** Take payments at the front desk. */
  collectPayments: boolean;
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
      manageSchedule: false,
      fullIdentity: true,
      collectPayments: false,
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
      manageSchedule: false,
      fullIdentity: true,
      collectPayments: false,
      accounting: false,
      management: false,
      members: false,
    },
  },
  staff: {
    label: "Personal operativo",
    short: "Operativo",
    description: "Agenda citas, registra pacientes y cobra. No ve datos clínicos.",
    permissions: {
      schedule: "all",
      clinical: "none",
      manageSchedule: true,
      fullIdentity: false,
      collectPayments: true,
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
      manageSchedule: true,
      fullIdentity: true,
      collectPayments: true,
      accounting: true,
      management: true,
      members: true,
    },
  },
};

export const can = (role: Role) => ROLE_INFO[role].permissions;

export type NavIcon = "home" | "calendar" | "patients" | "ledger" | "building" | "team";
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
        { href: "/dashboard/pacientes", label: "Pacientes", icon: "patients" },
      ],
    },
  ];
  const adminItems: NavItem[] = [];
  if (p.accounting) adminItems.push({ href: "/dashboard/contabilidad", label: "Contabilidad", icon: "ledger" });
  if (p.management) adminItems.push({ href: "/dashboard/gestion", label: "Gestión", icon: "building" });
  if (p.members) adminItems.push({ href: "/dashboard/miembros", label: "Miembros", icon: "team" });
  if (adminItems.length) groups.push({ title: "Administración", items: adminItems });
  return groups;
}

type Level = "full" | "own" | "none";

/** Rows of the "Roles y permisos" matrix, derived from the table above. */
export const PERMISSION_MATRIX: { group: string; rows: { label: string; level: (role: Role) => Level }[] }[] = [
  {
    group: "Clínica",
    rows: [
      { label: "Ver agenda y lista de pacientes", level: (r) => (can(r).schedule === "all" ? "full" : "own") },
      { label: "Agendar, mover y registrar llegadas", level: (r) => (can(r).manageSchedule ? "full" : "none") },
      {
        label: "Historia clínica, diagnósticos y resultados",
        level: (r) => (can(r).clinical === "all" ? "full" : can(r).clinical === "own" ? "own" : "none"),
      },
      { label: "Documento de identidad completo", level: (r) => (can(r).fullIdentity ? "full" : "none") },
      { label: "Cobrar en recepción", level: (r) => (can(r).collectPayments ? "full" : "none") },
    ],
  },
  {
    group: "Administración",
    rows: [
      { label: "Contabilidad", level: (r) => (can(r).accounting ? "full" : "none") },
      { label: "Gestión del centro (servicios, precios, horarios)", level: (r) => (can(r).management ? "full" : "none") },
      { label: "Miembros y permisos", level: (r) => (can(r).members ? "full" : "none") },
    ],
  },
];
