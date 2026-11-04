"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WEB_VITALS_SAMPLE_RATE } from "@/lib/webVitals";

const Reporter = dynamic(() => import("./WebVitalsReporter"), { ssr: false });

/**
 * Draws the visit once per page load: in the sample, it downloads the reporter
 * (lib/webVitals.ts); out of it, or with the sample at 0, nothing at all.
 */
export function StoreWebVitals({ storeId }: { storeId: string }) {
  const [sampled, setSampled] = useState(false);
  useEffect(() => {
    if (Math.random() < WEB_VITALS_SAMPLE_RATE) setSampled(true);
  }, []);
  return sampled ? <Reporter storeId={storeId} /> : null;
}
