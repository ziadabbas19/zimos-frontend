"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { loadGtm, pushEvent, signUpEvent } from "@/lib/gtm";

/** Sent once per page load, however often React runs the effect. */
let sent = false;

/**
 * The sign-up, put on the dataLayer of this hidden page (app/[locale]/signed-up).
 * The dashboard opens it in an invisible frame once an account is made, so the
 * tags run here, on this site, and never inside the dashboard.
 *
 * The container starts first: this effect runs before the layout's (components/gtm.tsx),
 * and the pixels must be set up by the time the sign-up reaches them.
 */
export function SignedUp() {
  const search = useSearchParams();

  useEffect(() => {
    if (sent) return;
    sent = true;
    loadGtm();
    pushEvent(signUpEvent(new URLSearchParams(search.toString())));
  }, [search]);

  return null;
}
