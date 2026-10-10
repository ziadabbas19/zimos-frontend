import { storefrontDesignMeta, storefrontHeaderCollections, type StorefrontMeta } from "@store-builder/api-client";
import { resolveShellLinks, type HeaderShell, type ResolvedShellLink } from "@/lib/storeShell";
import { menuChildren } from "./NavDropdown";

/**
 * The store's menu as the header draws it, whichever shape the header takes
 * (the bar across the top, the side column): the merchant's own links when
 * they wrote some, then the pages and the collections flagged "show in
 * header". Null when there is none of these: the header then has no menu of
 * its own, and the phone sheet shows Home.
 *
 * `children` are the lists that open under a link (NavDropdown), keyed by the
 * link's place in the merchant's menu: `Number(link.key.split(":")[0])`.
 */
export function headerMenuOf(
  store: StorefrontMeta,
  header: Pick<HeaderShell, "menu">,
  common: { home: string; cart: string; trackOrder: string }
): { menu: ResolvedShellLink[] | null; children: Map<number, ResolvedShellLink[]> } {
  // Pages flagged "show in header" (store settings → pages) join the menu.
  const headerPages: ResolvedShellLink[] = storefrontDesignMeta(store)
    .navPages.filter((p) => p.showInHeader)
    .map((p) => ({ key: `page:${p.path}`, label: p.title, href: p.path, external: false }));
  // Collections flagged "show in header" (catalog → collections) join it too.
  for (const c of storefrontHeaderCollections(store)) {
    headerPages.push({
      key: `collection:${c.id}`,
      label: c.name,
      href: `/products?collection=${encodeURIComponent(c.slug)}`,
      external: false,
    });
  }
  const ownMenu: ResolvedShellLink[] | null = header.menu ? resolveShellLinks(header.menu, common) : null;
  const menu: ResolvedShellLink[] | null =
    headerPages.length > 0
      ? [...(ownMenu ?? [{ key: "home", label: common.home, href: "/", external: false }]), ...headerPages]
      : ownMenu;
  return { menu, children: menuChildren(store.themeSettings, common) };
}
