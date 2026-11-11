"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import type { SpeedInsightsProps } from "@vercel/speed-insights";

import { performancePath } from "@/lib/performance-path";

const beforeSend: NonNullable<SpeedInsightsProps["beforeSend"]> = (event) => {
  try {
    const url = new URL(event.url);
    const route = performancePath(url.pathname);
    return { ...event, url: `${url.origin}${route}`, route };
  } catch {
    return null;
  }
};

export function PerformanceInsights() {
  return <SpeedInsights beforeSend={beforeSend} debug={false} />;
}
