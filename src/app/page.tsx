import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import consult from "../../public/images/consult.jpg";
import consult2 from "../../public/images/consult2.jpg";
import ecg from "../../public/images/ecg.jpg";
import eco from "../../public/images/eco.jpg";
import hero from "../../public/images/hero.jpg";
import lab from "../../public/images/lab.jpg";
import lab2 from "../../public/images/lab2.jpg";
import logo from "../../public/images/logo.jpg";
import senior from "../../public/images/senior.jpg";
import vials from "../../public/images/vials.jpg";
import casheaIcon from "../../public/images/cashea/icon.png";
import casheaLogo from "../../public/images/cashea/logo.png";

// Implements "Landing Santísima Trinidad.dc.html" (Claude Design project
// "Clinic landing page directions"), default variant: centered hero + jornada bar.

const WHATSAPP_URL = "https://wa.me/message/EWUXZCGJGG2TO1";
const INSTAGRAM_URL = "https://www.instagram.com/santisimatrinidad_cmi/";
const PHONE_DISPLAY = "0412-8261258";
const PHONE_TEL = "tel:+584128261258";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=Calle+Brasil+36,+Vista+Hermosa,+Ciudad+Bol%C3%ADvar";

const highlights = [
  { title: "Un solo lugar", text: "Consulta, estudios y laboratorio sin ir de un sitio a otro." },
  { title: "Desde temprano", text: "Lunes a viernes a partir de las 7:30am." },
  { title: "Trato cercano", text: "La salud que mereces, con el trato que esperas." },
  { title: "Para toda la familia", text: "Tercera edad, adultos, adolescentes y niños." },
];

const services: { image: StaticImageData; alt: string; title: string; text: string }[] = [
  {
    image: consult2,
    alt: "Consulta médica",
    title: "Consultas médicas",
    text: "Medicina general e integral para todas las edades. Control de diabetes e hipertensión con seguimiento.",
  },
  {
    image: eco,
    alt: "Ecosonograma",
    title: "Ecosonograma",
    text: "Estudios de imagen para ver con claridad lo que el examen físico no muestra.",
  },
  {
    image: ecg,
    alt: "Electrocardiograma",
    title: "Electrocardiograma",
    text: "Evaluación del ritmo y la salud de tu corazón, en minutos y sin dolor.",
  },
  {
    image: lab2,
    alt: "Laboratorio clínico",
    title: "Laboratorio clínico",
    text: "Hematología, química sanguínea y examen de orina, procesados en el centro.",
  },
];

const checkupItems = [
  "Hematología completa",
  "Peso, talla e IMC",
  "Glicemia",
  "Electrocardiograma",
  "Colesterol y triglicéridos",
  "Ecosonograma",
  "Ácido úrico, urea, creatinina",
  "Evaluación del adulto mayor",
  "Examen general de orina",
  "Control de tensión arterial",
];

const ongoingCare = [
  { title: "Diabetes", text: "Glicemia y control periódico" },
  { title: "Hipertensión", text: "Tensión, electro y ajuste de tratamiento" },
  { title: "Adulto mayor", text: "Evaluación integral y prevención" },
];

const casheaSteps = [
  {
    title: "Avísanos en recepción",
    text: "Dinos que pagarás con Cashea y escanea nuestro código QR con la app.",
  },
  {
    title: "Paga la inicial",
    text: "La abonas en el centro el día de tu atención. El porcentaje depende de tu nivel en Cashea.",
  },
  {
    title: "El resto, cada 14 días",
    text: "En cuotas iguales y sin intereses, que pagas desde la app.",
  },
];

const visitSteps = [
  {
    title: "Escríbenos",
    text: `Agenda por WhatsApp o al ${PHONE_DISPLAY}. Te confirmamos día y hora.`,
  },
  {
    title: "Ven preparado",
    text: "Para laboratorio, acude en ayunas y trae tu muestra de orina de la mañana.",
  },
  {
    title: "Recibe tus resultados",
    text: "Tu médico revisa los estudios contigo y define los siguientes pasos.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-navy">
      <a
        href="#jornada"
        className="block bg-navy px-5 py-[11px] text-center text-sm text-frost"
      >
        Jornada de Atención Médica: chequeo general, laboratorio, electrocardiograma y
        ecosonograma · <span className="text-mint">Reserva tu cupo →</span>
      </a>

      <SiteHeader />

      <main>
        <Hero />
        <Highlights />
        <Services />
        <Checkup />
        <Cashea />
        <OngoingCare />
        <Visit />
        <Jornada />
        <Location />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ---------- shared bits ---------- */

const container = "mx-auto w-full max-w-[1280px] px-4 sm:px-10";
const serif = "font-serif font-normal";
const h2 = `${serif} text-[clamp(38px,4vw,54px)] leading-[1.05] tracking-[-0.015em]`;

function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`text-[13px] tracking-[0.16em] text-teal uppercase ${className}`}>
      {children}
    </div>
  );
}

function PrimaryButton({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-block rounded-lg bg-navy px-6 py-[15px] text-base text-white transition-colors hover:bg-teal ${className}`}
    >
      {children}
    </a>
  );
}

/* ---------- sections ---------- */

function SiteHeader() {
  return (
    <header
      className={`${container} grid grid-cols-[1fr_auto] items-center gap-6 py-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`}
    >
      <nav className="hidden flex-wrap gap-7 text-[15px] md:flex">
        <a href="#servicios" className="text-navy hover:text-teal">Servicios</a>
        <a href="#chequeo" className="text-navy hover:text-teal">Chequeo preventivo</a>
        <a href="#visita" className="text-navy hover:text-teal">Tu visita</a>
      </nav>
      <Link href="/" aria-label="Inicio">
        <Image
          src={logo}
          alt="Centro Médico Integral Santísima Trinidad"
          priority
          className="h-16 w-auto mix-blend-multiply md:h-[84px]"
          sizes="84px"
        />
      </Link>
      <div className="flex items-center justify-end gap-[18px] text-[15px]">
        <Link href="/login" className="hidden text-muted hover:text-navy sm:inline">
          Acceso personal
        </Link>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-navy px-5 py-3 text-white transition-colors hover:bg-teal"
        >
          Agendar cita
        </a>
      </div>
    </header>
  );
}

function Hero() {
  const photo = "h-[260px] w-full rounded-md object-cover sm:h-[340px]";
  return (
    <section className={`${container} pt-10`}>
      <div className="mx-auto max-w-[1000px] text-center">
        <Eyebrow>Centro Médico Integral · Ciudad Bolívar</Eyebrow>
        <h1
          className={`${serif} mt-[22px] text-[clamp(44px,8vw,104px)] leading-none tracking-[-0.025em] text-balance`}
        >
          Cuida tu salud hoy, para abrazar <i className="text-teal">el mañana.</i>
        </h1>
        <p className="mx-auto mt-7 max-w-[600px] text-[19px] leading-[1.55] text-pretty text-ink">
          Un centro médico donde te atienden por tu nombre. Consulta, imagen y laboratorio
          bajo un mismo techo, para que cuidarte sea sencillo.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
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
            className="inline-flex flex-wrap items-center justify-center gap-2.5 text-sm text-ink hover:text-navy"
          >
            <span>Aceptamos</span>
            <Image src={casheaLogo} alt="Cashea" className="h-6 w-auto" sizes="97px" />
            <span>· paga en cuotas sin intereses</span>
          </a>
        </div>
      </div>
      <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <Image src={lab} alt="Muestras de laboratorio" className={`${photo} hidden md:block`} sizes="(min-width: 768px) 30vw, 100vw" />
        <Image src={hero} alt="Médica en consulta con paciente" priority className={photo} sizes="(min-width: 768px) 45vw, 100vw" />
        <Image src={eco} alt="Ecosonograma" className={`${photo} hidden md:block`} sizes="(min-width: 768px) 30vw, 100vw" />
      </div>
    </section>
  );
}

function Highlights() {
  return (
    <section className={`${container} pt-10`}>
      <div className="grid grid-cols-1 border-y border-line sm:grid-cols-2 lg:grid-cols-4">
        {highlights.map((h, i) => (
          <div
            key={h.title}
            className={[
              "border-line py-[22px] text-[15px] leading-[1.45] text-ink",
              // phone: stacked, divided by top borders
              i > 0 ? "border-t" : "",
              // 2 columns: second row gets a top border, right column a left border
              i < 2 ? "sm:border-t-0" : "",
              i % 2 === 1 ? "sm:border-l sm:pl-5" : "sm:pr-5",
              // 4 columns: one row, vertical dividers only
              "lg:border-t-0",
              i > 0 ? "lg:border-l lg:pl-5" : "",
              i < 3 ? "lg:pr-5" : "lg:pr-0",
            ].join(" ")}
          >
            <span className="block font-serif text-2xl text-navy">{h.title}</span>
            {h.text}
          </div>
        ))}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="servicios" className={`${container} scroll-mt-6 pt-24`}>
      <div className="mb-10 grid grid-cols-1 items-end gap-6 md:grid-cols-2 md:gap-12">
        <div>
          <Eyebrow>Servicios</Eyebrow>
          <h2 className={`${serif} mt-3.5 text-[clamp(40px,4.5vw,60px)] leading-[1.03] tracking-[-0.015em]`}>
            Atención médica <i>con propósito.</i>
          </h2>
        </div>
        <p className="max-w-[460px] text-[17px] leading-relaxed text-pretty text-ink">
          Todo lo necesario para un diagnóstico completo: el médico te evalúa, los estudios se
          hacen aquí mismo y los resultados vuelven a tu consulta.
        </p>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {services.map((s, i) => (
          <article key={s.title} className="flex flex-col gap-3.5">
            <Image
              src={s.image}
              alt={s.alt}
              className="aspect-[4/5] w-full rounded-md object-cover"
              sizes="(min-width: 1280px) 300px, (min-width: 768px) 45vw, 100vw"
            />
            <div className="font-mono text-[13px] text-stone">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="font-serif text-[28px] leading-[1.1]">{s.title}</h3>
            <p className="text-[15px] leading-normal text-muted">{s.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Checkup() {
  return (
    <section id="chequeo" className={`${container} scroll-mt-6 pt-28`}>
      <div className="grid grid-cols-1 overflow-hidden rounded-md bg-navy text-frost md:grid-cols-2">
        <div className="flex flex-col gap-[22px] px-6 py-10 sm:px-14 sm:pt-14 sm:pb-12">
          <Eyebrow className="text-mint">Chequeo preventivo</Eyebrow>
          <p className="font-serif text-[clamp(34px,3.6vw,48px)] leading-[1.08]">
            <i className="text-mint">“Sin esperar a estar mal…</i>
            <br />
            chequearse es lo ideal.”
          </p>
          <p className="max-w-[460px] text-[17px] leading-relaxed text-mist">
            Un chequeo médico anual es tu respaldo de tranquilidad. En una sola mañana
            revisamos lo esencial:
          </p>
          <ul className="grid grid-cols-1 gap-x-7 border-b border-white/15 text-[15px] sm:grid-cols-2">
            {checkupItems.map((item) => (
              <li key={item} className="border-t border-white/15 py-[11px]">
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-6 gap-y-3.5">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-cream px-6 py-[15px] text-base text-navy hover:bg-white"
            >
              Reservar mi chequeo
            </a>
            <a
              href="#cashea"
              className="inline-flex items-center gap-2.5 text-[15px] text-mint hover:text-white"
            >
              <Image src={casheaIcon} alt="" className="size-7 rounded-[7px]" sizes="28px" />
              o págalo en cuotas con Cashea →
            </a>
          </div>
        </div>
        <Image
          src={vials}
          alt="Muestras de sangre en el laboratorio"
          className="h-full min-h-[320px] w-full object-cover md:min-h-[520px]"
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>
    </section>
  );
}

function Cashea() {
  return (
    <section id="cashea" className={`${container} scroll-mt-6 pt-28`}>
      <div className="flex flex-wrap items-start gap-x-16 gap-y-12 rounded-md border border-line bg-white p-6 sm:p-14">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[22px]">
          <div className="flex flex-wrap items-center gap-3.5">
            <Eyebrow>Aceptamos</Eyebrow>
            <Image src={casheaLogo} alt="Cashea" className="h-9 w-auto" sizes="145px" />
          </div>
          <h2 className={h2}>
            Cuídate hoy, <i className="text-teal">paga en cuotas.</i>
          </h2>
          <p className="max-w-[460px] text-[17px] leading-relaxed text-pretty text-ink">
            Tu consulta, tus estudios o tu chequeo completo no tienen que pagarse de una sola
            vez: das una inicial y el resto lo pagas en cuotas sin intereses.
          </p>
          <PrimaryButton className="mt-1.5 self-start">Agenda por WhatsApp</PrimaryButton>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <h3 className="text-[13px] font-normal tracking-[0.12em] text-teal">ASÍ FUNCIONA</h3>
          <ol className="border-t border-line">
            {casheaSteps.map((step, i) => (
              <li key={step.title} className="flex items-baseline gap-5 border-b border-line py-[18px]">
                <span className="flex-none font-mono text-[13px] text-teal">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="block font-serif text-[22px] leading-[1.2]">{step.title}</span>
                  <span className="mt-1 block text-[15px] leading-normal text-muted">{step.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function OngoingCare() {
  return (
    <section
      className={`${container} grid grid-cols-1 items-center gap-10 pt-28 md:grid-cols-2 md:gap-16`}
    >
      <Image
        src={senior}
        alt="Médico conversando con paciente"
        className="h-[320px] w-full rounded-md object-cover md:h-[520px]"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <div className="flex flex-col gap-[22px]">
        <Eyebrow>Cuidado continuo</Eyebrow>
        <h2 className={h2}>
          Te acompañamos <i className="text-teal">más allá</i> de una consulta.
        </h2>
        <p className="text-[17px] leading-relaxed text-pretty text-ink">
          La diabetes, la hipertensión y la salud del adulto mayor necesitan constancia.
          Llevamos tu historia, tus controles y tus resultados para que cada visita parta de
          donde quedó la anterior.
        </p>
        <dl className="flex flex-col border-t border-line">
          {ongoingCare.map((c) => (
            <div key={c.title} className="flex justify-between gap-4 border-b border-line py-4">
              <dt className="font-serif text-[22px]">{c.title}</dt>
              <dd className="text-right text-[15px] text-muted">{c.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <section id="visita" className={`${container} scroll-mt-6 pt-28`}>
      <Eyebrow>Tu visita</Eyebrow>
      <h2 className={`${h2} mt-3.5 mb-10`}>
        Así de sencillo <i>es cuidarte.</i>
      </h2>
      <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {visitSteps.map((step, i) => (
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

function Jornada() {
  return (
    <section id="jornada" className={`${container} scroll-mt-6 pt-28`}>
      <div className="grid grid-cols-1 overflow-hidden rounded-md border border-line md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Image
          src={consult}
          alt="Médica atendiendo a un paciente"
          className="h-full min-h-[280px] w-full object-cover object-[60%_center] md:min-h-[360px]"
          sizes="(min-width: 768px) 45vw, 100vw"
        />
        <div className="flex flex-col justify-center gap-[18px] bg-white p-6 sm:p-12">
          <Eyebrow className="text-coral">Jornadas médicas</Eyebrow>
          <h3 className={`${serif} text-[clamp(32px,3.2vw,44px)] leading-[1.08]`}>
            Varias veces al año abrimos jornadas de{" "}
            <i className="text-teal">atención integral</i> para la comunidad.
          </h3>
          <p className="text-base leading-relaxed text-muted">
            Laboratorio, control de diabetes e hipertensión, electrocardiograma y ecosonograma
            en un mismo día, desde las 7:30am.
          </p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-lg border border-navy px-[22px] py-3.5 text-base text-navy hover:bg-navy hover:text-white"
          >
            Avísame de la próxima jornada
          </a>
        </div>
      </div>
    </section>
  );
}

function Location() {
  return (
    <section className={`${container} pt-28`}>
      <div className="grid grid-cols-1 items-start gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14">
        <div className="flex flex-col gap-7">
          <h2 className={h2}>
            Te esperamos. <i className="text-teal">Acércate y conoce nuestro centro.</i>
          </h2>
          <div className="grid grid-cols-1 gap-7 text-base leading-relaxed text-ink sm:grid-cols-2">
            <address className="not-italic">
              <div className="mb-1.5 text-[13px] tracking-[0.12em] text-teal">DIRECCIÓN</div>
              Urb. Vista Hermosa, Calle Brasil #36, diagonal a la antigua pastelería Dulzura,
              detrás del Estadio Heres. Ciudad Bolívar.
            </address>
            <div>
              <div className="mb-1.5 text-[13px] tracking-[0.12em] text-teal">
                HORARIO Y CONTACTO
              </div>
              Lunes a viernes
              <br />
              desde las 7:30am
              <br />
              <a href={PHONE_TEL} className="font-semibold text-navy hover:text-teal">
                {PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
        <a
          href={MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-[340px] items-end rounded-md bg-[repeating-linear-gradient(135deg,#ebe6dc_0_10px,#f3efe7_10px_20px)] p-[18px]"
        >
          <span className="font-mono text-xs text-[#6b6658]">
            mapa · Calle Brasil #36, Ciudad Bolívar · abrir en Google Maps →
          </span>
        </a>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className={`${container} pt-24 pb-10`}>
      <div className="flex flex-wrap items-end justify-between gap-8 border-t border-line pt-8">
        <div className="flex items-center gap-5">
          <Image src={logo} alt="" className="h-[72px] w-auto mix-blend-multiply" sizes="72px" />
          <span className="font-serif text-2xl text-teal italic">Tu salud, nuestra vocación.</span>
        </div>
        <nav className="flex flex-wrap gap-6 text-sm">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-teal hover:text-navy">
            Instagram
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-teal hover:text-navy">
            WhatsApp
          </a>
          <Link href="/login" className="text-muted hover:text-navy">
            Acceso personal
          </Link>
        </nav>
      </div>
      <p className="mt-5 text-xs text-stone">
        © 2026 Centro Médico Integral Santísima Trinidad · Fotografías provisionales de Pexels
      </p>
    </footer>
  );
}
