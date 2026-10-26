import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DataState } from "@/components/DataState";
import { ListSkeleton } from "./ListSkeleton";

describe("ListSkeleton, the one skeleton for tables and lists", () => {
  it("is announced once, in the dashboard's language, with its bones hidden from screen readers", () => {
    const { container } = renderWithProviders(<ListSkeleton rows={3} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading…");
    // Phone cards and the desktop sheet, each holding room for three rows.
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelectorAll('[data-slot="list-skeleton-row"]')).toHaveLength(3);
    for (const part of container.querySelectorAll("ul, .zimos-list-sheet")) expect(part).toHaveAttribute("aria-hidden");
  });

  it("reads in Arabic, mirrors by itself and stands still for reduced motion", () => {
    const { container } = renderWithProviders(<ListSkeleton variant="table" rows={2} />, { locale: "ar" });
    expect(screen.getByRole("status")).toHaveTextContent("جارٍ التحميل…");
    expect(container.querySelector("ul")).toBeNull();
    const bars = container.querySelectorAll(".animate-pulse");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(bar.className).toContain("motion-reduce:animate-none");
    expect(container.innerHTML).not.toMatch(/\b(ml|mr|pl|pr|left|right)-/);
  });

  it("takes the place of DataState's spinner while a list loads, and gives way to the list", () => {
    const loading = renderWithProviders(
      <DataState loading error={null} skeleton={<ListSkeleton />}>
        <p>The list</p>
      </DataState>
    );
    expect(document.querySelector("[data-skeleton]")).not.toBeNull();
    expect(screen.queryByText("The list")).toBeNull();
    loading.unmount();
    renderWithProviders(
      <DataState loading={false} error={null} skeleton={<ListSkeleton />}>
        <p>The list</p>
      </DataState>
    );
    expect(document.querySelector("[data-skeleton]")).toBeNull();
    expect(screen.getByText("The list")).toBeInTheDocument();
  });
});
