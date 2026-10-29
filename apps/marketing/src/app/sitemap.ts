import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { POLICIES_LAST_UPDATED } from "@/lib/policies";
import { SITE_URL } from "@/lib/urls";

/** Every page, in both languages, each pointing at its other-language twin. */
const PAGES: Array<{ path: string; priority: number; lastModified?: string }> = [
  { path: "", priority: 1 },
  { path: "/features", priority: 0.9 },
  { path: "/pricing", priority: 0.9 },
  { path: "/refund-policy", priority: 0.5, lastModified: POLICIES_LAST_UPDATED },
  { path: "/terms", priority: 0.5, lastModified: POLICIES_LAST_UPDATED },
  { path: "/privacy", priority: 0.5, lastModified: POLICIES_LAST_UPDATED },
  { path: "/contact", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ path, priority, lastModified }) =>
    locales.map((locale) => ({
      url: `${SITE_URL}/${locale}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: path === "/pricing" ? ("weekly" as const) : ("monthly" as const),
      priority,
      alternates: {
        languages: Object.fromEntries(locales.map((other) => [other, `${SITE_URL}/${other}${path}`])),
      },
    }))
  );
}
