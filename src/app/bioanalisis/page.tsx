import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import heroPhoto from "../../../public/images/lab2.jpg";
import samplesPhoto from "../../../public/images/vials.jpg";
import casheaLogo from "../../../public/images/cashea/logo.png";
import { BioanalisisLogo } from "@/components/service-logo";
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
  title: "Bioanálisis",
  description:
    "Bioanálisis y laboratorio clínico en el Centro Médico Integral Santísima Trinidad, Ciudad Bolívar: hematología, química sanguínea, perfil lipídico y examen de orina. Agenda por WhatsApp.",
};

// Study list and preparation notes are a first draft based on what the landing
// already lists: confirm the full catalogue and fasting times with the lab.
const studies = [
  {
    title: "Hematología completa",
    text: "Cuenta y forma de glóbulos rojos, glóbulos blancos y plaquetas. Ayuda a detectar anemia, infecciones y otras alteraciones.",
    includes: ["Hemoglobina y hematocrito", "Fórmula leucocitaria", "Plaquetas"],
  },
  {
    title: "Química sanguínea",
    text: "Valores básicos para saber cómo están tu metabolismo y tus riñones.",
    includes: ["Glicemia", "Urea", "Creatinina", "Ácido úrico"],
  },
  {
    title: "Perfil lipídico",
    text: "Mide las grasas en sangre para evaluar tu riesgo cardiovascular.",
    includes: ["Colesterol total", "Triglicéridos"],
  },
  {
    title: "Examen general de orina",
    text: "Revisa aspecto, química y sedimento de la orina para detectar infecciones y problemas renales.",
    includes: ["Examen físico y químico", "Sedimento urinario"],
  },
  {
    title: "Controles de diabetes e hipertensión",
    text: "Los estudios que tu médico necesita en cada control, con tu historial en el mismo centro.",
    includes: ["Glicemia de control", "Función renal", "Seguimiento con tu médico"],
  },
  {
    title: "Perfil del chequeo preventivo",
    text: "Todos los exámenes del chequeo anual en una sola mañana, junto con la evaluación médica.",
    includes: ["Hematología", "Química y perfil lipídico", "Examen de orina"],
    link: { href: "/#chequeo", label: "Ver el chequeo preventivo →" },
  },
];

const preparation = [
  {
    title: "Ven en ayunas",
    text: "Para química sanguínea y perfil lipídico, no comas desde la noche anterior. Puedes tomar agua.",
  },
  {
    title: "Trae tu muestra de orina",
    text: "La primera orina de la mañana, en un envase limpio. Si no tienes uno, pídelo en recepción.",
  },
  {
    title: "Avísanos de tus medicamentos",
    text: "Cuéntanos qué tomas y trae tu orden médica si la tienes, para indicarte lo que corresponde.",
  },
];

export default function BioanalisisPage() {
  return (
    <div className="min-h-screen bg-cream text-navy">
      <SiteHeader />
      <main>
        <Hero />
        <Studies />
        <Preparation />
        <Results />
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
      <div className="hero-stagger flex flex-col items-start gap-7">
        <BioanalisisLogo size="md" />
        <h1
          className={`${serif} text-[clamp(44px,6vw,80px)] leading-none tracking-[-0.025em] text-balance`}
        >
          Resultados claros, <i className="text-teal">desde la primera muestra.</i>
        </h1>
        <p className="max-w-[520px] text-[19px] leading-[1.55] text-pretty text-ink">
          Laboratorio clínico en el mismo centro donde te atiende tu médico. Tomamos y procesamos
          tus muestras aquí, y los resultados vuelven a tu consulta.
        </p>
        <div className="flex flex-wrap gap-3">
          <PrimaryButton>Agenda tus exámenes</PrimaryButton>
          <a
            href="#estudios"
            className="rounded-lg border border-outline px-6 py-[15px] text-base text-navy hover:border-navy"
          >
            Ver estudios
          </a>
        </div>
      </div>
      <Image
        src={heroPhoto}
        alt="Tubos de muestras en el laboratorio clínico"
        priority
        className="hero-media h-[360px] w-full rounded-md object-cover md:h-[620px]"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
    </section>
  );
}

function Studies() {
  return (
    <section id="estudios" className={`${container} scroll-mt-6 pt-28`}>
      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
        <div className="flex flex-col gap-6 md:sticky md:top-8">
          <Eyebrow>Estudios</Eyebrow>
          <h2 className={h2}>
            Lo que tu médico necesita <i>saber de ti.</i>
          </h2>
          <Image
            src={samplesPhoto}
            alt="Muestras de sangre listas para procesar"
            className="h-[300px] w-full rounded-md object-cover md:h-[380px]"
            sizes="(min-width: 768px) 45vw, 100vw"
          />
        </div>
        <div className="border-t border-line">
          {studies.map((study, i) => (
            <details key={study.title} className="group border-b border-line" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-baseline gap-5 py-6 [&::-webkit-details-marker]:hidden">
                <span className="flex-none font-mono text-[13px] text-stone">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-serif text-[28px] leading-[1.15]">{study.title}</span>
                <span
                  aria-hidden="true"
                  className="text-2xl leading-none text-teal transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="pb-7 pl-[52px]">
                <p className="max-w-[520px] text-[16px] leading-relaxed text-ink">{study.text}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {study.includes.map((item) => (
                    <li
                      key={item}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-[14px] text-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                {study.link && (
                  <Link href={study.link.href} className="mt-4 inline-block text-[15px] text-teal hover:text-navy">
                    {study.link.label}
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Preparation() {
  return (
    <section className={`${container} pt-28`}>
      <Eyebrow>Antes de venir</Eyebrow>
      <h2 className={`${h2} mt-3.5 mb-10`}>
        Una buena muestra, <i>un buen resultado.</i>
      </h2>
      <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {preparation.map((step, i) => (
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

function Results() {
  return (
    <section className={`${container} pt-28`}>
      <div className="grid grid-cols-1 border-y border-line sm:grid-cols-3">
        {[
          { title: "Desde temprano", text: "Toma de muestras de lunes a viernes desde las 7:30am." },
          { title: "Procesado en el centro", text: "Tus muestras no salen del centro." },
          { title: "De vuelta a tu consulta", text: "Tu médico revisa los resultados contigo." },
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
        <span>· paga tus exámenes en cuotas →</span>
      </Link>
    </section>
  );
}

function CallToAction() {
  return (
    <section className={`${container} pt-28`}>
      <div className="flex flex-col items-start gap-6 rounded-md bg-navy px-6 py-12 text-frost sm:px-14 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3">
          <Eyebrow className="text-mint">Bioanálisis · Santísima Trinidad</Eyebrow>
          <p className="font-serif text-[clamp(32px,3.4vw,46px)] leading-[1.08]">
            Agenda tus <i className="text-mint">exámenes.</i>
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
