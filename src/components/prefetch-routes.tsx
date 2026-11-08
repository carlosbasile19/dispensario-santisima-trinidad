"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The public pages are small and static: fetch them all once the browser is
// idle so moving between them is instant (and the page transitions can pair
// shared elements, which needs the destination already in cache).
const ROUTES = ["/", "/odontologia", "/bioanalisis"];

export function PrefetchRoutes() {
  const router = useRouter();
  useEffect(() => {
    const run = () => ROUTES.forEach((r) => router.prefetch(r));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(run, 800);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
