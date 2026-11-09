// Class strings shared by Server and Client Components. They live outside
// any "use client" module: a Server Component that imports a value from one
// receives a client reference, not the string.

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-outline bg-white px-3 text-sm text-navy outline-none transition-[border-color,box-shadow] placeholder:text-stone hover:border-navy/50 focus:border-navy focus:shadow-[0_0_0_3px_rgba(27,42,85,0.1)] disabled:bg-sand disabled:text-stone";
