"use client";

import { ZLoader, ZLoaderHold, type ZLoaderSize } from "@store-builder/ui/z-loader";
import type { ReactNode } from "react";
import { useStore } from "@/lib/StoreContext";

/** The store's brand colour here; the loader's own default is the ZIMOS mark's cyan-to-blue. */
const STORE_COLOUR = "var(--color-primary, #0080e0)";

/**
 * The shared Z loader (packages/ui z-loader) in the store's own colour
 * (`--color-primary` is the store's brand colour here; the trail runs from a
 * light tint of it to it), announced in the shopper's language unless a label
 * says what is on its way. sm keeps the text colour, as in a button.
 */
export function StoreLoader({ size = "md", label, className }: { size?: ZLoaderSize; label?: string; className?: string }) {
  const { t } = useStore();
  return <ZLoader size={size} color={size === "sm" ? undefined : STORE_COLOUR} label={label ?? t.common.loading} className={className} />;
}

/** A Suspense fallback for a whole page: the Z in the middle of the page's room. */
export function StorePageLoader() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <StoreLoader />
    </main>
  );
}

/** A button's words while its call is out: the Z sits on them and the button keeps its size. */
export function StoreButtonLoader({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useStore();
  return <ZLoaderHold label={label ?? t.common.loading}>{children}</ZLoaderHold>;
}
