import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/(auth)/login/actions";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Suspense fallback={<p className="text-sm text-foreground/60">Loading…</p>}>
        <Account />
      </Suspense>
    </main>
  );
}

async function Account() {
  const profile = await getCurrentProfile();

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-foreground/10 p-4">
      <p className="text-sm">
        Signed in as <span className="font-medium">{profile?.email}</span>
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
