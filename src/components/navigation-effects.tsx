"use client";

import { useRouter } from "next/navigation";
import { addTransitionType, startTransition, useEffect } from "react";

// Client-side navigation behaviour for the public site.
//
// 1. Prefetch: the pages are small and static, so all of them are fetched once
//    the browser is idle and moving between them is instant.
// 2. Calm page switches: the hero entrance animations play only on the first
//    page a visitor lands on. Once they navigate, <html data-navigated> turns
//    them off (see globals.css), so switching pages is a short fade, not a
//    replay of every entrance.
// 3. From partway down a page, the page crossfade would snapshot the new page
//    before Next resets the scroll. Those navigations are tagged
//    "from-scrolled", which the layout maps to no page animation.

const ROUTES = ["/", "/odontologia", "/bioanalisis"];
const SCROLLED_PX = 80;

function markNavigated() {
  document.documentElement.dataset.navigated = "";
}

export function NavigationEffects() {
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
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement) || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

      // A real page change: from here on, pages appear without entrance replays.
      markNavigated();
      if (window.scrollY < SCROLLED_PX) return; // next/link handles it, with the crossfade

      e.preventDefault();
      e.stopPropagation();
      startTransition(() => {
        addTransitionType("from-scrolled");
        router.push(url.pathname + url.search + url.hash);
      });
    }
    // Capture phase: runs before next/link's own click handler.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", markNavigated);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", markNavigated);
    };
  }, [router]);

  return null;
}
