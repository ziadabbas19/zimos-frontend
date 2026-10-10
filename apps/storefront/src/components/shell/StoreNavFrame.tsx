"use client";

import type { ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import type { StorefrontCollection, StorefrontMeta } from "@store-builder/api-client";
import { STORE_SIDEBAR_ENABLED } from "@/lib/features";
import type { Locale } from "@/lib/i18n";
import { hasSideNav } from "@/lib/storeNav";
import { useStoreShell } from "@/lib/StoreShellContext";
import { StoreSideNav } from "./StoreSideNav";

/**
 * Where a store's side navigation goes, around everything the store layout
 * draws. With the build switch off (lib/features) this is its children and
 * nothing else: not one element more than the layout drew before.
 *
 * With it on, the children sit in two boxes. For a store on the top bar (every
 * store, until its merchant picks otherwise) both boxes are `display:
 * contents`, so the page lays out as if they were not there. For a store on
 * the side navigation they become a row from `xl`: the column
 * (StoreSideNav), then the page beside it, in the document's direction. The
 * boxes are the same two elements either way, so the editor's preview can
 * switch between the layouts without the page under it being mounted again.
 *
 * Funnel pages (`/f/…`) keep the shopper on one path with a masthead of their
 * own: no column there, the same way the header steps aside (HideInFunnel).
 */
export function StoreNavFrame({
  store,
  locale,
  collections,
  children,
}: {
  store: StorefrontMeta;
  locale: Locale;
  collections: StorefrontCollection[];
  children: ReactNode;
}) {
  if (!STORE_SIDEBAR_ENABLED) return <>{children}</>;
  return (
    <SideNavFrame store={store} locale={locale} collections={collections}>
      {children}
    </SideNavFrame>
  );
}

function SideNavFrame({
  store,
  locale,
  collections,
  children,
}: {
  store: StorefrontMeta;
  locale: Locale;
  collections: StorefrontCollection[];
  children: ReactNode;
}) {
  const { header } = useStoreShell(store);
  const inFunnel = useSelectedLayoutSegment() === "f";
  const side = hasSideNav(header) && !inFunnel;
  return (
    <div data-store-nav={side ? "side" : undefined} className={side ? "flex flex-1 flex-col xl:flex-row" : "contents"}>
      {side && <StoreSideNav store={store} locale={locale} collections={collections} />}
      <div className={side ? "flex min-w-0 flex-1 flex-col" : "contents"}>{children}</div>
    </div>
  );
}
