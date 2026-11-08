import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import checkupPhoto from "../../../public/images/odontologia/checkup.jpg";
import heroPhoto from "../../../public/images/odontologia/hero.jpg";
import casheaLogo from "../../../public/images/cashea/logo.png";
import { OdontologiaLogo } from "@/components/service-logo";
import {
  Eyebrow,
  PHONE_DISPLAY,
  PHONE_TEL,
  PrimaryButton,
  SiteFooter,
  SiteHeader,
  WHATSAPP_URL,
  container,
  h2,
  serif,
} from "@/components/site";

export const metadata: Metadata = {
  title: "Odontología",
  description:
    "Odontología en el Centro Médico Integral Santísima Trinidad, Ciudad Bolívar: evaluación, limpieza, resinas, extracciones, endodoncia y odontopediatría. Agenda por WhatsApp.",
};

// Treatment list is a first draft: confirm with the clinic which treatments the
// dental service offers before launch.
const treatments = [
  {
    title: "Evaluación y diagnóstico",
    text: "Revisamos dientes, encías y mordida, y te explicamos con calma lo que encontramos y qué hacer primero.",
    includes: ["Examen clínico completo", "Plan de tratamiento por etapas", "Presupuesto antes de empezar"],
  },
  {
    title: "Limpieza dental y prevención",
    text: "Eliminamos placa y sarro para cuidar tus encías y prevenir caries.",
    includes: ["Profilaxis y pulido", "Aplicación de flúor", "Indicaciones de higiene en casa"],
  },
  {
    title: "Resinas y restauraciones",
    text: "Tratamos caries y reparamos dientes desgastados o fracturados con material del color de tu diente.",
    includes: ["Resinas estéticas", "Reparación de fracturas pequeñas"],
  },
  {
    title: "Extracciones",
    text: "Cuando un diente no se puede salvar, lo retiramos con anestesia local y te acompañamos en la recuperación.",
    includes: ["Extracciones simples", "Indicaciones y control posterior"],
  },
  {
    title: "Endodoncia",
    text: "Tratamiento de conducto para conservar un diente con la pulpa dañada y quitar el dolor.",
    includes: ["Evaluación del diente", "Tratamiento en una o varias citas"],
  },
  {
    title: "Odontopediatría",
    text: "Atención para niños en un ambiente tranquilo, para que su primera experiencia con el dentista sea buena.",
    includes: ["Control y prevención infantil", "Selladores y flúor", "Orientación para padres"],
  },
];

const firstVisit = [
  {
    title: "Escríbenos",
    text: `Agenda por WhatsApp o al ${PHONE_DISPLAY}. Te confirmamos día y hora de tu evaluación.`,
  },
  {
    title: "Evaluación y plan",
    text: "Te revisamos, resolvemos tus dudas y te entregamos un plan con las etapas y el presupuesto.",
  },
  {
    title: "Tratamiento a tu ritmo",
    text: "Avanzamos cita por cita, empezando por lo más urgente, con controles para cuidar el resultado.",
  },
];

export default function OdontologiaPage() {
  return (
    <div className="min-h-screen bg-cream text-navy">
      <SiteHeader />
      <main>
        <Hero />
        <Treatments />
        <FirstVisit />
        <Family />
        <CallToAction />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section
      className={`${container} grid grid-cols-1 items-center gap-10 pt-8 md:grid-cols-2 md:gap-14`}
    >
      <div className="flex flex-col items-start gap-7">
        <OdontologiaLogo size="md" />
        <h1
          className={`${serif} text-[clamp(44px,6vw,80px)] leading-none tracking-[-0.025em] text-balance`}
        >
          Una sonrisa sana, <i className="text-teal">cuidada de cerca.</i>
        </h1>
        <p className="max-w-[520px] text-[19px] leading-[1.55] text-pretty text-ink">
          Odontología para toda la familia en el mismo centro donde ya te atienden por tu nombre.
          Evaluación, prevención y tratamiento con explicaciones claras en cada paso.
        </p>
        <div className="flex flex-wrap gap-3">
          <PrimaryButton>Agenda tu evaluación</PrimaryButton>
          <a
            href="#tratamientos"
            className="rounded-lg border border-outline px-6 py-[15px] text-base text-navy hover:border-navy"
          >
            Ver tratamientos
          </a>
        </div>
      </div>
      <Image
        src={heroPhoto}
        alt="Odontóloga atendiendo a un paciente en consulta"
        priority
        className="h-[360px] w-full rounded-md object-cover object-top md:h-[620px]"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
    </section>
  );
}

function Treatments() {
  return (
    <section id="tratamientos" className={`${container} scroll-mt-6 pt-28`}>
      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
        <div className="flex flex-col gap-6 md:sticky md:top-8">
          <Eyebrow>Tratamientos</Eyebrow>
          <h2 className={h2}>
            Lo que tu boca necesita, <i>en un solo lugar.</i>
          </h2>
          <Image
            src={checkupPhoto}
            alt="Paciente tranquila durante una revisión dental"
            className="h-[300px] w-full rounded-md object-cover md:h-[380px]"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
        </div>
        <div className="border-t border-line">
          {treatments.map((t, i) => (
            <details key={t.title} className="group border-b border-line" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-baseline gap-5 py-6 [&::-webkit-details-marker]:hidden">
                <span className="flex-none font-mono text-[13px] text-stone">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-serif text-[28px] leading-[1.15]">{t.title}</span>
                <span
                  aria-hidden="true"
                  className="text-2xl leading-none text-teal transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="pb-7 pl-[52px]">
                <p className="max-w-[520px] text-[16px] leading-relaxed text-ink">{t.text}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {t.includes.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-[14px] text-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FirstVisit() {
  return (
    <section className={`${container} pt-28`}>
      <Eyebrow>Tu primera consulta</Eyebrow>
      <h2 className={`${h2} mt-3.5 mb-10`}>
        Sin sorpresas, <i>de principio a fin.</i>
      </h2>
      <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {firstVisit.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3.5 rounded-md bg-sand p-8">
            <span className="font-serif text-[44px] leading-none text-teal italic">{i + 1}.</span>
            <span className="font-serif text-[26px]">{step.title}</span>
            <span className="text-[15px] leading-[1.55] text-muted">{step.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Family() {
  return (
    <section className={`${container} pt-28`}>
      <div className="grid grid-cols-1 border-y border-line sm:grid-cols-3">
        {[
          { title: "Para toda la familia", text: "Niños, adolescentes, adultos y tercera edad." },
          { title: "Junto a tu médico", text: "Tu historia médica y dental en el mismo centro." },
          { title: "Paga en cuotas", text: "Tratamientos con Cashea: inicial y cuotas sin intereses." },
        ].map((item, i) => (
          <div
            key={item.title}
            className={[
              "border-line py-[22px] text-[15px] leading-[1.45] text-ink",
              i > 0 ? "border-t sm:border-t-0 sm:border-l sm:pl-5" : "",
              i < 2 ? "sm:pr-5" : "",
            ].join(" ")}
          >
            <span className="block font-serif text-2xl text-navy">{item.title}</span>
            {item.text}
          </div>
        ))}
      </div>
      <Link
        href="/#cashea"
        className="mt-6 inline-flex flex-wrap items-center gap-2.5 text-sm text-ink hover:text-navy"
      >
        <span>Aceptamos</span>
        <Image src={casheaLogo} alt="Cashea" className="h-6 w-auto" sizes="97px" />
        <span>· conoce cómo funciona →</span>
      </Link>
    </section>
  );
}

function CallToAction() {
  return (
    <section className={`${container} pt-28`}>
      <div className="flex flex-col items-start gap-6 rounded-md bg-navy px-6 py-12 text-frost sm:px-14 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Eyebrow className="text-mint">Odontología · Santísima Trinidad</Eyebrow>
          <p className="font-serif text-[clamp(32px,3.4vw,46px)] leading-[1.08]">
            Agenda tu evaluación <i className="text-mint">dental.</i>
          </p>
          <p className="text-[16px] text-mist">
            Lunes a viernes desde las 7:30am ·{" "}
            <a href={PHONE_TEL} className="font-semibold whitespace-nowrap text-white hover:text-mint">
              {PHONE_DISPLAY}
            </a>
          </p>
        </div>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-cream px-6 py-[15px] text-base text-navy hover:bg-white"
        >
          Escríbenos por WhatsApp
        </a>
      </div>
    </section>
  );
}
