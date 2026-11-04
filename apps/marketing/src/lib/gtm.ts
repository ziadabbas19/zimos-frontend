import { dashboardCta, trackingRefused } from "@/lib/site-analytics";

/**
 * Google Tag Manager for this site, and the events it gets on its dataLayer
 * (components/gtm.tsx sends them). The container that turns them into GA4,
 * Meta and TikTok events is kept outside the repo, as a GTM export.
 *
 * Off unless NEXT_PUBLIC_GTM_ID holds a container id (GTM-XXXX), and nothing
 * loads when the browser asks not to be tracked (Do Not Track or Global
 * Privacy Control), as for the site's own visit counting.
 *
 * The site only: the stores have their own pixels (Tracking tools in the
 * dashboard), and the dashboard has none.
 */

const RAW_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
export const GTM_ID = /^GTM-[A-Z0-9]{4,12}$/.test(RAW_ID) ? RAW_ID : null;

type Value = string | number;
export type GtmEvent = { event: string } & Record<string, Value>;

type GtmWindow = Window & { dataLayer?: unknown[] };

/** Tag Manager may run here: a container is set and the visitor did not refuse tracking. */
export function gtmAllowed(): boolean {
  if (!GTM_ID || typeof window === "undefined") return false;
  try {
    return !trackingRefused();
  } catch {
    return false;
  }
}

/** Google's container snippet, once per page. */
export function loadGtm(): void {
  if (!gtmAllowed() || document.getElementById("gtm-script")) return;
  const w = window as GtmWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "gtm-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

export function pushEvent(data: GtmEvent): void {
  if (!gtmAllowed()) return;
  try {
    const w = window as GtmWindow;
    (w.dataLayer = w.dataLayer || []).push(data);
  } catch {
    // Never surfaces.
  }
}

// ------------------------------------------------------------- the page --

export function languageOf(path: string): "ar" | "en" | "" {
  const first = path.split("/")[1];
  return first === "ar" || first === "en" ? first : "";
}

/** home, features, pricing, contact, credits, or the policy page's own slug (terms, privacy …). */
export function pageTypeOf(path: string): string {
  const rest = path.split("/").filter(Boolean);
  if (languageOf(path)) rest.shift();
  return rest[0] || "home";
}

const text = (el: Element | null) =>
  (el?.getAttribute("aria-label") || el?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);

/** A page section and not one of its own blocks: the outermost <section> around the element. */
function sectionOf(el: Element): Element | null {
  let section = el.closest("section");
  while (section?.parentElement?.closest("section")) section = section.parentElement.closest("section");
  return section;
}

/** What a section is called in the events: its `data-section`, else its id, else its heading's id (`contact-heading` → contact). */
export function sectionName(section: Element): string {
  const labelledBy = section.getAttribute("aria-labelledby")?.split(" ")[0].replace(/-heading$/, "");
  return section.getAttribute("data-section") || section.id || labelledBy || "section";
}

/** The page's sections in order, the outermost ones only. */
export function pageSections(root: ParentNode = document): Element[] {
  return Array.from(root.querySelectorAll("main section")).filter((s) => !s.parentElement?.closest("section"));
}

/** Where on the page an element is: header, header_menu, footer, a section's name, or page. */
export function placeOf(el: Element): string {
  if (el.closest(".lz-sheet")) return "header_menu";
  if (el.closest(".lz-top")) return "header";
  if (el.closest("footer")) return "footer";
  const section = sectionOf(el);
  return section ? sectionName(section) : "page";
}

// ------------------------------------------------------------- the clicks --

const SOCIAL: Record<string, string> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "x.com": "x",
  "twitter.com": "x",
  "linkedin.com": "linkedin",
  "snapchat.com": "snapchat",
  "t.me": "telegram",
  "threads.net": "threads",
};
const WHATSAPP = new Set(["wa.me", "api.whatsapp.com", "web.whatsapp.com"]);

/**
 * The event for a click, or null for a click that is none of ours (another
 * site's link: GA4's enhanced measurement counts those as outbound clicks).
 */
export function clickEvent(target: Element, page: URL): GtmEvent | null {
  const where = placeOf(target);

  const tab = target.closest('[role="tab"]');
  if (tab) {
    const group = tab.closest('[role="tablist"]')?.getAttribute("aria-label") ?? "";
    return { event: "tab_click", tab_group: group.slice(0, 100), tab_name: text(tab), cta_location: where };
  }

  const anchor = target.closest("a[href]");
  if (!anchor) {
    const button = target.closest('button, [role="button"]');
    return button ? { event: "ui_click", click_text: text(button), cta_location: where } : null;
  }

  const href = anchor.getAttribute("href") ?? "";
  let url: URL;
  try {
    url = new URL(href, page);
  } catch {
    return null;
  }

  const cta = dashboardCta(url.href);
  if (cta === "register") {
    // A plan card's button names the plan it signs up for (?plan=&cycle=).
    const card = anchor.closest("li[aria-labelledby]");
    const heading = card ? document.getElementById(card.getAttribute("aria-labelledby") ?? "") : null;
    return {
      event: "sign_up_click",
      cta_location: where,
      cta_text: text(anchor),
      plan_id: url.searchParams.get("plan") ?? "",
      plan_name: url.searchParams.get("plan") ? text(heading) : "",
      billing_cycle: url.searchParams.get("cycle") ?? "",
    };
  }
  if (cta === "login") return { event: "login_click", cta_location: where, cta_text: text(anchor) };

  if (url.protocol === "mailto:") return { event: "contact_click", contact_method: "email", cta_location: where };
  if (url.protocol === "tel:") return { event: "contact_click", contact_method: "phone", cta_location: where };
  const host = url.hostname.replace(/^(www|m)\./, "");
  if (url.protocol === "whatsapp:" || WHATSAPP.has(host)) {
    return { event: "contact_click", contact_method: "whatsapp", cta_location: where };
  }
  if (SOCIAL[host]) return { event: "social_click", social_network: SOCIAL[host], cta_location: where };

  if (url.origin !== page.origin) return null;
  const to = languageOf(url.pathname);
  const from = languageOf(page.pathname);
  if (to && from && to !== from) return { event: "language_switch", language_to: to, cta_location: where };
  return { event: "nav_click", link_text: text(anchor), link_url: url.pathname + url.hash, cta_location: where };
}

// ----------------------------------------------------- other interactions --

/** A question of the FAQ opened (a <details> toggled open). */
export function faqEvent(details: Element): GtmEvent | null {
  if (!(details instanceof HTMLDetailsElement) || !details.open) return null;
  const all = details.parentElement ? Array.from(details.parentElement.querySelectorAll(":scope > details")) : [];
  return {
    event: "faq_open",
    faq_question: text(details.querySelector("summary")),
    faq_position: all.indexOf(details) + 1,
    cta_location: placeOf(details),
  };
}

/**
 * An account made on the dashboard (components/signed-up.tsx reads it from
 * the address the dashboard opened): how, and the plan it chose if any.
 */
export function signUpEvent(search: URLSearchParams): GtmEvent {
  const word = (value: string | null) => (value && /^[\w-]{1,64}$/.test(value) ? value : "");
  return {
    event: "sign_up",
    method: search.get("method") === "google" ? "google" : "email",
    plan_id: word(search.get("plan")),
    billing_cycle: word(search.get("cycle")),
  };
}

/** The pricing's monthly / yearly switch (radio inputs named `…-cycle`), or the features search. */
export function changeEvent(target: Element): GtmEvent | null {
  if (!(target instanceof HTMLInputElement)) return null;
  if (target.type === "radio" && target.name.endsWith("-cycle") && target.checked) {
    return { event: "pricing_cycle_change", billing_cycle: target.classList.contains("cycle-yearly") ? "yearly" : "monthly" };
  }
  if (target.type === "search" && target.value.trim().length >= 2) {
    return { event: "search", search_term: target.value.trim().slice(0, 100), cta_location: placeOf(target) };
  }
  return null;
}
