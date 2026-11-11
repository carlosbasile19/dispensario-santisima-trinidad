// What the public booking pages receive and send. The calendar comes from
// booking_calendar() in the database: public information and free slots only.

import type { ServiceArea } from "@/lib/crm/clinic";
import type { SlotLength } from "@/lib/crm/schedule";

export type BookingService = {
  id: string;
  name: string;
  area: ServiceArea;
  /** The length of its slots. */
  minutes: SlotLength;
  /** Free start times ("HH:MM") by day ("YYYY-MM-DD"). */
  slots: Record<string, string[]>;
};

export type BookingCalendar = {
  id: string;
  slug: string;
  /** The professional's name as patients see it ("Dr. José Morales"). */
  name: string;
  avatarUrl: string | null;
  specialty: string | null;
  intro: string | null;
  /** Takes bookings online. */
  accepting: boolean;
  /** Today in the clinic. */
  today: string;
  horizonDays: number;
  services: BookingService[];
};

export type DirectoryEntry = {
  slug: string;
  name: string;
  avatarUrl: string | null;
  specialty: string | null;
  services: string[];
};

export type BookingRequest = {
  calendarId: string;
  serviceId: string;
  day: string;
  time: string;
  /** The patient's identity document: V or E (cédula) or P (passport). */
  documentType: string;
  documentNumber: string;
  notes?: string;
  /**
   * The form's one checkbox, required to book: the clinic keeps these
   * details to look after the visit and writes by WhatsApp (confirmation,
   * reminder and lab results). Recorded on the patient's record.
   */
  consent: boolean;
  /** Only for a patient the centre does not know yet. */
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

export type BookedVisit = {
  day: string;
  time: string;
  minutes: number;
  service: string;
  professional: string;
  /** A patient record was created with the details given. */
  registered: boolean;
};

/**
 * What the booking action answers. needs_details asks for the new patient's
 * name, last name, email and mobile; slot_taken means the page must reload
 * the free slots.
 */
export type BookingResult =
  | { status: "booked"; visit: BookedVisit }
  | { status: "needs_details"; message: string }
  | { status: "error"; message: string; reason?: "slot_taken" | "document" | "phone" | "email" | "consent" | "closed" };
