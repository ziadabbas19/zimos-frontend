"use client";

import { useEffect, useState } from "react";
import { readOffer, type PublicOffer } from "@/lib/plan-offer";
import { API_BASE_URL } from "@/lib/urls";

/**
 * The plans as the console has them now. Starts with what the server read
 * (lib/plans.ts, at most a minute old), so the prices are in the page's
 * HTML; then the browser asks the API again — on every visit, and each time
 * the tab comes back into view — and follows what it answers (the owner,
 * 2026-11-14). An answer that fails or is not the list leaves the plans as
 * they were. Used by live-plans.tsx (the pricing page) and home-plans.tsx.
 */
export function useLiveOffer(initial: PublicOffer | null): PublicOffer | null {
  const [offer, setOffer] = useState<PublicOffer | null>(initial);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/plans/public`, { cache: "no-store", credentials: "omit" });
        if (!res.ok) return;
        const next = readOffer(await res.json());
        if (next && live) setOffer(next);
      } catch {
        // Offline, or the API out of reach: the plans stay as the page drew them.
      }
    };
    const onShow = () => {
      if (document.visibilityState === "visible") void load();
    };
    void load();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return offer;
}
