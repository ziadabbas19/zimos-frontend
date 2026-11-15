import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { followSiteTheme } from "@/lib/siteTheme";

/**
 * Keeps the sign-in screens in the marketing site's theme while moving
 * between pages: taken on the way into one, let go on the way out, in the same
 * frame as the page itself (lib/siteTheme.ts). Draws nothing.
 */
export function SiteTheme() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    followSiteTheme(pathname);
  }, [pathname]);
  return null;
}
