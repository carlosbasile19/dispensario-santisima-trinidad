import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { Icon } from "@/components/crm/icons";
import { SidebarNav } from "@/components/crm/sidebar-nav";
import { Avatar } from "@/components/crm/ui";
import { ROLE_INFO, navFor } from "@/lib/crm/roles";
import { getViewer } from "@/lib/crm/viewer";
import mark from "../../../public/images/brand/mark.png";

export const metadata: Metadata = {
  title: { default: "Plataforma", template: "%s · Plataforma Santísima Trinidad" },
  robots: { index: false },
};

// Shell of the admin platform: sand sidebar, cream canvas, white cards.
// The sidebar and the page both depend on the signed-in user, so each
// streams inside its own <Suspense> around a static frame.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-line bg-sand px-3 py-3 lg:sticky lg:top-0 lg:h-dvh lg:w-[248px] lg:gap-7 lg:border-r lg:border-b-0 lg:px-4 lg:py-5">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1">
          <Image src={mark} alt="" className="size-9 object-contain" sizes="36px" />
          <span className="leading-tight">
            <span className="block font-serif text-[17px]">Santísima Trinidad</span>
            <span className="block text-[11px] tracking-[0.14em] text-stone uppercase">Plataforma</span>
          </span>
        </Link>
        <Suspense fallback={<div className="h-10 lg:flex-1" />}>
          <Sidebar />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-8 lg:py-10">
          <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

async function Sidebar() {
  const viewer = await getViewer();
  return (
    <>
      <div className="lg:flex-1">
        <SidebarNav groups={navFor(viewer.role)} />
      </div>
      <div className="hidden items-center gap-2.5 border-t border-line pt-4 lg:flex">
        <Avatar name={viewer.name} src={viewer.avatarUrl} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{viewer.name}</p>
          <p className="truncate text-[12px] text-muted">{ROLE_INFO[viewer.role].label}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-white hover:text-navy"
          >
            <Icon name="logout" className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
