import type { StorefrontMeta } from "@store-builder/api-client";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { container } from "@/components/ui";
import { ZimosLogo } from "@/components/ZimosLogo";

/**
 * The masthead of a funnel page: the same brand bar, logo and name as the
 * store's own header (StoreHeader), and deliberately nothing else. No cart, no
 * tracking link, and the logo isn't a link — a funnel keeps the shopper on one
 * path. The language and theme switches stay, since they re-render the same
 * step in place.
 */
export function FunnelHeader({ store }: { store: StorefrontMeta }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper-raised/95 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/85">
      <div
        className="h-1 w-full"
        style={{
          backgroundImage: "linear-gradient(to right, var(--brand-primary), var(--brand-secondary))",
        }}
        aria-hidden
      />
      <div className={`${container} flex h-16 items-center justify-between gap-3`}>
        <div className="flex min-w-0 items-center gap-3">
          {store.logoUrl ? (
            // Merchant logos are arbitrary remote URLs (no next/image allowlist).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <ZimosLogo height={32} surface="auto" className="shrink-0" />
          )}
          <span className="truncate font-display text-lg font-bold text-ink">{store.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
