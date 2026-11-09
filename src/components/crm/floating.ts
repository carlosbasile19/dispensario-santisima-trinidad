"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";

// Positions a picker's panel next to its trigger. The panel is a
// popover="manual" element: shown with showPopover() it renders in the top
// layer, so no card's overflow clips it and it stays above an open modal.
// Placement is plain fixed coordinates (below the trigger, or above it when
// there is more room there), recomputed on scroll and resize.

const GAP = 6;
const EDGE = 8;

export function useFloatingPanel({
  open,
  triggerRef,
  panelRef,
  onDismiss,
  matchWidth = true,
  minWidth = 0,
  maxHeight = 340,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  /** Called on a pointer press outside the trigger and the panel. */
  onDismiss: () => void;
  /** Make the panel at least as wide as the trigger. */
  matchWidth?: boolean;
  /** Minimum width of the panel in pixels. */
  minWidth?: number;
  maxHeight?: number;
}) {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;

    if (typeof panel.showPopover === "function" && !panel.matches(":popover-open")) panel.showPopover();

    const place = () => {
      const rect = trigger.getBoundingClientRect();
      const viewportW = document.documentElement.clientWidth;
      const viewportH = window.innerHeight;
      panel.style.minWidth = `${Math.min(Math.max(matchWidth ? rect.width : 0, minWidth), viewportW - EDGE * 2)}px`;
      panel.style.maxWidth = `${viewportW - EDGE * 2}px`;

      const below = viewportH - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      panel.style.maxHeight = "";
      const natural = Math.min(panel.scrollHeight, maxHeight);
      const placeBelow = below >= natural || below >= above;
      panel.style.maxHeight = `${Math.max(Math.min(maxHeight, placeBelow ? below : above), 160)}px`;
      const height = panel.offsetHeight;
      panel.style.top = `${placeBelow ? rect.bottom + GAP : Math.max(EDGE, rect.top - GAP - height)}px`;

      const width = panel.offsetWidth;
      const left = Math.min(rect.left, viewportW - EDGE - width);
      panel.style.left = `${Math.max(EDGE, left)}px`;
      panel.dataset.side = placeBelow ? "bottom" : "top";
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, { capture: true });
      if (typeof panel.hidePopover === "function" && panel.matches(":popover-open")) panel.hidePopover();
    };
  }, [open, triggerRef, panelRef, matchWidth, minWidth, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, onDismiss, panelRef, triggerRef]);
}

/** Lower-case, without accents: "Odontología" → "odontologia". */
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Shared look of the floating panels. */
export const panelClass =
  "picker-panel fixed inset-auto m-0 flex flex-col overflow-hidden rounded-xl border border-line bg-white p-0 text-navy shadow-[0_18px_48px_-18px_rgba(27,42,85,0.35),0_2px_6px_-2px_rgba(27,42,85,0.08)]";
