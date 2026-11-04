"use client";

import { usePathname } from "next/navigation";
import { NotFoundContent } from "@/components/NotFoundContent";
import { DictionaryChunk, useArrivedDictionary } from "@/lib/dictionaryChunks";
import { useStore } from "@/lib/StoreContext";
import { useRedirectLookup } from "@/lib/useRedirectLookup";

/**
 * The 404 for anything under a store — a path the merchant never published, or
 * a product that's gone. Reached when a page below the store layout calls
 * `notFound()`, so there is a real store to send the shopper back to.
 *
 * A client component so it can work out where "the store" is from the URL: a
 * not-found boundary is rendered outside its segment, so neither the route
 * params nor the store layout's link prefix reach it. The pathname is the one
 * the shopper sees, which on a store's own subdomain is already store-relative
 * and on the shared host still carries the `/store/<workspaceId>` prefix.
 *
 * Bilingual: the store language first, the other language underneath — the
 * boundary can be hit by a link from anywhere, including a shopper who has
 * never chosen a language here.
 */
export default function StoreNotFound() {
  const pathname = usePathname() ?? "";
  const workspaceId = pathname.match(/^\/store\/([^/]+)/)?.[1] ?? null;
  const home = workspaceId ? `/store/${workspaceId}` : "/";
  // An address the merchant moved goes on to its new one (URL_REDIRECTS_ENABLED; nothing is asked while it is off).
  useRedirectLookup();

  const { locale } = useStore();
  const otherLang = locale === "ar" ? "en" : "ar";

  return (
    <>
      <DictionaryChunk locale={otherLang} />
      <Bilingual home={home} otherLang={otherLang} />
    </>
  );
}

function Bilingual({ home, otherLang }: { home: string; otherLang: "ar" | "en" }) {
  const { t } = useStore();
  const other = useArrivedDictionary(otherLang);
  return (
    <NotFoundContent
      homeHref={home}
      homeLabel={t.notFound.cta}
      title={t.notFound.title}
      body={t.notFound.body}
      secondary={{ lang: otherLang, text: `${other.notFound.title} — ${other.notFound.body}` }}
    />
  );
}
