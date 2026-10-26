import type { ReactNode } from "react";
import { card, container, skeleton } from "./ui";

/**
 * The store's loading placeholders: one bone, and the page shapes built from
 * it. A bone is the `skeleton` class (components/ui): the store's own line
 * colour, so it follows the theme, the imported template's look and its dark
 * mode; a pulse that stands still under prefers-reduced-motion; logical sides
 * only, so a right-to-left store needs nothing of its own. Each shape takes
 * the page's real container, grid and sizes, so the page lands where its
 * bones were. No hooks and no browser APIs: a server or a client component
 * can draw them, and what the server sends is what hydrates.
 */

/** One grey block; size it with `h-*` / `w-*` (and `aspect-*`). Hidden from screen readers. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`${skeleton} block ${className}`} />;
}

/** A region while it loads: announced once with `label`, its bones hidden from screen readers. */
export function SkeletonStatus({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Title widths in turn, so a grid doesn't read as one block.
const TITLE = ["w-4/5", "w-3/5", "w-2/3", "w-3/4"] as const;

/** A ProductCard's shape: the square photo, two lines of name, the price, the button. */
export function ProductCardBone({ index = 0 }: { index?: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-paper-raised">
      <Bone className="aspect-square w-full rounded-none" />
      <div className="flex flex-1 flex-col p-4">
        <Bone className={`h-4 ${TITLE[index % TITLE.length]}`} />
        <Bone className="mt-2 h-5 w-1/3" />
        <Bone className="mt-4 h-11 w-full" />
      </div>
    </div>
  );
}

/** Cards in the grid the page uses (its own `grid-cols-*` classes). */
export function ProductGridBones({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardBone key={index} index={index} />
      ))}
    </div>
  );
}

/** The front page: the welcome band, then the product grid (a published website's own blocks vary; this is their common shape). */
export function HomeSkeleton() {
  return (
    <>
      <div className="border-b border-line bg-paper-raised">
        <div className={`${container} flex flex-col items-center py-12 text-center sm:py-16`}>
          <Bone className="h-4 w-24" />
          <Bone className="mt-3 h-9 w-2/3 max-w-md sm:h-12" />
          <Bone className="mt-5 h-4 w-1/2 max-w-sm" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Bone className="h-11 w-36" />
            <Bone className="h-11 w-32" />
          </div>
        </div>
      </div>
      <div className={`${container} pt-10 pb-16`}>
        <Bone className="h-7 w-40" />
        <ProductGridBones count={8} className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" />
      </div>
    </>
  );
}

/** All products: the title, then the grid. */
export function ProductListSkeleton() {
  return (
    <div className={`${container} py-8 sm:py-10`}>
      <Bone className="h-8 w-48" />
      <ProductGridBones count={6} className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3" />
    </div>
  );
}

/** A product page: the way back, the photo, and beside it the name, the price, the text and the buttons. */
export function ProductPageSkeleton() {
  return (
    <div className={`${container} py-6 sm:py-8`}>
      <Bone className="h-5 w-24" />
      <div className="mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
        <Bone className="aspect-square w-full rounded-2xl" />
        <div>
          <Bone className="h-8 w-3/4" />
          <Bone className="mt-4 h-6 w-1/3" />
          <Bone className="mt-6 h-4 w-full" />
          <Bone className="mt-2 h-4 w-5/6" />
          <Bone className="mt-2 h-4 w-2/3" />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Bone className="h-12 w-full" />
            <Bone className="h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The cart's lines and its summary, below the page title (the cart page draws the title itself). */
export function CartBodyBones() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      <ul className={`${card} divide-y divide-line`}>
        {[0, 1].map((i) => (
          <li key={i} className="flex gap-4 p-4 sm:p-5">
            <Bone className="h-20 w-20 shrink-0" />
            <span className="flex-1 space-y-2 pt-1">
              <Bone className="h-4 w-2/3" />
              <Bone className="h-3 w-1/4" />
              <Bone className="mt-3 h-11 w-32" />
            </span>
          </li>
        ))}
      </ul>
      <div className={`${card} space-y-3 p-5`}>
        <Bone className="h-5 w-1/2" />
        <Bone className="h-4 w-full" />
        <Bone className="h-12 w-full" />
      </div>
    </div>
  );
}

/** The cart page whole: its title, then the lines and the summary. */
export function CartPageSkeleton() {
  return (
    <div className={`${container} py-8 sm:py-10`}>
      <Bone className="h-8 w-40" />
      <CartBodyBones />
    </div>
  );
}

export type PageSkeletonKind = "home" | "products" | "product" | "cart";

/** The shape of one of the store's main pages. */
export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
  switch (kind) {
    case "home":
      return <HomeSkeleton />;
    case "products":
      return <ProductListSkeleton />;
    case "product":
      return <ProductPageSkeleton />;
    case "cart":
      return <CartPageSkeleton />;
  }
}
