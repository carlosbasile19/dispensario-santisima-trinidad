import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { signOut } from "@/app/(auth)/login/actions";
import { Icon } from "@/components/crm/icons";
import { PhoneNav, PhoneNavPlaceholder } from "@/components/crm/phone-nav";
import { SidebarNav } from "@/components/crm/sidebar-nav";
import { Avatar } from "@/components/crm/ui";
import { ROLE_INFO, navFor } from "@/lib/crm/roles";
import { getViewer } from "@/lib/crm/viewer";
import mark from "../../../public/images/brand/mark.png";

// Added to the home screen of a phone or tablet, the platform opens full
// screen like an app (platform.webmanifest starts it at /dashboard).
export const metadata: Metadata = {
  title: { default: "Plataforma", template: "%s · Plataforma Santísima Trinidad" },
  robots: { index: false },
  manifest: "/platform.webmanifest",
  appleWebApp: { capable: true, title: "Trinidad", statusBarStyle: "default" },
};

// The canvas runs under the notch and the home indicator; the bars below pad
// themselves with the safe-area insets.
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#faf8f4" };

// Shell of the admin platform: sand sidebar, cream canvas, white cards. Three
// layouts share it: a phone has a top bar and a floating tab bar (PhoneNav),
// a tablet held upright a narrow icon rail, anything wider the full sidebar.
// Everything that depends on the signed-in user streams inside its own
// <Suspense> around a static frame.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="platform flex min-h-dvh flex-1 flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] md:flex-row">
      <header className="sticky top-0 z-30 border-b border-line bg-cream pt-[env(safe-area-inset-top)] md:hidden print:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <Image src={mark} alt="" className="size-8 object-contain" sizes="32px" />
            <span className="truncate font-serif text-[18px]">Santísima Trinidad</span>
          </Link>
          <Suspense fallback={<span className="size-9 rounded-full bg-sand" />}>
            <AccountLink />
          </Suspense>
        </div>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-[92px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line bg-sand px-2 py-5 md:flex lg:w-[248px] lg:gap-7 lg:px-4">
        <Link href="/dashboard" className="flex items-center justify-center gap-2.5 px-1 lg:justify-start">
          <Image src={mark} alt="" className="size-9 object-contain" sizes="36px" />
          <span className="hidden leading-tight lg:block">
            <span className="block font-serif text-[17px]">Santísima Trinidad</span>
            <span className="block text-[11px] tracking-[0.14em] text-stone uppercase">Plataforma</span>
          </span>
        </Link>
        <Suspense fallback={<div className="flex-1" />}>
          <Sidebar />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-5 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-8 md:py-8 lg:py-10">
          <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>{children}</Suspense>
        </main>
      </div>

      <Suspense fallback={<PhoneNavPlaceholder />}>
        <PhoneTabs />
      </Suspense>
    </div>
  );
}

async function AccountLink() {
  const viewer = await getViewer();
  return (
    <Link href="/dashboard/cuenta" aria-label="Mi cuenta" className="shrink-0 rounded-full">
      <Avatar name={viewer.name} src={viewer.avatarUrl} />
    </Link>
  );
}

async function PhoneTabs() {
  const viewer = await getViewer();
  return (
    <PhoneNav
      groups={navFor(viewer.role)}
      viewer={{ name: viewer.name, avatarUrl: viewer.avatarUrl, role: ROLE_INFO[viewer.role].label }}
    />
  );
}

async function Sidebar() {
  const viewer = await getViewer();
  return (
    <>
      <div className="flex-1">
        <SidebarNav groups={navFor(viewer.role)} />
      </div>
      <div className="flex flex-col items-center gap-2 border-t border-line pt-4 lg:flex-row lg:gap-2.5">
        <Avatar name={viewer.name} src={viewer.avatarUrl} />
        <div className="hidden min-w-0 flex-1 leading-tight lg:block">
          <p className="truncate text-sm font-medium">{viewer.name}</p>
          <p className="truncate text-[12px] text-muted">{ROLE_INFO[viewer.role].label}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="grid size-10 place-items-center rounded-lg text-muted hover:bg-white hover:text-navy lg:size-8"
          >
            <Icon name="logout" className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
