import { cn } from "@store-builder/ui";
import { IconPage } from "@/components/icons";
import { useEditorLocale } from "./editorLocale";

/**
 * The store's own pages, under the site's pages: the catalogue, a product,
 * the cart and checkout. Opening one shows that page in the preview, drawn by
 * the storefront in the look not saved yet — header and footer, the Template
 * look, the shop pages' settings and words — so a change to any of them shows
 * there before it is saved (storefront lib/editorView.ts). The site's page on
 * the canvas stays the one being edited.
 */

export type StorePath = "/products" | "/product" | "/cart" | "/checkout";

export const STORE_PAGES: ReadonlyArray<{ path: StorePath; en: string; ar: string }> = [
  { path: "/products", en: "All products", ar: "كل المنتجات" },
  { path: "/product", en: "A product", ar: "صفحة منتج" },
  { path: "/cart", en: "Cart", ar: "السلة" },
  { path: "/checkout", en: "Checkout", ar: "الدفع" },
];

export function storePageName(path: StorePath, locale: string): string {
  const page = STORE_PAGES.find((p) => p.path === path);
  return page ? (locale === "ar" ? page.ar : page.en) : path;
}

export function StorePageList({ current, onSelect }: { current: StorePath | null; onSelect: (path: StorePath) => void }) {
  const locale = useEditorLocale();
  const ar = locale === "ar";
  return (
    <section aria-label={ar ? "صفحات المتجر" : "Store pages"} className="mt-3 border-t border-line pt-3">
      <h3 className="px-2 pb-1 text-sm font-semibold text-ink-soft">{ar ? "صفحات المتجر" : "Store pages"}</h3>
      <p className="px-2 pb-2 text-sm text-ink-soft">
        {ar ? "شوف صفحات المتجر نفسها بالشكل اللي لسه ما اتحفظش." : "See the store's own pages in the look you haven't saved yet."}
      </p>
      <ul className="space-y-0.5">
        {STORE_PAGES.map((page) => {
          const active = current === page.path;
          return (
            <li key={page.path}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSelect(page.path)}
                className={cn(
                  "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[0.75rem] px-2 text-start text-sm text-ink transition-colors hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11",
                  active && "bg-primary-soft font-semibold text-primary"
                )}
              >
                <IconPage className="size-4 shrink-0 text-ink-soft" aria-hidden />
                {ar ? page.ar : page.en}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
