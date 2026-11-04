"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  changeEvent,
  clickEvent,
  faqEvent,
  gtmAllowed,
  languageOf,
  loadGtm,
  pageSections,
  pageTypeOf,
  pushEvent,
  sectionName,
} from "@/lib/gtm";
import { isSignedUpPage } from "@/lib/urls";

/** The path the last page view was sent for: an effect run twice for one page (React's dev checks) sends one. */
let viewedPath: string | null = null;

/**
 * Google Tag Manager (lib/gtm.ts): loads the container, then puts on its
 * dataLayer a page view per route, every section that comes into view, every
 * click (sign-up, sign-in, contact, links, tabs, buttons), the FAQ questions
 * opened, the pricing's monthly / yearly switch and the features search.
 * Renders nothing; does nothing without NEXT_PUBLIC_GTM_ID.
 */
export function Gtm() {
  const pathname = usePathname();

  useEffect(() => {
    if (!gtmAllowed()) return;
    loadGtm();

    const onClick = (e: MouseEvent) => {
      const data = e.target instanceof Element ? clickEvent(e.target, new URL(window.location.href)) : null;
      if (data) pushEvent(data);
    };
    // A <details> says it opened with a `toggle` that does not bubble: caught on the way down.
    const onToggle = (e: Event) => {
      const data = e.target instanceof Element ? faqEvent(e.target) : null;
      if (data) pushEvent(data);
    };
    const onChange = (e: Event) => {
      const data = e.target instanceof Element ? changeEvent(e.target) : null;
      if (data) pushEvent(data);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("change", onChange, true);
    };
  }, []);

  // After the container's own start (the effect above): a page view per route, then its sections as they show.
  useEffect(() => {
    // The dashboard's hidden sign-up page sends its sign-up only (components/signed-up.tsx).
    if (!gtmAllowed() || !pathname || isSignedUpPage(pathname)) return;
    if (viewedPath !== pathname) {
      viewedPath = pathname;
      pushEvent({ event: "virtual_page_view", page_type: pageTypeOf(pathname), site_language: languageOf(pathname), page_path: pathname });
    }
    if (typeof IntersectionObserver === "undefined") return;

    const sections = pageSections();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          // Half of the section on screen, or half the screen for a section taller than it.
          const half = Math.min(entry.boundingClientRect.height, window.innerHeight) * 0.5;
          if (entry.intersectionRect.height < half) continue;
          observer.unobserve(entry.target);
          pushEvent({
            event: "section_view",
            section_name: sectionName(entry.target),
            section_position: sections.indexOf(entry.target) + 1,
          });
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
