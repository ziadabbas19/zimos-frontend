"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useState, type ReactNode } from "react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { PageSkeleton, SkeletonStatus, type PageSkeletonKind } from "@/components/Skeleton";
import { STORE_SKELETONS_ENABLED } from "./features";
import { storeHref } from "./storeHref";

/*
 * The main pages' loading shapes on a navigation inside the store
 * (STORE_SKELETONS_ENABLED). A StoreLink to one of them carries a
 * NavPendingReport, which reads the link's own pending state (next/link
 * useLinkStatus) and tells the provider; NavSkeletonSlot, around the layout's
 * page, then draws that page's skeleton in its place until the new page is
 * drawn. The page being left stays mounted, only hidden, so a navigation that
 * fails or is cancelled shows it again as it was.
 *
 * Nothing here runs on the server or on the first load: the slot starts
 * empty, so the server's HTML and the hydrated page are the same. A quick
 * navigation (a prefetched page) shows nothing: the shape waits SHOW_AFTER_MS.
 * A link to the page already showing (a filter, a sort: `scroll={false}`) or
 * to any other page (checkout, account, a funnel) shows nothing either.
 */

const SHOW_AFTER_MS = 150;

/** The main page a store-relative path opens, or null for every other page. */
export function skeletonKindOf(path: string): PageSkeletonKind | null {
  if (!path.startsWith("/")) return null;
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return "home";
  if (clean === "/products") return "products";
  if (/^\/products\/[^/]+$/.test(clean)) return "product";
  if (clean === "/cart") return "cart";
  return null;
}

type Report = (id: string, kind: PageSkeletonKind | null) => void;
const NavSkeletonContext = createContext<{ asked: { id: string; kind: PageSkeletonKind } | null; report: Report } | null>(null);

export function NavSkeletonProvider({ children }: { children: ReactNode }) {
  const [asked, setAsked] = useState<{ id: string; kind: PageSkeletonKind } | null>(null);
  // The latest link asking wins; a link letting go clears only its own ask.
  const report = useCallback<Report>((id, kind) => {
    setAsked((current) => (kind ? (current && current.id === id && current.kind === kind ? current : { id, kind }) : current && current.id === id ? null : current));
  }, []);
  if (!STORE_SKELETONS_ENABLED) return <>{children}</>;
  return <NavSkeletonContext value={{ asked, report }}>{children}</NavSkeletonContext>;
}

/**
 * Inside a StoreLink (a descendant of next/link, which useLinkStatus needs):
 * reports while this link's navigation is under way. Draws nothing.
 * `basePath` is the store's prefix, so a link to the page already showing is told apart.
 */
export function NavPendingReport({ href, basePath, scroll }: { href: string; basePath: string; scroll?: boolean | null }) {
  const ctx = useContext(NavSkeletonContext);
  const { pending } = useLinkStatus();
  const pathname = usePathname();
  const id = useId();
  const target = skeletonKindOf(href);
  const samePage = storeHref(basePath, href.split(/[?#]/)[0]) === pathname;
  const kind = target && scroll !== false && !samePage ? target : null;
  const report = ctx?.report;

  // Layout effects: the slot hears it in the same commit, so the new page is never hidden for a frame.
  useLayoutEffect(() => {
    if (report && kind) report(id, pending ? kind : null);
  }, [report, id, kind, pending]);
  useLayoutEffect(() => () => report?.(id, null), [report, id]);
  return null;
}

/** Around the layout's page: the skeleton of the page being opened, once a navigation has taken SHOW_AFTER_MS. */
export function NavSkeletonSlot({ label, children }: { label: string; children: ReactNode }) {
  const ctx = useContext(NavSkeletonContext);
  const asked = ctx?.asked ?? null;
  const [due, setDue] = useState<string | null>(null);

  useEffect(() => {
    if (!asked) return;
    const timer = window.setTimeout(() => {
      setDue(asked.id);
      // The new page opens at its top (the router scrolls there too): the shape starts there, not below the fold.
      window.scrollTo({ top: 0, behavior: "instant" });
    }, SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [asked]);

  // Worked out in render: the moment the ask ends, the page shows again in that same commit.
  const showing = asked && due === asked.id ? asked.kind : null;
  return (
    <>
      {showing && (
        <SkeletonStatus label={label} className="flex flex-1 flex-col" key={showing}>
          <PageSkeleton kind={showing} />
        </SkeletonStatus>
      )}
      <div className={showing ? undefined : "flex flex-1 flex-col"} hidden={showing ? true : undefined}>
        {children}
      </div>
    </>
  );
}
