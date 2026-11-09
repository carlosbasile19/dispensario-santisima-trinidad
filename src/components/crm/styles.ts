// Class strings shared by Server and Client Components. They live outside
// any "use client" module: a Server Component that imports a value from one
// receives a client reference, not the string.

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-outline bg-white px-3 text-sm text-navy outline-none focus:border-navy disabled:bg-sand disabled:text-stone";
