"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { createVitalsSender, routeKindOf } from "@/lib/webVitals";

/** Reports this page load's Core Web Vitals (lib/webVitals.ts). Only a sampled visit downloads this. Draws nothing. */
export default function WebVitalsReporter({ storeId }: { storeId: string }) {
  const pathname = usePathname() ?? "/";
  // The page the visit landed on: the one the numbers are about.
  const route = useRef(routeKindOf(pathname));
  const sender = useRef<ReturnType<typeof createVitalsSender> | null>(null);
  if (!sender.current) {
    sender.current = createVitalsSender(storeId, () => ({
      route: route.current,
      device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
    }));
  }

  useReportWebVitals((metric) => sender.current?.add(metric.name, metric.value));

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") sender.current?.flush();
    };
    const leaving = () => sender.current?.flush();
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", leaving);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", leaving);
    };
  }, []);

  return null;
}
