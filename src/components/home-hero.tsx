import Image from "next/image";

import doctor from "../../public/images/doctor.jpg";
import eco from "../../public/images/ecosonograma.jpg";
import family from "../../public/images/familia.jpg";
import casheaLogo from "../../public/images/cashea/logo.png";
import { Eyebrow, PrimaryButton, container, serif } from "@/components/site";

// Home hero. Three layouts for the head doctor's portrait; pick one in
// src/app/page.tsx with <HomeHero variant="..." />.
//   centrado     – the design's default: three photos, the doctor in the centre
//   protagonista – centred copy, the doctor's photo taller than the two beside it
//   dividido     – the design's split variant: copy left, tall portrait right
export type HeroVariant = "centrado" | "protagonista" | "dividido";

const DOCTOR_NAME = "Dr. José Morales";
const DOCTOR_ALT = `${DOCTOR_NAME}, director médico del Centro Médico Integral Santísima Trinidad`;

export function HomeHero({ variant }: { variant: HeroVariant }) {
  if (variant === "dividido") return <HeroSplit />;
  return <HeroCentered feature={variant === "protagonista"} />;
}

function HeroCopy({ align }: { align: "center" | "left" }) {
  const center = align === "center";
  return (
    <>
      <Eyebrow>Centro Médico Integral · Ciudad Bolívar</Eyebrow>
      <h1
        className={`${serif} mt-[22px] leading-none tracking-[-0.025em] text-balance ${
          center ? "text-[clamp(44px,8vw,104px)]" : "text-[clamp(44px,6.5vw,88px)]"
        }`}
      >
        Cuida tu salud hoy, para abrazar <i className="text-teal">el mañana.</i>
      </h1>
      <p
        className={`mt-7 text-[19px] leading-[1.55] text-pretty text-ink ${
          center ? "mx-auto max-w-[600px]" : "max-w-[500px]"
        }`}
      >
        Un centro médico donde te atienden por tu nombre. Consulta, imagen y laboratorio bajo
        un mismo techo, para que cuidarte sea sencillo.
      </p>
      <div className={`mt-8 flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
        <PrimaryButton>Agenda por WhatsApp</PrimaryButton>
        <a
          href="#servicios"
          className="rounded-lg border border-outline px-6 py-[15px] text-base text-navy hover:border-navy"
        >
          Conoce los servicios
        </a>
      </div>
      <div className="mt-[26px]">
        <a
          href="#cashea"
          className={`inline-flex flex-wrap items-center gap-2.5 text-sm text-ink hover:text-navy ${
            center ? "justify-center" : ""
          }`}
        >
          <span>Aceptamos</span>
          <Image src={casheaLogo} alt="Cashea" className="h-6 w-auto" sizes="97px" />
          <span>· paga en cuotas sin intereses</span>
        </a>
      </div>
    </>
  );
}

function DoctorTag() {
  return (
    <figcaption className="absolute bottom-3 left-3 rounded-md bg-cream/90 px-4 py-3 shadow-[0_8px_24px_rgba(27,42,85,0.12)] backdrop-blur-sm sm:bottom-4 sm:left-4">
      <span className="block font-serif text-[19px] leading-tight text-navy">{DOCTOR_NAME}</span>
      <span className="mt-0.5 block text-[11px] tracking-[0.14em] text-teal">DIRECTOR MÉDICO</span>
    </figcaption>
  );
}

function HeroCentered({ feature }: { feature: boolean }) {
  const side = "w-full rounded-md object-cover hidden md:block h-[340px]";
  return (
    <section className={`${container} pt-10`}>
      <div className="hero-stagger mx-auto max-w-[1000px] text-center">
        <HeroCopy align="center" />
      </div>
      <div
        className={`hero-media mt-16 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] ${
          feature ? "md:items-end" : ""
        }`}
      >
        <Image
          src={family}
          alt="Madre e hija en la consulta pediátrica"
          className={`${side} ${feature ? "md:h-[300px]" : ""}`}
          sizes="(min-width: 768px) 30vw, 100vw"
        />
        {feature ? (
          <figure className="relative">
            <Image
              src={doctor}
              alt={DOCTOR_ALT}
              priority
              className="h-[420px] w-full rounded-md object-cover object-[50%_15%] md:h-[460px]"
              sizes="(min-width: 768px) 45vw, 100vw"
            />
            <DoctorTag />
          </figure>
        ) : (
          <Image
            src={doctor}
            alt={DOCTOR_ALT}
            priority
            className="h-[300px] w-full rounded-md object-cover object-[50%_12%] sm:h-[340px]"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
        )}
        <Image
          src={eco}
          alt="Ecosonograma abdominal"
          className={`${side} ${feature ? "md:h-[300px]" : ""}`}
          sizes="(min-width: 768px) 30vw, 100vw"
        />
      </div>
    </section>
  );
}

function HeroSplit() {
  return (
    <section
      className={`${container} grid grid-cols-1 items-center gap-10 pt-8 md:grid-cols-2 md:gap-14`}
    >
      <div className="hero-stagger">
        <HeroCopy align="left" />
      </div>
      <div className="hero-media rounded-md">
        <figure className="relative">
          <Image
            src={doctor}
            alt={DOCTOR_ALT}
            priority
            className="h-[460px] w-full rounded-md object-cover object-[50%_10%] md:h-[600px]"
            sizes="(min-width: 768px) 50vw, 100vw"
          />
          <DoctorTag />
        </figure>
      </div>
    </section>
  );
}
