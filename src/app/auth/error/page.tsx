import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Link invalid or expired</h1>
      <p className="text-sm text-foreground/70">
        The sign-in link could not be verified. Request a new one and try again.
      </p>
      <Link href="/login" className="text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </main>
  );
}
