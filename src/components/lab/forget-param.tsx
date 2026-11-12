"use client";

import { useEffect } from "react";

/** Takes a one-time flag (?validado=1) out of the address once it was shown, so a reload does not show it again. */
export function ForgetParam({ name }: { name: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [name]);
  return null;
}
