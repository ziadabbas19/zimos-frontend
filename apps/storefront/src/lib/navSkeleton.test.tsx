import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

const status = vi.hoisted(() => ({ pending: false, pathname: "/" }));
const flags = vi.hoisted(() => ({ on: true }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get STORE_SKELETONS_ENABLED() {
    return flags.on;
  },
}));
vi.mock("next/link", async (original) => ({
  ...(await original<typeof import("next/link")>()),
  useLinkStatus: () => ({ pending: status.pending }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => status.pathname, useSelectedLayoutSegment: () => null }));

import { PageSkeleton } from "@/components/Skeleton";
import { StoreLink } from "@/components/StoreRoute";
import { NavSkeletonProvider, NavSkeletonSlot, skeletonKindOf } from "./navSkeleton";

function Store({ href, scroll }: { href: string; scroll?: boolean }) {
  return (
    <NavSkeletonProvider>
      <StoreLink href={href} scroll={scroll}>
        Open
      </StoreLink>
      <NavSkeletonSlot label="Loading…">
        <p>The page being left</p>
      </NavSkeletonSlot>
    </NavSkeletonProvider>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  status.pending = false;
  status.pathname = "/";
  flags.on = true;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("which page a link opens", () => {
  it("knows the front page, all products, a product and the cart, and nothing else", () => {
    expect(skeletonKindOf("/")).toBe("home");
    expect(skeletonKindOf("/?collection=bags")).toBe("home");
    expect(skeletonKindOf("/products")).toBe("products");
    expect(skeletonKindOf("/products?sort=price")).toBe("products");
    expect(skeletonKindOf("/products/mug")).toBe("product");
    expect(skeletonKindOf("/products/mug?from=home#reviews")).toBe("product");
    expect(skeletonKindOf("/cart")).toBe("cart");
    expect(skeletonKindOf("/checkout")).toBeNull();
    expect(skeletonKindOf("/account/points")).toBeNull();
    expect(skeletonKindOf("/products/mug/reviews")).toBeNull();
    expect(skeletonKindOf("https://example.com/")).toBeNull();
  });
});

describe("a navigation inside the store (STORE_SKELETONS_ENABLED)", () => {
  it("shows the product page's shape once the link has waited, hiding the page being left; then the new page at once", () => {
    const { rerender } = render(<Store href="/products/mug" />);
    status.pending = true;
    rerender(<Store href="/products/mug" />);
    // A quick navigation shows nothing.
    expect(screen.queryByRole("status")).toBeNull();
    act(() => void vi.advanceTimersByTime(150));
    const shape = screen.getByRole("status");
    expect(shape.textContent).toContain("Loading…");
    expect(shape.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("The page being left").parentElement?.hidden).toBe(true);
    expect(window.scrollTo).toHaveBeenCalled();

    status.pending = false;
    rerender(<Store href="/products/mug" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("The page being left").parentElement?.hidden).toBe(false);
  });

  it("shows nothing for a link to the page already showing, a scroll={false} filter, or a page without a shape", () => {
    for (const [href, scroll, pathname] of [
      ["/products?sort=price", undefined, "/products"],
      ["/products?color=red", false, "/"],
      ["/checkout", undefined, "/"],
    ] as const) {
      status.pathname = pathname;
      status.pending = false;
      const { rerender, unmount } = render(<Store href={href} scroll={scroll} />);
      status.pending = true;
      rerender(<Store href={href} scroll={scroll} />);
      act(() => void vi.advanceTimersByTime(500));
      expect(screen.queryByRole("status")).toBeNull();
      unmount();
    }
  });

  it("is off: the link carries nothing and the page is never hidden", () => {
    flags.on = false;
    const { rerender } = render(<Store href="/products/mug" />);
    status.pending = true;
    rerender(<Store href="/products/mug" />);
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("link", { name: "Open" }).getAttribute("href")).toBe("/products/mug");
  });

  it("sends from the server only the page itself, so hydration matches", () => {
    const html = renderToString(<Store href="/products/mug" />);
    expect(html).toContain("The page being left");
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("hidden");
  });
});

describe("the shapes", () => {
  it.each(["home", "products", "product", "cart"] as const)("%s: bones hidden from screen readers, still for reduced motion, logical sides only", (kind) => {
    const { container } = render(<PageSkeleton kind={kind} />);
    const bones = container.querySelectorAll("span[aria-hidden]");
    expect(bones.length).toBeGreaterThan(3);
    for (const bone of bones) expect(bone.className).toContain("motion-reduce:animate-none");
    // Right-to-left needs nothing of its own: no physical left/right spacing or position.
    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
  });
});
