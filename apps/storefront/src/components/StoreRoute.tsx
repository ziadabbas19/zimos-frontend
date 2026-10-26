"use client";

import Link from "next/link";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { useSelectedLayoutSegment } from "next/navigation";
import { storeHref } from "@/lib/storeHref";
import { STORE_SKELETONS_ENABLED } from "@/lib/features";
import { NavPendingReport } from "@/lib/navSkeleton";

/**
 * The store's link prefix, handed down to client components.
 *
 * Only a server component can tell how the request arrived (see
 * `getStoreBasePath`), so the store layout resolves the prefix once and puts it
 * here for everything below — the cart icon, the checkout button, the page
 * builder's own blocks — instead of threading it through every prop.
 */
const StoreBasePathContext = createContext<string>("");

export function StoreRouteProvider({
  basePath,
  children,
}: {
  basePath: string;
  children: ReactNode;
}) {
  return <StoreBasePathContext value={basePath}>{children}</StoreBasePathContext>;
}

/**
 * The prefix every link in this store needs — empty on the store's own
 * subdomain. Defaults to empty outside a store (the not-found boundary can be
 * rendered above the store layout, so it resolves its own links instead).
 */
export function useStoreBasePath(): string {
  return useContext(StoreBasePathContext);
}

/**
 * A link written as if the store were at the root of its own site: `/cart`,
 * `/products/mug`. Absolute URLs, anchors and `mailto:` are left untouched, so
 * merchant-authored hrefs can go straight through.
 */
/**
 * True on the store's home page ("/") and nowhere else — the store layout's
 * one child route with no further segment selected. The same technique
 * `ShopChrome` already uses to spot the funnel routes, read here instead to
 * gate the transparent-over-hero header: it never guesses from what the page
 * looks like, only from which route is actually showing.
 */
export function useIsStoreHome(): boolean {
  return useSelectedLayoutSegment() === null;
}

export function StoreLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const basePath = useStoreBasePath();
  const isInternal = href.startsWith("/");
  if (STORE_SKELETONS_ENABLED && isInternal) {
    // The page's loading shape while this link's navigation is under way (lib/navSkeleton); it draws nothing itself.
    return (
      <Link href={storeHref(basePath, href)} {...props}>
        {props.children}
        <NavPendingReport href={href} basePath={basePath} scroll={props.scroll} />
      </Link>
    );
  }
  return <Link href={isInternal ? storeHref(basePath, href) : href} {...props} />;
}
