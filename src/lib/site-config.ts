// Single source for the public site's contact details, legal data and
// navigation, shared by the header, the mobile menu and the footer.

export const LEGAL_NAME = "Centro Médico Integral Santísima Trinidad";
/** RIF (Registro de Información Fiscal), shown in the footer of every page. */
export const RIF = "J-50550994-2";

export const WHATSAPP_URL = "https://wa.me/message/EWUXZCGJGG2TO1";
export const INSTAGRAM_URL = "https://www.instagram.com/santisimatrinidad_cmi/";
export const PHONE_DISPLAY = "0412-8261258";
export const PHONE_TEL = "tel:+584128261258";
export const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Calle+Brasil+36,+Vista+Hermosa,+Ciudad+Bol%C3%ADvar";
export const ADDRESS_SHORT = "Calle Brasil #36, Urb. Vista Hermosa, Ciudad Bolívar";
export const HOURS = "Lunes a viernes desde las 7:30am";

/** The three areas of the site. The header switcher and the mobile menu list these. */
export const AREAS = [
  {
    href: "/",
    label: "Inicio",
    description: "Medicina general, ecosonograma, electrocardiograma y chequeo preventivo.",
  },
  {
    href: "/odontologia",
    label: "Odontología",
    description: "Evaluación, limpieza, resinas y tratamientos para toda la familia.",
  },
  {
    href: "/bioanalisis",
    label: "Bioanálisis",
    description: "Laboratorio clínico: hematología, química sanguínea y examen de orina.",
  },
] as const;
