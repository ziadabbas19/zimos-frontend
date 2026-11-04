"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { PING_MS, SITE_ANALYTICS_ENABLED, dashboardCta, sendSiteEvent, siteIds, withSiteSession } from "@/lib/site-analytics";
import { isSignedUpPage } from "@/lib/urls";

/**
 * Counts views, time on the site and clicks on the sign-up / sign-in links
 * (lib/site-analytics). Renders nothing; does nothing while the flag is off.
 */
export function SiteAnalytics() {
  const pathname = usePathname();

  // A view on load and on every route change. The dashboard's hidden sign-up page is not a visit.
  useEffect(() => {
    if (!SITE_ANALYTICS_ENABLED || !pathname || isSignedUpPage(pathname)) return;
    sendSiteEvent("view", pathname);
  }, [pathname]);

  useEffect(() => {
    if (!SITE_ANALYTICS_ENABLED || isSignedUpPage(window.location.pathname) || !siteIds()) return;

    // Time on the site: a ping every 15 s, only while this tab is visible.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") sendSiteEvent("ping");
    }, PING_MS);

    // Sign-up / sign-in clicks; the sign-up link carries the session (?sv=).
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const cta = dashboardCta(anchor.href);
      if (!cta) return;
      const current = siteIds();
      if (cta === "register" && current) anchor.href = withSiteSession(anchor.href, current.sessionId);
      sendSiteEvent("cta_click", window.location.pathname, cta);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  return null;
}
