import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import mark from "../../../../public/images/brand/mark.png";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso personal", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center gap-7 px-4 py-16">
      <Link href="/" className="flex items-center gap-2.5 self-start">
        <Image src={mark} alt="" className="size-10 object-contain" sizes="40px" />
        <span className="leading-tight">
          <span className="block font-serif text-[18px]">Santísima Trinidad</span>
          <span className="block text-[11px] tracking-[0.14em] text-stone uppercase">Plataforma</span>
        </span>
      </Link>
      <div>
        <h1 className="font-serif text-4xl leading-tight">Acceso personal</h1>
        <p className="mt-2 text-[15px] text-muted">
          Solo para el equipo del centro. Si no tienes cuenta, pídesela a un administrador.
        </p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
