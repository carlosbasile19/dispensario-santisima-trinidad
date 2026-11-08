"use client";

import { useRouter } from "next/navigation";
import { addTransitionType, startTransition, useEffect } from "react";

// The public pages are small and static: fetch them all once the browser is
// idle so moving between them is instant.
const ROUTES = ["/", "/odontologia", "/bioanalisis"];

// A page transition snapshots the new page before Next resets the scroll, so a
// navigation started from partway down a page would show the new page scrolling
// up inside the crossfade. In that case we tag the transition "from-scrolled":
// the layout maps it to no page animation, and the new page's hero entrance
// plays instead. From the top of a page, the normal crossfade runs.
const SCROLLED_PX = 80;

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

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (window.scrollY < SCROLLED_PX) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      startTransition(() => {
        addTransitionType("from-scrolled");
        router.push(url.pathname + url.search + url.hash);
      });
    }
    // Capture phase: runs before next/link's own click handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return null;
}
