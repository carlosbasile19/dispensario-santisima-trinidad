import Image from "next/image";
import { Great_Vibes } from "next/font/google";

import mark from "../../public/images/brand/mark.png";

// Service sub-brands (Odontología, Bioanálisis). Same structure as the clinic
// logo: the dove, cross and open hands mark, the name in teal script, a rule
// with a small service symbol in its centre, and the parent name in capitals.

const script = Great_Vibes({ subsets: ["latin"], weight: "400" });

const LOGO_TEAL = "#2fa9ae"; // script colour from the original logo

type GlyphProps = { className?: string };

function Tooth({ className = "" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    >
      <path d="M7.2 3.2C4.7 3.2 3.2 5.1 3.2 7.6c0 2 .8 3.4 1.4 5 .6 1.7.8 3.6 1.3 5.6.3 1.3.9 2.7 1.9 2.7 1.4 0 1.6-2.5 2.1-4.1.3-1 .8-1.7 2.1-1.7s1.8.7 2.1 1.7c.5 1.6.7 4.1 2.1 4.1 1 0 1.6-1.4 1.9-2.7.5-2 .7-3.9 1.3-5.6.6-1.6 1.4-3 1.4-5 0-2.5-1.5-4.4-4-4.4-1.9 0-2.9 1.1-4.8 1.1S9.1 3.2 7.2 3.2Z" />
    </svg>
  );
}

function TestTube({ className = "" }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2.8h6M10 2.8v13.7a2 2 0 0 0 4 0V2.8M10 10.5h4" />
      <path d="M5.5 21.2h13" />
    </svg>
  );
}

type Size = "sm" | "md" | "lg";
type LogoProps = { size?: Size; className?: string };

export function OdontologiaLogo(props: LogoProps) {
  return <ServiceLogo name="Odontología" Glyph={Tooth} {...props} />;
}

export function BioanalisisLogo(props: LogoProps) {
  return <ServiceLogo name="Bioanálisis" Glyph={TestTube} {...props} />;
}

function ServiceLogo({
  name,
  Glyph,
  size = "md",
  className = "",
}: LogoProps & { name: string; Glyph: (p: GlyphProps) => React.JSX.Element }) {
  const s = {
    sm: { mark: "h-14", name: "text-[34px]", caps: "text-[8px]", tooth: "size-3.5", gap: "gap-1" },
    md: { mark: "h-24", name: "text-[52px]", caps: "text-[10px]", tooth: "size-4", gap: "gap-1.5" },
    lg: { mark: "h-36", name: "text-[76px]", caps: "text-[13px]", tooth: "size-5", gap: "gap-2" },
  }[size];

  return (
    <div
      role="img"
      aria-label={`${name} · Santísima Trinidad, Centro Médico Integral`}
      className={`inline-flex flex-col items-center ${s.gap} ${className}`}
    >
      <Image src={mark} alt="" className={`${s.mark} w-auto`} sizes="160px" />
      <span
        className={`${script.className} ${s.name} leading-[1.05]`}
        style={{ color: LOGO_TEAL }}
      >
        {name}
      </span>
      <span className="flex w-full items-center gap-2" style={{ color: LOGO_TEAL }}>
        <span className="h-px flex-1 bg-[#7c93a6]" />
        <Glyph className={s.tooth} />
        <span className="h-px flex-1 bg-[#7c93a6]" />
      </span>
      <span className={`${s.caps} tracking-[0.22em] whitespace-nowrap text-[#3d4a63]`}>
        SANTÍSIMA TRINIDAD · CENTRO MÉDICO INTEGRAL
      </span>
    </div>
  );
}
