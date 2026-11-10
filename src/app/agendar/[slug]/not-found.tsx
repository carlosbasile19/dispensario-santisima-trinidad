import Link from "next/link";

import { Icon } from "@/components/crm/icons";

export default function BookingNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-4 py-20 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-frost text-navy">
        <Icon name="link" className="size-6" />
      </span>
      <h1 className="mt-5 font-serif text-[32px] leading-tight">Este enlace no está disponible</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-ink">
        Puede que el calendario haya cambiado de dirección. Elige con quién quieres atenderte para ver sus horarios.
      </p>
      <Link
        href="/agendar"
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-5 text-[15px] font-medium text-white hover:bg-teal"
      >
        Ver los calendarios del centro
        <Icon name="arrow-right" className="size-4" />
      </Link>
    </div>
  );
}
