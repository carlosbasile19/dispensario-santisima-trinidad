"use client";

import { ActionForm, Field, ModalActions, SubmitButton } from "@/components/crm/forms";
import { Modal } from "@/components/crm/modal";
import { Select } from "@/components/crm/select";
import { inputClass } from "@/components/crm/styles";
import { ROLE_INFO, type Role } from "@/lib/crm/roles";
import { createCalendar } from "./actions";
import { ServicePicker, type PickerService } from "./service-picker";

export type CandidateProfessional = { id: string; name: string; role: Role | null };

/**
 * "Nuevo calendario" (administrators): the professional, a specialty for the
 * booking page and the services patients can book, each with its slot
 * length. It starts Monday to Friday 7:30–12:00 and opens its hours next.
 */
export function NewCalendar({
  professionals,
  services,
}: {
  professionals: CandidateProfessional[];
  services: PickerService[];
}) {
  return (
    <Modal
      trigger="Nuevo calendario"
      triggerIcon="plus"
      triggerVariant="primary"
      title="Nuevo calendario"
      description="Un calendario por médico, con su enlace para que los pacientes agenden en línea."
      icon="slots"
      size="lg"
    >
      {professionals.length ? (
        <ActionForm action={createCalendar} className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Profesional">
              <Select
                name="professional"
                required
                placeholder="Elige el médico"
                searchPlaceholder="Buscar profesional…"
                panelMinWidth={280}
                options={professionals.map((p) => ({
                  value: p.id,
                  label: p.name,
                  avatar: p.name,
                  description: p.role ? ROLE_INFO[p.role].label : undefined,
                }))}
              />
            </Field>
            <Field label="Especialidad (opcional)" hint="La ven los pacientes bajo su nombre.">
              <input name="specialty" maxLength={80} placeholder="Medicina general" className={inputClass} />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-[13px] text-muted">Servicios que se pueden agendar en línea</p>
            <ServicePicker services={services} />
          </div>
          <ModalActions>
            <SubmitButton icon="check" pendingLabel="Creando…">
              Crear calendario
            </SubmitButton>
          </ModalActions>
        </ActionForm>
      ) : (
        <p className="pb-2 text-sm leading-relaxed text-muted">
          Todos los médicos ya tienen calendario. Para crear otro, dale el perfil de médico o de director médico a un
          miembro en Miembros.
        </p>
      )}
    </Modal>
  );
}
