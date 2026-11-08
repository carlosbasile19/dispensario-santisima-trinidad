import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold">Dispensario Santísima Trinidad</h1>
      <p className="text-foreground/70">Project baseline: Next.js, Supabase and Vercel.</p>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Go to dashboard
        </Link>
        <Link href="/login" className="rounded-md border border-foreground/20 px-4 py-2 text-sm">
          Sign in
        </Link>
      </div>
    </main>
  );
}
